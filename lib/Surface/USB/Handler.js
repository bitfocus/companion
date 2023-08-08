/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 *
 */

import ElgatoStreamDeckDriver from './ElgatoStreamDeck.js'
import HID from 'node-hid'
// import InfinittonDriver from './Infinitton.js'
import XKeysDriver from './XKeys.js'
import LoupedeckLiveDriver from './LoupedeckLive.js'
import ContourShuttleDriver from './ContourShuttle.js'

if (process.platform === 'linux') {
	HID.setDriverType('hidraw')
	// Force it to load just in case
	HID.devices()
}

global.MAX_BUTTONS = parseInt(process.env.MAX_BUTTONS)
global.MAX_BUTTONS_PER_ROW = parseInt(process.env.MAX_BUTTONS_PER_ROW)

/*
	This is written with the idea that it might only handle one device, or more than one device
	for future compatibility. Currently each handler instance only handles one device though.
*/
const driver_instances = {}

process.on('uncaughtException', (err) => {
	process.send({ cmd: 'log', level: 'debug', message: `uncaughtException: ${err}` })
})
process.on('unhandledRejection', (err) => {
	process.send({ cmd: 'log', level: 'debug', message: `unhandledRejection: ${err}` })
})

// Make sure we exit when the host process goes away
process.on('disconnect', () => {
	process.kill(process.pid, 'SIGINT')

	setTimeout(() => {
		process.exit(1)
	}, 1000)

	for (const driver of Object.values(driver_instances)) {
		try {
			driver.quit()
		} catch (e) {
			// Ignore
		}
	}
})

class IpcWrapper {
	#id
	#devicePath

	constructor(id, devicePath) {
		this.#id = id
		this.#devicePath = devicePath
	}
	log(level, message) {
		process.send({ cmd: 'log', id: this.#id, device: this.#devicePath, level, message })
	}
	remove() {
		process.send({ cmd: 'remove', id: this.#id, device: this.#devicePath })
	}
	click(key, pressed, pageOffset) {
		process.send({ cmd: 'click', id: this.#id, device: this.#devicePath, key, pressed, pageOffset })
	}
	rotate(key, direction, pageOffset) {
		process.send({ cmd: 'rotate', id: this.#id, device: this.#devicePath, key, direction, pageOffset })
	}
	setVariable(name, value) {
		process.send({ cmd: 'setVariable', id: this.#id, device: this.#devicePath, name, value })
	}
	xeysSubscribePages(pageCount) {
		process.send({ cmd: 'xkeys-subscribePage', id: this.#id, device: this.#devicePath, pageCount })
	}
}

process.on('message', (data) => {
	if (data.cmd == 'add') {
		Promise.resolve()
			.then(async () => {
				// TODO - a timeout?

				const ipcWrapper = new IpcWrapper(data.id, data.devicePath)
				let driver_instance
				if (data.type === 'elgato-streamdeck') {
					driver_instance = await ElgatoStreamDeckDriver.create(ipcWrapper, data.devicePath)
				} else if (data.type === 'loupedeck-live') {
					driver_instance = await LoupedeckLiveDriver.create(ipcWrapper, data.devicePath)
					// } else if (data.type === 'infinitton') {
					// 	driver_instance = new InfinittonDriver(system, data.devicePath)
				} else if (data.type === 'xkeys') {
					driver_instance = await XKeysDriver.create(ipcWrapper, data.devicePath)
				} else if (data.type === 'contour-shuttle') {
					driver_instance = await ContourShuttleDriver.create(ipcWrapper, data.devicePath)
				} else {
					throw new Error(`Unknown usb driver "${data.type}"`)
				}

				// Setup the instance
				driver_instances[data.id] = driver_instance
				process.send({ cmd: 'add', id: data.id, info: driver_instance.info })
			})
			.catch((e) => {
				process.send({ cmd: 'error', id: data.id, error: e.message + ' AND GOT: ' + JSON.stringify(data) })
			})
	} else if (data.cmd == 'remove') {
		try {
			driver_instances[data.id].quit()
			process.send({ cmd: 'remove', id: data.id })
		} catch (e) {
			process.send({ cmd: 'error', id: data.id, error: e.message })
		}
	} else if (data.cmd == 'quit') {
		try {
			driver_instances[data.id].quit()
		} catch (e) {
			process.send({ cmd: 'error', id: data.id, error: e.message })
		}
	} else if (data.cmd == 'draw') {
		try {
			let buffer = data.buffer
			if (buffer && buffer.type == 'Buffer') {
				buffer = Buffer.from(buffer.data)
			}

			if (!buffer || buffer.length != 15552) {
				throw new Error('buffer was not 15552, but ' + buffer.length)
			}

			driver_instances[data.id].draw(data.key, buffer, data.style)
		} catch (e) {
			process.send({ cmd: 'error', id: data.id, error: e.message })
		}
	} else if (data.cmd == 'clearDeck') {
		try {
			driver_instances[data.id].clearDeck()
		} catch (e) {
			process.send({ cmd: 'error', id: data.id, error: e.message })
		}
	} else if (data.cmd == 'setConfig') {
		try {
			driver_instances[data.id].setConfig(data.config, data.force)
		} catch (e) {
			process.send({ cmd: 'error', id: data.id, error: e.message })
		}
	} else if (data.cmd == 'xkeys-color' && typeof driver_instances[data.id].drawColor === 'function') {
		try {
			driver_instances[data.id].drawColor(data.page, data.key, data.color)
		} catch (e) {
			process.send({ cmd: 'error', id: data.id, error: e.message })
		}
	}
})

// Inform parent we are ready for devices to be added
process.send({ cmd: 'ready' })

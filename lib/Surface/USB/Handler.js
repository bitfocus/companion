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

import { EventEmitter } from 'events'
import ElgatoStreamDeckDriver from './ElgatoStreamDeck.js'
// import InfinittonDriver from './Infinitton.js'
// import XKeysDriver from './XKeys.js'

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

class IpcWrapper {
	#id
	#devicePath

	constructor(id, devicePath) {
		this.#id = id
		this.#devicePath = devicePath
	}
	debug(...args) {
		process.send({ cmd: 'debug', id: this.#id, args: args })
	}
	log(level, message) {
		process.send({ cmd: 'log', id: this.#id, device: this.#devicePath, level, message })
	}
	remove() {
		process.send({ cmd: 'remove', id: this.#id, device: this.#devicePath })
	}
	click(key, pressed) {
		process.send({ cmd: 'click', id: this.#id, device: this.#devicePath, key, pressed })
	}
}

process.on('message', (data) => {
	if (data.cmd == 'add') {
		Promise.resolve()
			.then(async () => {
				const ipcWrapper = new IpcWrapper(data.id, data.devicepath)
				let driver_instance
				if (data.type === 'elgato-streamdeck') {
					driver_instance = await ElgatoStreamDeckDriver.create(ipcWrapper, data.devicepath)
					// } else if (data.type === 'infinitton') {
					// 	driver_instance = new InfinittonDriver(system, data.devicepath)
					// } else if (data.type === 'xkeys') {
					// 	driver_instance = new XKeysDriver(system, data.devicepath)
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
	}
})

// Inform parent we are ready for devices to be added
process.send({ cmd: 'ready' })

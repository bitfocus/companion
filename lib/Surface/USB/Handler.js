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

/*
	This is written with the idea that it might only handle one device, or more than one device
	for future compatibility. Currently each handler instance only handles one device though.
*/

global.MAX_BUTTONS = parseInt(process.env.MAX_BUTTONS)
global.MAX_BUTTONS_PER_ROW = parseInt(process.env.MAX_BUTTONS_PER_ROW)

import { EventEmitter } from 'events'
import ElgatoStreamDeckDriver from './ElgatoStreamDeck.js'
import InfinittonDriver from './Infinitton.js'
import XKeysDriver from './XKeys.js'

const driver_instances = {}

class eventhandler extends EventEmitter {
	emit() {
		let args = [].slice.call(arguments)
		process.send({ cmd: 'system', args: args })
		super.emit(args)
	}
}

const system = new eventhandler()

process.on('message', (data) => {
	if (data.cmd == 'add') {
		try {
			let driver_instance
			if (data.type === 'elgato-streamdeck') {
				driver_instance = new ElgatoStreamDeckDriver(system, data.devicepath)
			} else if (data.type === 'infinitton') {
				driver_instance = new InfinittonDriver(system, data.devicepath)
			} else if (data.type === 'xkeys') {
				driver_instance = new XKeysDriver(system, data.devicepath)
			} else {
				throw new Error(`Unknown usb driver "${data.type}"`)
			}

			// Setup the instance
			driver_instances[data.id] = driver_instance
			driver_instance.log = function () {
				let args = [].slice.call(arguments)
				process.send({ cmd: 'debug', id: data.id, args: args })
			}

			if (driver_instance.info.serialnumber) {
				process.send({ cmd: 'add', id: data.id, info: driver_instance.info })
			} else {
				driver_instance.finish_add = function () {
					process.send({ cmd: 'add', id: data.id, info: driver_instance.info })
				}
			}
		} catch (e) {
			process.send({ cmd: 'error', id: data.id, error: e.message + ' AND GOT: ' + JSON.stringify(data) })
		}
	} else if (data.cmd == 'execute') {
		try {
			let result = driver_instances[data.id][data.function].apply(driver_instances[data.id], data.args)
			if (data.returnId !== undefined) {
				process.send({ cmd: 'return', id: data.id, returnId: data.returnId, result: result })
			}
		} catch (e) {
			process.send({ cmd: 'error', id: data.id, error: e.message })
		}
	} else if (data.cmd == 'system') {
		system.emit(data.args)
	} else if (data.cmd == 'remove') {
		try {
			driver_instances[data.id].quit()
			process.send({ cmd: 'remove', id: data.id })
		} catch (e) {
			process.send({ cmd: 'error', id: data.id, error: e.message })
		}
	}
})

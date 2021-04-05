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

// We have a lot of problems with USB in electron, so this
// is a workaround of that.
var cp = require('child_process')
var path = require('path')
var debug = require('debug')('Device/Hardware/Controller')
var shortid = require('shortid')

var results = {}

class DeviceHardwareController {
	constructor(system, type, devicepath, cb) {
		this.system = system
		this.id = shortid.generate()

		this.debug = require('debug')('' + type)

		// fork the child process
		this.child = cp.fork(path.join(__dirname, 'handler.js'), [], {
			stdio: 'inherit',
			env: {
				ELECTRON_RUN_AS_NODE: true,
				MAX_BUTTONS: global.MAX_BUTTONS,
				MAX_BUTTONS_PER_ROW: global.MAX_BUTTONS_PER_ROW,
			},
		})

		this.system.on('graphics_set_bank_bg', (page, bank, bgcolor) => {
			this.child.send({ id: this.id, cmd: 'system', args: ['graphics_set_bank_bg', page, bank, bgcolor] })
		})

		this.child.send({ id: this.id, cmd: 'add', type: type, devicepath: devicepath })

		this.child.on('message', (data) => {
			if (data.cmd == 'add') {
				debug('module added successfully', data.id)
				cb()
			} else if (data.cmd == 'debug') {
				this.debug.apply(this.debug, data.args)
			} else if (data.cmd == 'publish') {
				debug('got local variables from module')
				for (var key in data.info) {
					this[key] = data.info[key]
				}
			} else if (data.cmd == 'error') {
				debug('Error from usb module ' + type + ': ' + data.error + ' (id: ' + data.id + ' / ' + this.id + ')')
			} else if (data.cmd == 'return') {
				if (typeof results[data.returnId] == 'function') {
					results[data.returnId](data.result)
					delete results[data.returnId]
				}
			} else if (data.cmd == 'system') {
				system.emit.apply(system, data.args)
			}
		})

		this.child.on('error', (e) => {
			debug('Handle USB error: ', e)
		})
	}

	begin() {
		var args = [].slice.call(arguments)

		this.execute('begin', args)
	}

	clearDeck() {
		var args = [].slice.call(arguments)

		this.execute('clearDeck', args)
	}

	draw() {
		var args = [].slice.call(arguments)

		this.execute('draw', args)
	}

	execute(func, args, cb) {
		var returnId

		if (typeof cb == 'function') {
			returnId = shortid.generate()
			results[returnId] = cb
		}

		this.child.send({ cmd: 'execute', function: func, args: args, id: this.id, returnId: returnId })
	}

	getConfig(cb) {
		var args = [].slice.call(arguments)

		this.execute('getConfig', args, cb)
	}

	quit() {
		this.execute('quit')

		setTimeout(() => {
			this.child.kill()
		}, 2000)
	}

	setConfig() {
		var args = [].slice.call(arguments)

		if (this.deviceHandler) {
			// Custom override, page should have been inside the deviceconfig object
			if (args[0].page !== undefined) {
				this.deviceHandler.page = args[0].page
			}
		}

		this.execute('setConfig', args)

		if (this.deviceHandler) {
			this.deviceconfig = args[0]
			this.deviceHandler.updatedConfig()
		}
	}
}

exports = module.exports = DeviceHardwareController

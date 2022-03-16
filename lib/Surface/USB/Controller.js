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
import cp from 'child_process'
import path from 'path'
import shortid from 'shortid'
import debug0 from 'debug'

const debug = debug0('lib/Surface/USB/Controller')

const results = {}

class SurfaceUSBController {
	constructor(system, type, devicepath, cb) {
		this.system = system
		this.id = shortid.generate()

		this.debug = debug0('lib/Surface/USB/' + type)

		// fork the child process
		const child = (this.child = cp.fork(path.join(__dirname, 'Handler.js'), [], {
			stdio: 'inherit',
			env: {
				ELECTRON_RUN_AS_NODE: true,
				MAX_BUTTONS: global.MAX_BUTTONS,
				MAX_BUTTONS_PER_ROW: global.MAX_BUTTONS_PER_ROW,
			},
		}))

		this.system.on('graphics_set_bank_bg', (page, bank, bgcolor) => {
			child.send({ id: this.id, cmd: 'system', args: ['graphics_set_bank_bg', page, bank, bgcolor] })
		})

		child.send({ id: this.id, cmd: 'add', type: type, devicepath: devicepath })

		child.on('message', (data) => {
			if (data.cmd == 'add') {
				debug('module added successfully', data.id)
				for (const key in data.info) {
					this[key] = data.info[key]
				}
				cb(this)
			} else if (data.cmd == 'debug') {
				this.debug.apply(this.debug, data.args)
			} else if (data.cmd == 'error') {
				debug('Error from usb module ' + type + ': ' + data.error + ' (id: ' + data.id + ' / ' + this.id + ')')
			} else if (data.cmd == 'return') {
				if (typeof results[data.returnId] == 'function') {
					results[data.returnId](data.result)
					delete results[data.returnId]
				}
			} else if (data.cmd == 'system') {
				this.system.emit.apply(this.system, data.args)
			}
		})

		child.on('error', (e) => {
			debug('Handle USB error: ', e)
		})
	}

	_execute(func, args, cb) {
		let returnId

		if (typeof cb == 'function') {
			returnId = shortid.generate()
			results[returnId] = cb
		}

		this.child.send({ cmd: 'execute', function: func, args: args, id: this.id, returnId: returnId })
	}

	begin() {
		let args = [].slice.call(arguments)

		this._execute('begin', args)
	}

	setConfig(config, cb) {
		this._execute('setConfig', [config], cb)
	}

	draw() {
		let args = [].slice.call(arguments)

		this._execute('draw', args)
	}

	clearDeck() {
		let args = [].slice.call(arguments)

		this._execute('clearDeck', args)
	}

	quit() {
		this._execute('quit')

		setTimeout(() => {
			this.child.kill()
		}, 2000)
	}
}

export default SurfaceUSBController

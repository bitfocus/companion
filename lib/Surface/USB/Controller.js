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

// We have a lot of problems with USB in electron, so this is a workaround of that.
// TODO: I (Julian) suspect that this is due to node-hid using the uv-pool for reads, so might not be necessary soon
import cp from 'child_process'
import LogController from '../../Log/Controller.js'
import { EventEmitter } from 'events'
import { fileURLToPath } from 'url'
import { isPackaged } from '../../Resources/Util.js'

class SurfaceUSBController extends EventEmitter {
	constructor(type, devicepath, cb) {
		super()

		this.childId = '0' // The id of the instance inside the fork. We only put one per fork, so can hardcode the id

		this.logger = LogController.createLogger(`Surface/USB/${type}/${devicepath}`)

		// fork the child process
		const child = (this.child = cp.fork(
			isPackaged() ? __dirname + '/Handler.js' : fileURLToPath(new URL('Handler.js', import.meta.url)),
			[],
			{
				stdio: 'inherit',
				env: {
					ELECTRON_RUN_AS_NODE: true,
					MAX_BUTTONS: global.MAX_BUTTONS,
					MAX_BUTTONS_PER_ROW: global.MAX_BUTTONS_PER_ROW,
				},
			}
		))

		// this.system.on('graphics_set_bank_bg', (page, bank, bgcolor) => {
		// 	child.send({ id: this.childId, cmd: 'system', args: ['graphics_set_bank_bg', page, bank, bgcolor] })
		// })

		// TODO - setup timeout to catch child never becoming ready

		child.on('message', (data) => {
			if (data.cmd == 'ready') {
				child.send({ id: this.childId, cmd: 'add', type: type, devicepath: devicepath })
			} else if (data.cmd == 'add') {
				// Recreate the logger with the id instead of path
				this.logger = LogController.createLogger(`Surface/USB/${type}/${data.id}`)

				this.logger.debug('device added successfully')
				this.info = data.info
				cb(this)
			} else if (data.cmd == 'debug') {
				this.logger.debug.apply(this.debug, data.args)
			} else if (data.cmd == 'error') {
				this.logger.error('Error from usb module ' + type + ': ' + data.error)
			} else if (data.cmd == 'click') {
				this.emit('click', data.key, data.pressed)
			} else if (data.cmd == 'log') {
				this.logger.log(data.level, data.message)
			} else if (data.cmd == 'remove') {
				this.emit('remove')
			}
		})

		child.on('error', (e) => {
			this.logger.warn('Handle USB error: ', e)
		})
	}

	setConfig(config, force) {
		this.child.send({ cmd: 'setConfig', id: this.childId, config, force })
	}

	draw(key, buffer, style) {
		this.child.send({ cmd: 'draw', id: this.childId, key, buffer, style })
	}

	clearDeck() {
		this.child.send({ cmd: 'clearDeck', id: this.childId })
	}

	quit() {
		this.child.send({ cmd: 'quit', id: this.childId })

		setTimeout(() => {
			this.child.kill()
		}, 2000)
	}
}

export default SurfaceUSBController

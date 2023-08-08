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
	static async openDevice(type, devicePath) {
		const childId = '0' // The id of the instance inside the fork. We only put one per fork, so can hardcode the id

		const logger = LogController.createLogger(`Surface/USB/${type}/${devicePath}`)

		// fork the child process
		const child = cp.fork(
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
		)

		const info = await new Promise((resolve, reject) => {
			const errorHandler = (e) => {
				child.removeAllListeners()
				child.kill('SIGKILL')
				reject(e)
			}

			const messageHandler = (data) => {
				if (data.cmd == 'ready') {
					child.send({ id: childId, cmd: 'add', type: type, devicePath: devicePath })
				} else if (data.cmd == 'add') {
					if (data.error) {
						errorHandler(data.error)
					} else {
						child.removeAllListeners()

						resolve(data.info)
					}
				} else if (data.cmd == 'error') {
					errorHandler(data.error || 'Unknown error')
				} else if (data.cmd == 'log') {
					logger.log(data.level, data.message)
				} else {
					errorHandler(`USB Child did not launch correctly. Got unexpected "${data.cmd}"`)
				}
			}

			child.on('error', errorHandler)
			child.on('message', messageHandler)
		})

		return new SurfaceUSBController(type, info, child)
	}

	constructor(type, info, child) {
		super()

		this.childId = '0' // The id of the instance inside the fork. We only put one per fork, so can hardcode the id

		this.logger = LogController.createLogger(`Surface/USB/${type}/${info.deviceId}`)
		this.info = info

		this.logger.debug('device added successfully')

		this.child = child

		child.on('message', (data) => {
			if (data.cmd == 'error') {
				this.logger.error('Error from usb module ' + type + ': ' + data.error)
				// Device threw an error, so remove it
				this.emit('remove')
			} else if (data.cmd == 'click') {
				this.emit('click', data.key, data.pressed, data.pageOffset ?? 0)
			} else if (data.cmd == 'rotate') {
				this.emit('rotate', data.key, data.direction, data.pageOffset ?? 0)
			} else if (data.cmd == 'log') {
				this.logger.log(data.level, data.message)
			} else if (data.cmd == 'remove') {
				this.emit('remove')
			} else if (data.cmd == 'setVariable') {
				this.emit('setVariable', data.name, data.value)
			} else if (data.cmd == 'xkeys-subscribePage') {
				this.emit('xkeys-subscribePage', data.pageCount)
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

	xkeysDraw(page, key, color) {
		this.child.send({ cmd: 'xkeys-color', id: this.childId, page, key, color })
	}
}

export default SurfaceUSBController

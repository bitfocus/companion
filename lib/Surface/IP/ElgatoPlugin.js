/*
 * This file is part of the Companion project
 * Copyright (c) 2019 Bitfocus AS
 * Authors: Håkon Nessjøen <haakon@bitfocus.io>, William Viker <william@bitfocus.io>
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

import LogController from '../../Log/Controller.js'
import { rotateBuffer } from '../../Resources/Util.js'
import { EventEmitter } from 'events'

class SurfaceIPElgatoPlugin extends EventEmitter {
	logger = LogController.createLogger('Surface/IP/ElgatoPlugin')

	constructor(registry, devicepath, socket) {
		super()
		this.controls = registry.controls

		this.socket = socket

		this.logger.debug('Adding Elgato Streamdeck Plugin')

		this.info = {
			type: 'Elgato Streamdeck Plugin',
			devicepath: devicepath,
			configFields: ['rotation'],
			keysPerRow: 8,
			keysTotal: 32,
			serialnumber: 'plugin',
		}

		this._config = {
			rotation: 0,
		}

		socket.on('keydown', (data) => {
			let key = data.keyIndex
			let page = data.page
			let bank = data.bank

			if (key !== undefined) {
				this.emit('click', key, true)
			} else if (page !== undefined && bank !== undefined) {
				const controlId = CreateBankControlId(page, bank)
				this.controls.pressControl(controlId, true, this.info.devicepath)

				this.logger.info(`Button ${page}.${bank + 1} pressed`)
			}
		})

		socket.on('keyup', (data) => {
			let key = data.keyIndex
			let page = data.page
			let bank = data.bank

			if (key !== undefined) {
				this.emit('click', key, false)
			} else if (page !== undefined && bank !== undefined) {
				const controlId = CreateBankControlId(page, bank)
				this.controls.pressControl(controlId, false, this.info.devicepath)

				this.logger.info(`Button ${page}.${bank + 1} released`)
			}
		})
	}

	quit() {
		this.socket.removeAllListeners('keyup')
		this.socket.removeAllListeners('keydown')
	}

	draw(key, buffer, style) {
		if (buffer === undefined || buffer.length != 15552) {
			this.logger.silly('buffer was not 15552, but ', buffer.length)
			return false
		}

		buffer = rotateBuffer(buffer, this._config.rotation)
		this.socket.apicommand('fillImage', { keyIndex: key, data: buffer })

		return true
	}

	clearDeck() {
		this.logger.silly('elgato.prototype.clearDeck()')
		const emptyBuffer = Buffer.alloc(72 * 72 * 3)

		for (let i = 0; i < global.MAX_BUTTONS; ++i) {
			this.socket.apicommand('fillImage', { keyIndex: i, data: emptyBuffer })
		}
	}

	setConfig(config) {
		this._config = config
	}
}

export default SurfaceIPElgatoPlugin

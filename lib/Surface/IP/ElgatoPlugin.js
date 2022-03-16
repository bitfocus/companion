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

import SurfaceBase from '../Base.js'
import debug0 from 'debug'

class SurfaceIPElgatoPlugin extends SurfaceBase {
	debug = debug0('lib/Surface/IP/ElgatoPlugin')

	constructor(system, devicepath) {
		super()

		this.system = system

		this.type = 'Elgato Streamdeck Plugin'
		this.serialnumber = 'plugin'

		this.debug('Adding Elgato Streamdeck Plugin')

		this.devicepath = devicepath
		this.config = ['rotation']
		this.keysPerRow = 8
		this.keysTotal = 32

		this._config = {
			rotation: 0,
		}

		this.system.once(devicepath + '_plugin_startup', (socket) => {
			this.socket = socket

			socket.on('keydown', (data) => {
				let key = data.keyIndex
				let page = data.page
				let bank = data.bank

				if (key !== undefined) {
					this.system.emit('device_click', devicepath, key, true)
				} else if (page !== undefined && bank !== undefined) {
					this.bank.action.pressBank(page, bank + 1, true, this.devicepath)
					this.system.emit(
						'log',
						'device(' + this.devicepath + ')',
						'debug',
						'Button ' + page + '.' + (bank + 1) + ' pressed'
					)
				}
			})

			socket.on('keyup', (data) => {
				let key = data.keyIndex
				let page = data.page
				let bank = data.bank

				if (key !== undefined) {
					this.system.emit('device_click', devicepath, key, false)
				} else if (page !== undefined && bank !== undefined) {
					this.bank.action.pressBank(page, bank + 1, false, this.devicepath)
					this.system.emit(
						'log',
						'device(' + this.devicepath + ')',
						'debug',
						'Button ' + page + '.' + (bank + 1) + ' released'
					)
				}
			})
		})
	}

	quit() {
		if (this.socket) {
			this.socket.removeAllListeners('keyup')
			this.socket.removeAllListeners('keydown')
		}
	}

	draw(key, buffer, style) {
		if (buffer === undefined || buffer.length != 15552) {
			this.debug('buffer was not 15552, but ', buffer.length)
			return false
		}

		// TODO: Fix
		let hack = { log: this.debug, config: this._config }
		buffer = this.handleBuffer.call(hack, buffer)

		this.fillImage(key, buffer)

		return true
	}

	clearDeck() {
		this.debug('elgato.prototype.clearDeck()')
		this.clearAllKeys()
	}

	/* elgato-streamdeck functions */

	setConfig(config) {
		this._config = config
	}

	fillImage(keyIndex, imageBuffer) {
		if (imageBuffer.length !== 15552) {
			throw new RangeError('Expected image buffer of length 15552, got length ' + imageBuffer.length)
		}

		if (this.socket) {
			this.socket.apicommand('fillImage', { keyIndex: keyIndex, data: imageBuffer })
		} else {
			//this.debug('trying to emit to nonexistaant socket: ', this.id);
		}
	}

	clearAllKeys() {
		if (this.socket) {
			const emptyBuffer = Buffer.alloc(72 * 72 * 3)

			for (let i = 0; i < global.MAX_BUTTONS; ++i) {
				this.socket.apicommand('fillImage', { keyIndex: i, data: emptyBuffer })
			}
		} else {
			this.debug('trying to emit to nonexistaant socket: ', this.id)
		}
	}
}

export default SurfaceIPElgatoPlugin

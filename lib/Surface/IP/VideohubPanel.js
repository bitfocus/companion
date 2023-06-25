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
import { EventEmitter } from 'events'

class SurfaceIPVideohubPanel extends EventEmitter {
	logger = LogController.createLogger('Surface/IP/VideohubPanel')

	runningBrightness = false
	pendingBrightness = false

	constructor(deviceInfo) {
		super()

		this.info = {
			type: deviceInfo.productName,
			devicepath: deviceInfo.path,
			configFields: ['brightness'],
			// HACK sizes until the grid can be bigger
			keysPerRow: global.MAX_BUTTONS_PER_ROW, // deviceInfo.keysPerRow,
			keysTotal: global.MAX_BUTTONS, //deviceInfo.keysTotal,
			deviceId: deviceInfo.path,
			location: deviceInfo.remoteAddress,
		}

		this.server = deviceInfo.server
		this.serverId = deviceInfo.serverId

		this.deviceId = deviceInfo.path

		this.logger.info(`Adding Videohub Panel device "${this.deviceId}"`)

		this._config = {
			brightness: 100,
		}
	}

	quit() {}

	draw(key, buffer, style) {
		// Not supported

		return true
	}

	doButton(key, state) {
		let offset = 0
		if (key >= global.MAX_BUTTONS) {
			// HACK sizes until the grid can be bigger
			offset = Math.floor(key / global.MAX_BUTTONS)
			key = key % global.MAX_BUTTONS
		}

		this.emit('click', key, state, offset)
	}

	clearDeck() {
		// Not supported
	}

	/* elgato-streamdeck functions */

	setConfig(config, force) {
		const newBrightness = Math.floor(config.brightness / 10)
		if ((force || this._config.brightness != newBrightness) && config.brightness !== undefined) {
			this._config.brightness = newBrightness
			this.#setBrightness(newBrightness)
		}
	}

	#setBrightness(value) {
		if (this.runningBrightness) {
			this.pendingBrightness = true
			return
		}

		this.runningBrightness = true
		this.pendingBrightness = false

		// TODO - this is broken now...
		// It was fighting itself being run in parallel

		this.logger.silly('brightness: ' + value)
		this.server
			.setBacklight(this.serverId, value)
			.catch((e) => {
				this.logger.error('Failed to set videohub panel brightness: ' + e?.toString())
			})
			.then(() => {
				this.runningBrightness = false
				if (this.pendingBrightness) {
					this.#setBrightness(this._config.brightness)
				}
			})
	}
}

export default SurfaceIPVideohubPanel

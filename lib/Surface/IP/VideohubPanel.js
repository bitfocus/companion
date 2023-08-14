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
import { convertPanelIndexToXY } from '../Util.js'

class SurfaceIPVideohubPanel extends EventEmitter {
	logger = LogController.createLogger('Surface/IP/VideohubPanel')

	constructor(deviceInfo) {
		super()

		this.info = {
			type: deviceInfo.productName,
			devicePath: deviceInfo.path,
			configFields: ['brightness', 'videohub_page_count'],
			deviceId: deviceInfo.path,
			location: deviceInfo.remoteAddress,
		}

		this.gridSize = {
			columns: deviceInfo.panelInfo.buttonsColumns,
			rows: deviceInfo.panelInfo.buttonsRows,
		}

		this.server = deviceInfo.server
		this.serverId = deviceInfo.serverId

		this.deviceId = deviceInfo.path

		this.logger.info(`Adding Videohub Panel device "${this.deviceId}"`)

		this._config = {
			brightness: 100,
			videohub_page_count: 0,
		}
	}

	quit() {}

	draw(key, buffer, style) {
		// Not supported

		return true
	}

	doButton(destination, button) {
		const xy = convertPanelIndexToXY(button, this.gridSize)
		if (xy) {
			this.emit('click', ...xy, true, destination)

			setTimeout(() => {
				// Release after a short delay
				this.emit('click', ...xy, false, destination)
			}, 20)
		}
	}

	clearDeck() {
		// Not supported
	}

	/* elgato-streamdeck functions */

	setConfig(config, force) {
		console.log('setup', config, force)
		const newBrightness = Math.floor(config.brightness / 10)
		if ((force || this._config.brightness != newBrightness) && config.brightness !== undefined) {
			this._config.brightness = newBrightness
			this.#setBrightness(newBrightness)
		}

		const page_count = Math.floor(config.videohub_page_count / 2) * 2
		if (force || this._config.videohub_page_count != page_count) {
			this._config.videohub_page_count = page_count
			this.#setPageCount(page_count)
		}
	}

	#setBrightness(value) {
		this.logger.silly('brightness: ' + value)

		try {
			this.server.setBacklight(this.serverId, value)
		} catch (e) {
			this.logger.error('Failed to set videohub panel brightness: ' + e?.toString())
		}
	}

	#setPageCount(value) {
		this.logger.silly('page count: ' + value)

		try {
			this.server.configureDevice(this.serverId, { destinationCount: value })
		} catch (e) {
			this.logger.error('Failed to set videohub panel destination count: ' + e?.toString())
		}
	}
}

export default SurfaceIPVideohubPanel

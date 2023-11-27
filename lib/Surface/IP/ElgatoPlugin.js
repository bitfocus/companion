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
import { oldBankIndexToXY, xyToOldBankIndex } from '../../Shared/ControlId.js'
import { convertPanelIndexToXY } from '../Util.js'
import { LEGACY_MAX_BUTTONS } from '../../Util/Constants.js'

class SurfaceIPElgatoPlugin extends EventEmitter {
	#logger = LogController.createLogger('Surface/IP/ElgatoPlugin')

	/**
	 * @type {import('../Util.js').GridSize}
	 * @readonly
	 * @access public
	 */
	gridSize = {
		columns: 8,
		rows: 4,
	}

	/**
	 * @type {Record<string, any>}
	 * @access private
	 */
	_config = {
		rotation: 0,
	}

	/**
	 * @param {import('../../Registry.js').default} registry
	 * @param {string} devicePath
	 * @param {import('../../Service/ElgatoPlugin.js').ServiceElgatoPluginSocket} socket
	 */
	constructor(registry, devicePath, socket) {
		super()

		this.controls = registry.controls
		this.page = registry.page

		this.socket = socket

		this.#logger.debug(`Adding Elgato Streamdeck Plugin (${this.socket.supportsPng ? 'PNG' : 'Bitmap'})`)

		this.info = {
			type: 'Elgato Streamdeck Plugin',
			devicePath: devicePath,
			configFields: ['legacy_rotation'],
			deviceId: 'plugin',
		}

		socket.on('keydown', (data) => {
			let key = data.keyIndex
			let page = data.page
			let bank = data.bank

			if (key !== undefined) {
				this.#emitClick(key, true)
			} else if (page !== undefined && bank !== undefined) {
				const xy = oldBankIndexToXY(bank + 1)
				if (xy) {
					const controlId = this.page.getControlIdAt({
						pageNumber: page,
						column: xy[0],
						row: xy[1],
					})
					if (controlId) {
						this.controls.pressControl(controlId, true, this.info.devicePath)

						this.#logger.debug(`${controlId} pressed`)
					}
				}
			}
		})

		socket.on('keyup', (data) => {
			let key = data.keyIndex
			let page = data.page
			let bank = data.bank

			if (key !== undefined) {
				this.#emitClick(key, false)
			} else if (page !== undefined && bank !== undefined) {
				const xy = oldBankIndexToXY(bank + 1)
				if (xy) {
					const controlId = this.page.getControlIdAt({
						pageNumber: page,
						column: xy[0],
						row: xy[1],
					})
					if (controlId) {
						this.controls.pressControl(controlId, false, this.info.devicePath)

						this.#logger.debug(`${controlId} released`)
					}
				}
			}
		})

		socket.on('rotate', (data) => {
			let key = data.keyIndex
			let page = data.page
			let bank = data.bank

			let right = data.ticks > 0

			if (key !== undefined) {
				const xy = convertPanelIndexToXY(key, this.gridSize)
				if (xy) {
					this.emit('rotate', ...xy, right)
				}
			} else if (page !== undefined && bank !== undefined) {
				const xy = oldBankIndexToXY(bank + 1)
				if (xy) {
					const controlId = this.page.getControlIdAt({
						pageNumber: page,
						column: xy[0],
						row: xy[1],
					})
					if (controlId) {
						this.controls.rotateControl(controlId, right, this.info.devicePath)

						this.#logger.debug(`${controlId} rotated ${right}`)
					}
				}
			}
		})
	}

	/**
	 * Produce a click event
	 * @param {number} key
	 * @param {boolean} state
	 */
	#emitClick(key, state) {
		const xy = convertPanelIndexToXY(key, this.gridSize)
		if (xy) {
			this.emit('click', ...xy, state)
		}
	}

	quit() {
		this.socket.removeAllListeners('keyup')
		this.socket.removeAllListeners('keydown')
		this.socket.removeAllListeners('rotate')
	}

	/**
	 * Draw a button
	 * @param {number} x
	 * @param {number} y
	 * @param {import('../../Graphics/ImageResult.js').ImageResult} render
	 * @returns {void}
	 */
	draw(x, y, render) {
		if (render.buffer === undefined || render.buffer.length === 0) {
			this.#logger.silly('buffer was not 15552, but ', render.buffer?.length)
			return
		}

		const key = xyToOldBankIndex(x, y)
		if (key) {
			this.socket.fillImage(key, { keyIndex: key - 1 }, render)
		}
	}

	clearDeck() {
		this.#logger.silly('elgato.prototype.clearDeck()')
		const emptyBuffer = Buffer.alloc(72 * 72 * 3)

		for (let i = 0; i < LEGACY_MAX_BUTTONS; ++i) {
			this.socket.apicommand('fillImage', { keyIndex: i, data: emptyBuffer })
		}
	}

	/**
	 * Process the information from the GUI and what is saved in database
	 * @param {Record<string, any>} config
	 * @param {boolean=} _force
	 * @returns false when nothing happens
	 */
	setConfig(config, _force) {
		this._config = config

		this.socket.rotation = this._config.rotation
	}
}

export default SurfaceIPElgatoPlugin

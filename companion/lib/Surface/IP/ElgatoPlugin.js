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
import { oldBankIndexToXY, xyToOldBankIndex } from '@companion-app/shared/ControlId.js'
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

		const triggerKeyPress = (/** @type {Record<string,any>} */ data, /** @type {boolean} */ pressed) => {
			if ('row' in data || 'column' in data) {
				if (data.page == null) {
					this.emit('click', Number(data.column), Number(data.row), pressed)
				} else {
					const controlId = this.page.getControlIdAt({
						pageNumber: Number(data.page),
						column: Number(data.column),
						row: Number(data.row),
					})
					if (controlId) {
						this.controls.pressControl(controlId, pressed, this.info.devicePath)

						this.#logger.debug(`${controlId} ${pressed ? 'pressed' : 'released'}`)
					}
				}
			} else if ('keyIndex' in data) {
				this.#emitClick(data.keyIndex, pressed)
			} else {
				const xy = oldBankIndexToXY(data.bank + 1)
				if (xy) {
					const controlId = this.page.getControlIdAt({
						pageNumber: Number(data.page),
						column: xy[0],
						row: xy[1],
					})
					if (controlId) {
						this.controls.pressControl(controlId, pressed, this.info.devicePath)

						this.#logger.debug(`${controlId} ${pressed ? 'pressed' : 'released'}`)
					}
				}
			}
		}

		socket.on('keydown', (data) => triggerKeyPress(data, true))
		socket.on('keyup', (data) => triggerKeyPress(data, false))

		socket.on('rotate', (data) => {
			const right = data.ticks > 0

			if ('row' in data || 'column' in data) {
				if (data.page == null) {
					this.emit('rotate', Number(data.column), Number(data.row), right)
				} else {
					const controlId = this.page.getControlIdAt({
						pageNumber: Number(data.page),
						column: Number(data.column),
						row: Number(data.row),
					})
					if (controlId) {
						this.controls.rotateControl(controlId, right, this.info.devicePath)

						this.#logger.debug(`${controlId} rotated ${right}`)
					}
				}
			} else if ('keyIndex' in data) {
				const xy = convertPanelIndexToXY(data.keyIndex, this.gridSize)
				if (xy) {
					this.emit('rotate', ...xy, right)
				}
			} else {
				const xy = oldBankIndexToXY(data.bank + 1)
				if (xy) {
					const controlId = this.page.getControlIdAt({
						pageNumber: Number(data.page),
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

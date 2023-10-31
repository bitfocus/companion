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
import ImageWriteQueue from '../../Resources/ImageWriteQueue.js'
import imageRs from '@julusian/image-rs'
import { translateRotation } from '../../Resources/Util.js'
import { PNG } from 'pngjs'
import { oldBankIndexToXY, xyToOldBankIndex } from '../../Shared/ControlId.js'
import { convertPanelIndexToXY } from '../Util.js'
import { LEGACY_MAX_BUTTONS } from '../../Util/Constants.js'

/**
 * @typedef {{
 *   id: string
 *   supportsPng?: boolean
 * }} ElgatoPluginClientInfo
 */

class SurfaceIPElgatoPlugin extends EventEmitter {
	#logger = LogController.createLogger('Surface/IP/ElgatoPlugin')

	/**
	 * Whether the plugin is new enough to support pngs
	 * @type {boolean}
	 * @access private
	 */
	#supportsPng = false

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
	 * @param {ElgatoPluginClientInfo} clientInfo
	 */
	constructor(registry, devicePath, socket, clientInfo) {
		super()

		this.controls = registry.controls
		this.page = registry.page

		this.socket = socket

		if (clientInfo?.supportsPng) this.#supportsPng = true
		this.#logger.debug(`Adding Elgato Streamdeck Plugin (${this.#supportsPng ? 'PNG' : 'Bitmap'})`)

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

		this.write_queue = new ImageWriteQueue(
			this.#logger,
			async (/** @type {number} */ key, /** @type {Buffer} */ buffer) => {
				const targetSize = 72 // Compatibility
				try {
					const imagesize = Math.sqrt(buffer.length / 4) // TODO: assuming here that the image is square
					let image = imageRs.ImageTransformer.fromBuffer(buffer, imagesize, imagesize, imageRs.PixelFormat.Rgba).scale(
						targetSize,
						targetSize
					)

					const rotation = translateRotation(this._config.rotation)
					if (rotation !== null) image = image.rotate(rotation)

					const newbuffer = await image.toBuffer(imageRs.PixelFormat.Rgb)

					this.socket.apicommand('fillImage', { keyIndex: key, data: newbuffer })
				} catch (/** @type {any} */ e) {
					this.#logger.debug(`scale image failed: ${e}\n${e.stack}`)
					this.emit('remove')
					return
				}
			}
		)
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
		// if (buffer === undefined || buffer.length != 15552) {
		if (render.buffer === undefined || render.buffer.length === 0) {
			this.#logger.silly('buffer was not 15552, but ', render.buffer?.length)
			return
		}

		const key = xyToOldBankIndex(x, y)
		if (key) {
			if (this.#supportsPng) {
				const imagesize = Math.sqrt(render.buffer.length / 4) // TODO: assuming here that the image is square

				const png = new PNG({
					width: imagesize,
					height: imagesize,
					bgColor: {
						red: 0,
						green: 0,
						blue: 0,
					},
				})
				png.data = render.buffer

				const pngBuffer = PNG.sync.write(png)

				this.socket.apicommand('fillImage', {
					keyIndex: key,
					png: true,
					data: 'data:image/png;base64,' + pngBuffer.toString('base64'),
				})
			} else {
				this.write_queue.queue(key, render.buffer)
			}
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
	}
}

export default SurfaceIPElgatoPlugin

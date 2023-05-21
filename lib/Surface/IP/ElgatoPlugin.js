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
import { CreateBankControlId } from '../../Shared/ControlId.js'
import ImageWriteQueue from '../../Resources/ImageWriteQueue.js'
import imageRs from '@julusian/image-rs'
import { translateRotation, toGlobalKey } from '../../Resources/Util.js'
import { PNG } from 'pngjs'
import { EventEmitter } from 'events'
import { CreateBankControlId, oldBankIndexToCoordinate, oldBankIndexToXY } from '../../Shared/ControlId.js'

class SurfaceIPElgatoPlugin extends EventEmitter {
	logger = LogController.createLogger('Surface/IP/ElgatoPlugin')

	constructor(registry, devicepath, socket, clientInfo) {
		super()
		this.controls = registry.controls

		this.socket = socket

		if (clientInfo?.supportsPng) this.supportsPng = true
		this.logger.debug(`Adding Elgato Streamdeck Plugin (${this.supportsPng ? 'PNG' : 'Bitmap'})`)

		this.info = {
			type: 'Elgato Streamdeck Plugin',
			devicepath: devicepath,
			configFields: ['rotation'],
			keysPerRow: 8,
			keysTotal: 32,
			deviceId: 'plugin',
		}

		this._config = {
			rotation: 0,
		}

		socket.on('keydown', (data) => {
			let key = data.keyIndex
			let page = data.page
			let bank = data.bank

			if (key !== undefined) {
				this.#emitClick(key, true)
			} else if (page !== undefined && bank !== undefined) {
				const coordinate = oldBankIndexToCoordinate(bank + 1)
				if (coordinate) {
					const controlId = this.page.getControlIdAt(page, coordinate)
					this.controls.pressControl(controlId, true, this.info.devicepath)

					this.logger.debug(`${controlId} pressed`)
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
				const coordinate = oldBankIndexToCoordinate(bank + 1)
				if (coordinate) {
					const controlId = this.page.getControlIdAt(page, coordinate)
					this.controls.pressControl(controlId, false, this.info.devicepath)

					this.logger.debug(`${controlId} released`)
				}
			}
		})

		socket.on('rotate', (data) => {
			let key = data.keyIndex
			let page = data.page
			let bank = data.bank

			let right = data.ticks > 0

			if (key !== undefined) {
				const xy = oldBankIndexToXY(toGlobalKey(this.info.keysPerRow, key) + 1)
				if (xy) {
					this.emit('rotate', ...xy, right)
				}
			} else if (page !== undefined && bank !== undefined) {
				const coordinate = oldBankIndexToCoordinate(bank + 1)
				if (coordinate) {
					const controlId = this.page.getControlIdAt(page, coordinate)
					this.controls.rotateControl(controlId, right, this.info.devicepath)

					this.logger.debug(`${controlId} rotated ${right}`)
				}
			}
		})

		this.write_queue = new ImageWriteQueue(this.logger, async (key, buffer, style) => {
			const targetSize = 72 // Compatibility
			try {
				const imagesize = Math.sqrt(buffer.length / 4) // TODO: assuming here that the image is square
				let image = imageRs.ImageTransformer.fromBuffer(buffer, imagesize, imagesize, imageRs.PixelFormat.Rgba).scale(
					targetSize,
					targetSize
				)

				const rotation = translateRotation(this._config.rotation)
				if (rotation !== null) image = image.rotate(rotation)

				const newbuffer = Buffer.from(await image.toBuffer(imageRs.PixelFormat.Rgb))

				this.socket.apicommand('fillImage', { keyIndex: key, data: newbuffer })
			} catch (e) {
				this.logger.debug(`scale image failed: ${e}\n${e.stack}`)
				this.emit('remove')
				return
			}
		})
	}

	#emitClick(key, state) {
		const xy = oldBankIndexToXY(toGlobalKey(this.info.keysPerRow, key) + 1)
		if (xy) {
			this.emit('click', ...xy, state)
		}
	}

	quit() {
		this.socket.removeAllListeners('keyup')
		this.socket.removeAllListeners('keydown')
		this.socket.removeAllListeners('rotate')
	}

	draw(key, buffer, style) {
		// if (buffer === undefined || buffer.length != 15552) {
		if (buffer === undefined || buffer.length === 0) {
			this.logger.silly('buffer was not 15552, but ', buffer.length)
			return false
		}

		if (this.supportsRgba) {
			const imagesize = Math.sqrt(buffer.length / 4) // TODO: assuming here that the image is square

			const png = new PNG({
				width: imagesize,
				height: imagesize,
				bgColor: {
					red: 0,
					green: 0,
					blue: 0,
				},
			})
			png.data = buffer

			const pngBuffer = PNG.sync.write(png)

			this.socket.apicommand('fillImage', {
				keyIndex: key,
				png: true,
				data: 'data:image/png;base64,' + pngBuffer.toString('base64'),
			})
		} else {
			this.write_queue.queue(key, buffer)
		}

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

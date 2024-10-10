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

import { EventEmitter } from 'events'
import { DeviceModelId, JPEGEncodeOptions, openStreamDeck, StreamDeck } from '@elgato-stream-deck/node'
import util from 'util'
import imageRs from '@julusian/image-rs'
import LogController, { Logger } from '../../Log/Controller.js'
import { ImageWriteQueue } from '../../Resources/ImageWriteQueue.js'
import { transformButtonImage } from '../../Resources/Util.js'
import { colorToRgb } from './Util.js'
import {
	OffsetConfigFields,
	BrightnessConfigField,
	LegacyRotationConfigField,
	LockConfigFields,
} from '../CommonConfigFields.js'
import type { CompanionSurfaceConfigField, GridSize } from '@companion-app/shared/Model/Surfaces.js'
import type { SurfacePanel, SurfacePanelEvents, SurfacePanelInfo } from '../Types.js'
import type { LcdPosition, StreamDeckLcdSegmentControlDefinition, StreamDeckTcp } from '@elgato-stream-deck/tcp'
import type { ImageResult } from '../../Graphics/ImageResult.js'

const setTimeoutPromise = util.promisify(setTimeout)

export const StreamDeckJpegOptions: JPEGEncodeOptions = {
	quality: 95,
	subsampling: 1, // 422
}

function getConfigFields(streamDeck: StreamDeck): CompanionSurfaceConfigField[] {
	const fields: CompanionSurfaceConfigField[] = [...OffsetConfigFields]

	// Hide brightness for the pedal
	const hasBrightness = !!streamDeck.CONTROLS.find(
		(c) => c.type === 'lcd-segment' || (c.type === 'button' && c.feedbackType !== 'none')
	)
	if (hasBrightness) fields.push(BrightnessConfigField)

	fields.push(LegacyRotationConfigField, ...LockConfigFields)

	if (streamDeck.HAS_NFC_READER)
		fields.push({
			id: 'nfc',
			type: 'custom-variable',
			label: 'Variable to store last read NFC tag to',
			tooltip: '',
		})

	return fields
}

export class SurfaceUSBElgatoStreamDeck extends EventEmitter<SurfacePanelEvents> implements SurfacePanel {
	readonly #logger: Logger

	config: Record<string, any> = {}

	readonly #streamDeck: StreamDeck | StreamDeckTcp

	readonly #writeQueue: ImageWriteQueue<string, [number, number, ImageResult]>

	/**
	 * Whether to cleanup the deck on quit
	 */
	#shouldCleanupOnQuit = true

	readonly info: SurfacePanelInfo
	readonly gridSize: GridSize

	constructor(devicePath: string, streamDeck: StreamDeck | StreamDeckTcp) {
		super()

		const tcpStreamdeck = 'tcpEvents' in streamDeck ? streamDeck : null

		const protocol = tcpStreamdeck ? 'TCP' : 'USB'

		this.#logger = LogController.createLogger(`Surface/${protocol}/ElgatoStreamdeck/${devicePath}`)

		this.config = {
			brightness: 100,
			rotation: 0,
		}

		this.#streamDeck = streamDeck

		this.#logger.debug(`Adding elgato-streamdeck ${this.#streamDeck.PRODUCT_NAME} ${protocol} device: ${devicePath}`)

		this.info = {
			type: `Elgato ${this.#streamDeck.PRODUCT_NAME}`,
			devicePath: devicePath,
			configFields: getConfigFields(this.#streamDeck),
			deviceId: '', // set in #init()
			location: undefined, // set later
		}

		const allRowValues = this.#streamDeck.CONTROLS.map((control) => control.row)
		const allColumnValues = this.#streamDeck.CONTROLS.map((button) => button.column)

		// Future: maybe this should consider the min values too, but that requires handling in a bunch of places here
		this.gridSize = {
			columns: Math.max(...allColumnValues) + 1,
			rows: Math.max(...allRowValues) + 1,
		}

		this.#writeQueue = new ImageWriteQueue(this.#logger, async (_id, x, y, render) => {
			const control = this.#streamDeck.CONTROLS.find((control) => {
				if (control.row !== y) return false

				if (control.column === x) return true

				if (control.type === 'lcd-segment' && x >= control.column && x < control.column + control.columnSpan)
					return true

				return false
			})
			if (!control) return

			if (control.type === 'button') {
				if (control.feedbackType === 'lcd') {
					let newbuffer = render.buffer
					if (control.pixelSize.width === 0 || control.pixelSize.height === 0) {
						return
					} else {
						try {
							newbuffer = await transformButtonImage(
								render,
								this.config.rotation,
								control.pixelSize.width,
								control.pixelSize.height,
								imageRs.PixelFormat.Rgb
							)
						} catch (e: any) {
							this.#logger.debug(`scale image failed: ${e}\n${e.stack}`)
							this.emit('remove')
							return
						}
					}

					const maxAttempts = 3
					for (let attempts = 1; attempts <= maxAttempts; attempts++) {
						try {
							await this.#streamDeck.fillKeyBuffer(control.index, newbuffer)
							return
						} catch (e) {
							if (attempts == maxAttempts) {
								this.#logger.debug(`fillImage failed after ${attempts} attempts: ${e}`)
								this.emit('remove')
								return
							}
							await setTimeoutPromise(20)
						}
					}
				} else if (control.feedbackType === 'rgb') {
					const color = render.style ? colorToRgb(render.bgcolor) : { r: 0, g: 0, b: 0 }
					this.#streamDeck.fillKeyColor(control.index, color.r, color.g, color.b).catch((e) => {
						this.#logger.debug(`color failed: ${e}`)
					})
				}
			} else if (control.type === 'lcd-segment' && control.drawRegions) {
				const drawColumn = x - control.column

				const columnWidth = control.pixelSize.width / control.columnSpan
				let drawX = drawColumn * columnWidth
				if (this.#streamDeck.MODEL === DeviceModelId.PLUS) {
					// Position aligned with the buttons/encoders
					drawX = drawColumn * 216.666 + 25
				}

				const targetSize = control.pixelSize.height

				let newbuffer
				try {
					newbuffer = await transformButtonImage(
						render,
						this.config.rotation,
						targetSize,
						targetSize,
						imageRs.PixelFormat.Rgb
					)
				} catch (e) {
					this.#logger.debug(`scale image failed: ${e}`)
					this.emit('remove')
					return
				}

				const maxAttempts = 3
				for (let attempts = 1; attempts <= maxAttempts; attempts++) {
					try {
						await this.#streamDeck.fillLcdRegion(control.id, drawX, 0, newbuffer, {
							format: 'rgb',
							width: targetSize,
							height: targetSize,
						})
						return
					} catch (e) {
						if (attempts == maxAttempts) {
							this.#logger.error(`fillImage failed after ${attempts}: ${e}`)
							this.emit('remove')
							return
						}
						await setTimeoutPromise(20)
					}
				}
			} else if (control.type === 'encoder' && control.hasLed) {
				const color = render.style ? colorToRgb(render.bgcolor) : { r: 0, g: 0, b: 0 }
				await this.#streamDeck.setEncoderColor(control.index, color.r, color.g, color.b)
			}
		})

		this.#streamDeck.on('error', (error) => {
			this.#logger.error(`Error: ${error}`)
			this.emit('remove')
		})

		if (tcpStreamdeck) {
			// Don't call `close` upon quit, that gets handled automatically
			this.#shouldCleanupOnQuit = false

			this.info.location = tcpStreamdeck.remoteAddress

			tcpStreamdeck.tcpEvents.on('disconnected', () => {
				this.#logger.info(
					`Lost connection to TCP Streamdeck ${tcpStreamdeck.remoteAddress}:${tcpStreamdeck.remotePort} (${this.#streamDeck.PRODUCT_NAME})`
				)

				this.emit('remove')
			})
		}

		this.#streamDeck.on('down', (control) => {
			this.emit('click', control.column, control.row, true)
		})

		this.#streamDeck.on('up', (control) => {
			this.emit('click', control.column, control.row, false)
		})

		this.#streamDeck.on('rotate', (control, amount) => {
			this.emit('rotate', control.column, control.row, amount > 0)
		})
		this.#streamDeck.on('nfcRead', (tag) => {
			const variableId = this.config.nfc
			if (!variableId) return
			this.emit('setCustomVariable', variableId, tag)
		})

		const lcdPress = (control: StreamDeckLcdSegmentControlDefinition, position: LcdPosition) => {
			const columnOffset = Math.floor((position.x / control.pixelSize.width) * control.columnSpan)

			this.emit('click', control.column + columnOffset, control.row, true)

			setTimeout(() => {
				this.emit('click', control.column + columnOffset, control.row, false)
			}, 20)
		}
		this.#streamDeck.on('lcdShortPress', lcdPress)
		this.#streamDeck.on('lcdLongPress', lcdPress)
	}

	async #init() {
		const serialNumber = await this.#streamDeck.getSerialNumber()
		this.info.deviceId = `streamdeck:${serialNumber}`

		// Make sure the first clear happens properly
		await this.#streamDeck.clearPanel()
	}

	/**
	 * Open a streamdeck
	 */
	static async create(devicePath: string): Promise<SurfaceUSBElgatoStreamDeck> {
		const streamDeck = await openStreamDeck(devicePath, {
			// useOriginalKeyOrder: true,
			jpegOptions: {
				quality: 95,
				subsampling: 1, // 422
			},
		})

		try {
			const self = new SurfaceUSBElgatoStreamDeck(devicePath, streamDeck)

			let errorDuringInit: any = null
			const tmpErrorHandler = (error: any) => {
				errorDuringInit = errorDuringInit || error
			}

			// Ensure that any hid error during the init call don't cause a crash
			self.on('error', tmpErrorHandler)

			await self.#init()

			if (errorDuringInit) throw errorDuringInit
			self.off('error', tmpErrorHandler)

			return self
		} catch (e) {
			await streamDeck.close().catch(() => null)

			throw e
		}
	}

	/**
	 * Wrap a tcp streamdeck
	 */
	static async fromTcp(fakePath: string, streamdeck: StreamDeckTcp): Promise<SurfaceUSBElgatoStreamDeck> {
		const self = new SurfaceUSBElgatoStreamDeck(fakePath, streamdeck)

		let errorDuringInit: any = null
		const tmpErrorHandler = (error: any) => {
			errorDuringInit = errorDuringInit || error
		}

		// Ensure that any hid error during the init call don't cause a crash
		self.on('error', tmpErrorHandler)

		await self.#init()

		if (errorDuringInit) throw errorDuringInit
		self.off('error', tmpErrorHandler)

		return self
	}

	/**
	 * Process the information from the GUI and what is saved in database
	 * @returns false when nothing happens
	 */
	setConfig(config: Record<string, any>, force: boolean = false) {
		if ((force || this.config.brightness != config.brightness) && config.brightness !== undefined) {
			this.#streamDeck.setBrightness(config.brightness).catch((e) => {
				this.#logger.debug(`Set brightness failed: ${e}`)
			})
		}

		this.config = config
	}

	quit(): void {
		if (!this.#shouldCleanupOnQuit) return

		this.#streamDeck
			.resetToLogo()
			.catch((e) => {
				this.#logger.debug(`Clear deck failed: ${e}`)
			})
			.then(() => {
				//close after the clear has been sent
				this.#streamDeck.close().catch(() => {
					// Ignore error
				})
			})
	}

	clearDeck(): void {
		this.#logger.silly('elgato_base.prototype.clearDeck()')

		this.#streamDeck.clearPanel().catch((e) => {
			this.#logger.debug(`Clear deck failed: ${e}`)
		})
	}

	/**
	 * Draw a button
	 */
	draw(x: number, y: number, render: ImageResult): void {
		this.#writeQueue.queue(`${x}_${y}`, x, y, render)
	}
}

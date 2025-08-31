/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 */

import { EventEmitter } from 'events'
import { openMxCreativeConsole, MXCreativeConsole } from '@logitech-mx-creative-console/node'
import util from 'util'
import LogController, { Logger } from '../../Log/Controller.js'
import { ImageWriteQueue } from '../../Resources/ImageWriteQueue.js'
import {
	OffsetConfigFields,
	BrightnessConfigField,
	LegacyRotationConfigField,
	LockConfigFields,
} from '../CommonConfigFields.js'
import type { CompanionSurfaceConfigField, GridSize } from '@companion-app/shared/Model/Surfaces.js'
import type { DrawButtonItem, SurfacePanel, SurfacePanelEvents, SurfacePanelInfo } from '../Types.js'

const setTimeoutPromise = util.promisify(setTimeout)

function getConfigFields(_surface: MXCreativeConsole): CompanionSurfaceConfigField[] {
	const fields: CompanionSurfaceConfigField[] = [
		...OffsetConfigFields,
		BrightnessConfigField,
		LegacyRotationConfigField,
		...LockConfigFields,
	]

	return fields
}

export class SurfaceUSBLogiMXConsole extends EventEmitter<SurfacePanelEvents> implements SurfacePanel {
	readonly #logger: Logger

	config: Record<string, any> = {}

	readonly #surface: MXCreativeConsole

	readonly #writeQueue: ImageWriteQueue<string, [DrawButtonItem]>

	/**
	 * Whether to cleanup the deck on quit
	 */
	#shouldCleanupOnQuit = true

	readonly info: SurfacePanelInfo
	readonly gridSize: GridSize

	constructor(devicePath: string, surface: MXCreativeConsole) {
		super()

		this.#logger = LogController.createLogger(`Surface/LogiMXConsole/${devicePath}`)

		this.config = {
			brightness: 100,
			rotation: 0,
		}

		this.#surface = surface

		this.#logger.debug(`Adding LogiMXConsole ${this.#surface.PRODUCT_NAME} device: ${devicePath}`)

		this.info = {
			type: `Logitech ${this.#surface.PRODUCT_NAME}`,
			devicePath: devicePath,
			configFields: getConfigFields(this.#surface),
			deviceId: '', // set in #init()
			location: undefined, // set later
		}

		const allRowValues = this.#surface.CONTROLS.map((control) => control.row)
		const allColumnValues = this.#surface.CONTROLS.map((button) => button.column)

		// Future: maybe this should consider the min values too, but that requires handling in a bunch of places here
		this.gridSize = {
			columns: Math.max(...allColumnValues) + 1,
			rows: Math.max(...allRowValues) + 1,
		}

		this.#writeQueue = new ImageWriteQueue(this.#logger, async (_id, item) => {
			const control = this.#surface.CONTROLS.find((control) => {
				if (control.row !== item.y) return false

				if (control.column === item.x) return true

				return false
			})
			if (!control) return

			if (control.type === 'button') {
				if (control.feedbackType === 'lcd') {
					if (control.pixelSize.width === 0 || control.pixelSize.height === 0) {
						return
					}

					let newbuffer: Uint8Array
					try {
						newbuffer = await item.defaultRender.drawNative(
							control.pixelSize.width,
							control.pixelSize.height,
							this.config.rotation,
							'rgb'
						)
					} catch (e: any) {
						this.#logger.debug(`scale image failed: ${e}\n${e.stack}`)
						this.emit('remove')
						return
					}

					const maxAttempts = 3
					for (let attempts = 1; attempts <= maxAttempts; attempts++) {
						try {
							await this.#surface.fillKeyBuffer(control.index, newbuffer)
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
				}
				// } else if (control.type === 'encoder' && control.hasLed) {
				// 	const color = render.style ? colorToRgb(render.bgcolor) : { r: 0, g: 0, b: 0 }
				// 	await this.#surface.setEncoderColor(control.index, color.r, color.g, color.b)
			}
		})

		this.#surface.on('error', (error) => {
			this.#logger.error(`Error: ${error}`)
			this.emit('remove')
		})

		this.#surface.on('down', (control) => {
			this.emit('click', control.column, control.row, true)
		})

		this.#surface.on('up', (control) => {
			this.emit('click', control.column, control.row, false)
		})

		this.#surface.on('rotate', (control, amount) => {
			this.emit('rotate', control.column, control.row, amount > 0)
		})
	}

	async #init() {
		const deviceInfo = await this.#surface.getHidDeviceInfo()

		const serialNumber = deviceInfo.serialNumber || deviceInfo.path
		if (!serialNumber) throw new Error('No serial number found for the device')
		this.info.deviceId = `logi-mx-console:${serialNumber}`

		// Make sure the first clear happens properly
		await this.#surface.clearPanel()
	}

	/**
	 * Open a streamdeck
	 */
	static async create(devicePath: string): Promise<SurfaceUSBLogiMXConsole> {
		const streamDeck = await openMxCreativeConsole(devicePath, {
			// useOriginalKeyOrder: true,
			jpegOptions: {
				quality: 95,
				subsampling: 1, // 422
			},
		})

		try {
			const self = new SurfaceUSBLogiMXConsole(devicePath, streamDeck)

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
	 * Process the information from the GUI and what is saved in database
	 * @returns false when nothing happens
	 */
	setConfig(config: Record<string, any>, force: boolean = false): void {
		if ((force || this.config.brightness != config.brightness) && config.brightness !== undefined) {
			this.#surface.setBrightness(config.brightness).catch((e) => {
				this.#logger.debug(`Set brightness failed: ${e}`)
			})
		}

		this.config = config
	}

	quit(): void {
		if (!this.#shouldCleanupOnQuit) return

		this.#surface
			.resetToLogo()
			.catch((e) => {
				this.#logger.debug(`Clear deck failed: ${e}`)
			})
			.then(async () => {
				//close after the clear has been sent
				await this.#surface.close()
			})
			.catch(() => {
				// Ignore error
			})
	}

	clearDeck(): void {
		this.#logger.silly('elgato_base.prototype.clearDeck()')

		this.#surface.clearPanel().catch((e) => {
			this.#logger.debug(`Clear deck failed: ${e}`)
		})
	}

	/**
	 * Draw a button
	 */
	draw(item: DrawButtonItem): void {
		this.#writeQueue.queue(`${item.x}_${item.y}`, item)
	}
}

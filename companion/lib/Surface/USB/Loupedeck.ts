/*
 * This file is part of the Companion project
 * Copyright (c) 2023 Bitfocus AS
 * Authors: Dorian Meid <dnmeid@gmx.net>, Julian Waller <git@julusian.co.uk>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 */

import { EventEmitter } from 'events'
import {
	LoupedeckBufferFormat,
	LoupedeckDevice,
	LoupedeckDisplayId,
	LoupedeckModelId,
	openLoupedeck,
} from '@loupedeck/node'
import { ImageWriteQueue } from '../../Resources/ImageWriteQueue.js'
import LogController, { Logger } from '../../Log/Controller.js'
import { transformButtonImage } from '../../Resources/Util.js'
import { colorToRgb } from './Util.js'
import {
	OffsetConfigFields,
	BrightnessConfigField,
	RotationConfigField,
	LockConfigFields,
} from '../CommonConfigFields.js'
import type { CompanionSurfaceConfigField, GridSize } from '@companion-app/shared/Model/Surfaces.js'
import { SurfacePanel, SurfacePanelEvents, SurfacePanelInfo } from '../Types.js'
import { ImageResult } from '../../Graphics/ImageResult.js'

const configFields: CompanionSurfaceConfigField[] = [
	//
	...OffsetConfigFields,
	BrightnessConfigField,
	RotationConfigField,
	...LockConfigFields,
]

export class SurfaceUSBLoupedeck extends EventEmitter<SurfacePanelEvents> implements SurfacePanel {
	readonly #logger: Logger

	/**
	 * Loupdeck device handle
	 */
	readonly #loupedeck: LoupedeckDevice

	readonly #writeQueue: ImageWriteQueue<string, [ImageResult]>

	config: Record<string, any>

	readonly info: SurfacePanelInfo
	readonly gridSize: GridSize

	constructor(devicePath: string, loupedeck: LoupedeckDevice, serialNumber: string) {
		super()

		this.#logger = LogController.createLogger(`Surface/USB/Loupedeck/${devicePath}`)

		this.#loupedeck = loupedeck

		this.config = {
			brightness: 100,
		}

		this.#logger.debug(`Adding Loupedeck USB device ${devicePath}`)

		this.info = {
			type: this.#loupedeck.modelName,
			devicePath: devicePath,
			configFields: configFields,
			deviceId: `loupedeck:${serialNumber}`,
		}

		const allRowValues = this.#loupedeck.controls.map((control) => control.row)
		const allColumnValues = this.#loupedeck.controls.map((button) => button.column)

		this.gridSize = {
			columns: Math.max(...allColumnValues) + 1,
			rows: Math.max(...allRowValues) + 1,
		}

		this.#loupedeck.on('error', (error) => {
			this.#logger.error(`error: ${error}`)
			this.emit('remove')
		})

		this.#loupedeck.on('down', (info) => {
			this.emit('click', info.column, info.row, true)
		})

		this.#loupedeck.on('up', (info) => {
			this.emit('click', info.column, info.row, false)
		})
		this.#loupedeck.on('rotate', (info, delta) => {
			this.emit('rotate', info.column, info.row, delta == 1)
		})
		this.#loupedeck.on('touchstart', (data) => {
			for (const touch of data.changedTouches) {
				const control = touch.target.control
				if (!control) continue

				if (control.type === 'button' || control.type === 'wheel') {
					this.emit('click', control.column, control.row, true)
				}
			}
		})
		this.#loupedeck.on('touchend', (data) => {
			for (const touch of data.changedTouches) {
				const control = touch.target.control
				if (!control) continue

				if (control.type === 'button' || control.type === 'wheel') {
					this.emit('click', control.column, control.row, false)
				}
			}
		})

		if (
			this.#loupedeck.modelId === LoupedeckModelId.LoupedeckCtV1 ||
			this.#loupedeck.modelId === LoupedeckModelId.LoupedeckCtV2
		) {
			/**
			 * Map the right touch strip to X-Keys T-Bar variable and left to X-Keys Shuttle variable
			 * this isn't the final thing but at least makes use of the strip while waiting for a better solution
			 * no multitouch support, the last moved touch wins
			 * lock will not be obeyed
			 */
			this.#loupedeck.on('touchmove', (data) => {
				const touch = data.changedTouches.find(
					(touch) => touch.target.screen == LoupedeckDisplayId.Right || touch.target.screen == LoupedeckDisplayId.Left
				)
				if (touch && touch.target.screen == LoupedeckDisplayId.Right) {
					const val = Math.min(touch.y + 7, 256) // map the touch screen height of 270 to 256 by capping top and bottom 7 pixels
					this.emit('setVariable', 't-bar', val)
					this.#loupedeck
						.drawSolidColour(LoupedeckDisplayId.Right, { red: 0, green: 0, blue: 0 }, 60, val + 7, 0, 0)
						.catch((e) => {
							this.#logger.error('Drawing right fader value ' + touch.y + ' to loupedeck failed: ' + e)
						})
					this.#loupedeck
						.drawSolidColour(LoupedeckDisplayId.Right, { red: 0, green: 127, blue: 0 }, 60, 262 - val, 0, val + 7)
						.catch((e) => {
							this.#logger.error('Drawing right fader value ' + touch.y + ' to loupedeck failed: ' + e)
						})
				} else if (touch && touch.target.screen == LoupedeckDisplayId.Left) {
					const val = Math.min(touch.y + 7, 256) // map the touch screen height of 270 to 256 by capping top and bottom 7 pixels
					this.emit('setVariable', 'shuttle', val)
					this.#loupedeck
						.drawSolidColour(LoupedeckDisplayId.Left, { red: 0, green: 0, blue: 0 }, 60, val + 7, 0, 0)
						.catch((e) => {
							this.#logger.error('Drawing left fader value ' + touch.y + ' to loupedeck failed: ' + e)
						})
					this.#loupedeck
						.drawSolidColour(LoupedeckDisplayId.Left, { red: 127, green: 0, blue: 0 }, 60, 262 - val, 0, val + 7)
						.catch((e) => {
							this.#logger.error('Drawing left fader value ' + touch.y + ' to loupedeck failed: ' + e)
						})
				}
			})
		}

		// this.#loupedeck.on('disconnect', (error) => {
		// 	this.#logger.error(`disconnected: ${error}`)
		// 	this.emit('remove')
		// })

		this.#writeQueue = new ImageWriteQueue(this.#logger, async (controlId, render) => {
			const control = this.#loupedeck.controls.find((c) => c.id === controlId)
			if (!control) return

			if (control.type === 'wheel') {
				if (!this.#loupedeck.displayWheel) return

				const width = this.#loupedeck.displayWheel.width
				const height = this.#loupedeck.displayWheel.height

				let newbuffer
				try {
					newbuffer = await transformButtonImage(render, this.config.rotation, width, height, 'rgb')
				} catch (e) {
					this.#logger.debug(`scale image failed: ${e}`)
					this.emit('remove')
					return
				}

				try {
					await this.#loupedeck.drawBuffer(
						LoupedeckDisplayId.Wheel,
						newbuffer,
						LoupedeckBufferFormat.RGB,
						width,
						height,
						0,
						0
					)
				} catch (e) {
					this.#logger.debug(`fillImage failed: ${e}`)
					this.emit('remove')
				}
			} else if (control.type === 'button' && control.feedbackType === 'lcd') {
				const width = this.#loupedeck.lcdKeySize
				const height = this.#loupedeck.lcdKeySize

				let newbuffer
				try {
					newbuffer = await transformButtonImage(render, this.config.rotation, width, height, 'rgb')
				} catch (e) {
					this.#logger.debug(`scale image failed: ${e}`)
					this.emit('remove')
					return
				}

				try {
					await this.#loupedeck.drawKeyBuffer(controlId, newbuffer, LoupedeckBufferFormat.RGB)
				} catch (e) {
					this.#logger.debug(`fillImage failed: ${e}`)
					this.emit('remove')
				}
			}
		})
	}

	/**
	 * Open a loupedeck
	 */
	static async create(devicePath: string): Promise<SurfaceUSBLoupedeck> {
		const loupedeck = await openLoupedeck(devicePath)
		try {
			const serialNumber = await loupedeck.getSerialNumber()

			const self = new SurfaceUSBLoupedeck(devicePath, loupedeck, serialNumber)

			self.clearDeck()

			return self
		} catch (e) {
			await loupedeck.close()

			throw e
		}
	}

	/**
	 * Process the information from the GUI and what is saved in database
	 */
	setConfig(config: Record<string, any>, force = false): void {
		if ((force || this.config.brightness != config.brightness) && config.brightness !== undefined) {
			this.#loupedeck.setBrightness(config.brightness / 100).catch((e) => {
				this.#logger.debug(`Set brightness failed: ${e}`)
			})
		}

		this.config = config
	}

	quit(): void {
		this.clearDeck()

		this.#loupedeck.close().catch(() => {
			// Ignore
		})
	}

	/**
	 * Draw a button
	 */
	draw(x: number, y: number, render: ImageResult): void {
		const control = this.#loupedeck.controls.find((c) => c.row === y && c.column === x)
		if (!control) return

		if (control.type === 'wheel') {
			this.#writeQueue.queue(control.id, render)
		} else if (control.type === 'encoder') {
			// Nothing to do
		} else if (control.type === 'button') {
			if (control.feedbackType === 'rgb') {
				let color = { r: 0, g: 0, b: 0 }
				if (render.style === 'pageup') color = { r: 255, g: 255, b: 255 }
				else if (render.style === 'pagedown') color = { r: 0, g: 0, b: 255 }
				else if (render.style) color = colorToRgb(render.bgcolor)

				this.#loupedeck
					.setButtonColor({
						id: control.id,
						red: color.r,
						green: color.g,
						blue: color.b,
					})
					.catch((e) => {
						this.#logger.debug(`color failed: ${e}`)
					})
			} else if (control.feedbackType === 'lcd') {
				this.#writeQueue.queue(control.id, render)
			}
		}
	}

	clearDeck(): void {
		this.#loupedeck.blankDevice(true, true).catch((e) => {
			this.#logger.debug(`blank failed: ${e}`)
		})
	}
}

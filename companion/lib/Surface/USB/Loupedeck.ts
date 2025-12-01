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
	LoupedeckDisplayId,
	LoupedeckModelId,
	openLoupedeck,
	type LoupedeckDevice,
} from '@loupedeck/node'
import { ImageWriteQueue } from '../../Resources/ImageWriteQueue.js'
import LogController, { type Logger } from '../../Log/Controller.js'
import { transformButtonImage } from '../../Resources/Util.js'
import { colorToRgb } from './Util.js'
import {
	OffsetConfigFields,
	BrightnessConfigField,
	RotationConfigField,
	LockConfigFields,
} from '../CommonConfigFields.js'
import type { CompanionSurfaceConfigField, GridSize } from '@companion-app/shared/Model/Surfaces.js'
import type { SurfacePanel, SurfacePanelEvents, SurfacePanelInfo } from '../Types.js'
import type { ImageResult } from '../../Graphics/ImageResult.js'

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
	DisplayColors: Record<string, any>

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

		this.DisplayColors = {
			LeftColor: {red: 0, green: 100, blue: 0},
			RightColor: {red: 0, green: 0, blue: 50},
			LeftValue: 0,
			RightValue: 0,
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
			this.#loupedeck.modelId === LoupedeckModelId.LoupedeckCtV2 ||
			this.#loupedeck.modelId === LoupedeckModelId.LoupedeckLive
		) {
			this.info.configFields = [
				...this.info.configFields,
				{
					id: 'leftFaderValueVariable',
					type: 'custom-variable',
					label: 'Variable to store Left Fader value to',
					tooltip:
						'This will be a value between 0 and 256 representing the position of the last touch on the left strip.',
				},
				{
					id: 'rightFaderValueVariable',
					type: 'custom-variable',
					label: 'Variable to store Right Fader value to',
					tooltip:
						'This will be a value between 0 and 256 representing the position of the last touch on the right strip.',
				},
				{
					id: 'invertFaderValues',
					type: 'checkbox',
					default: false,
					label: 'Invert Fader Values',
					tooltip: 'If set, the fader values will be inverted, with the value being between 256 and 0.',
				}
			]

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
				if (touch && touch.target.screen == LoupedeckDisplayId.Right && this.config.rightFaderValueVariable) {
					const val = Math.min(touch.y + 7, 256) // map the touch screen height of 270 to 256 by capping top and bottom 7 pixels
					this.emit('setCustomVariable', this.config.rightFaderValueVariable, (this.config.invertFaderValues ? 256 - val : val))
					this.DisplayColors.RightValue = val
					if (this.config.invertFaderValues) { // Draw from bottom → up
						this.#loupedeck
							.drawSolidColour(LoupedeckDisplayId.Right, { red: 0, green: 0, blue: 0 }, 60, val + 7, 0, 0)
							.catch((e) => {
								this.#logger.error('Drawing right fader value ' + touch.y + ' to loupedeck failed: ' + e)
							})
						this.#loupedeck
							.drawSolidColour(LoupedeckDisplayId.Right, this.DisplayColors.RightColor, 60, 262 - val, 0, val + 7)
							.catch((e) => {
								this.#logger.error('Drawing right fader value ' + touch.y + ' to loupedeck failed: ' + e)
							})
					} else { // Draw from top → down
						this.#loupedeck
							.drawSolidColour(LoupedeckDisplayId.Right, { red: 0, green: 0, blue: 0 }, 60, 270 - val, 0, val)
							.catch((e) => {
								this.#logger.error('Drawing right fader value ' + touch.y + ' to loupedeck failed: ' + e)
							})
						this.#loupedeck
							.drawSolidColour(LoupedeckDisplayId.Right, this.DisplayColors.RightColor, 60, val, 0, 0)
							.catch((e) => {
								this.#logger.error('Drawing right fader value ' + touch.y + ' to loupedeck failed: ' + e)
							})
					}
				} else if (touch && touch.target.screen == LoupedeckDisplayId.Left && this.config.leftFaderValueVariable) {
					const val = Math.min(touch.y + 7, 256) // map the touch screen height of 270 to 256 by capping top and bottom 7 pixels
					this.emit('setCustomVariable', this.config.leftFaderValueVariable, (this.config.invertFaderValues ? 256 - val : val))
					this.DisplayColors.LeftValue = val
					if (this.config.invertFaderValues) { // Draw from bottom → up
						this.#loupedeck
							.drawSolidColour(LoupedeckDisplayId.Left, { red: 0, green: 0, blue: 0 }, 60, val + 7, 0, 0)
							.catch((e) => {
								this.#logger.error('Drawing left fader value ' + touch.y + ' to loupedeck failed: ' + e)
							})
						this.#loupedeck
							.drawSolidColour(LoupedeckDisplayId.Left, this.DisplayColors.LeftColor, 60, 262 - val, 0, val + 7)
							.catch((e) => {
								this.#logger.error('Drawing left fader value ' + touch.y + ' to loupedeck failed: ' + e)
							})
					} else {
						this.#loupedeck
							.drawSolidColour(LoupedeckDisplayId.Left, { red: 0, green: 0, blue: 0 }, 60, 270 - val, 0, val)
							.catch((e) => {
								this.#logger.error('Drawing left fader value ' + touch.y + ' to loupedeck failed: ' + e)
							})
						this.#loupedeck
							.drawSolidColour(LoupedeckDisplayId.Left, this.DisplayColors.LeftColor, 60, val, 0, 0)
							.catch((e) => {
								this.#logger.error('Drawing left fader value ' + touch.y + ' to loupedeck failed: ' + e)
							})
					}
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
		} else if (control.type === 'lcd-segment') { // Update the slider display on render call to change color
				const styleBg = render.style?.bgcolor

				if (control.id == "left") {
					this.DisplayColors.LeftColor = (({ r, g, b }) => ({ red: r, green: g, blue: b }))(colorToRgb(styleBg));
				} else if (control.id == "right") {
					this.DisplayColors.RightColor = (({ r, g, b }) => ({ red: r, green: g, blue: b }))(colorToRgb(styleBg));
				}
				const side = control.id == "left" ? LoupedeckDisplayId.Left : LoupedeckDisplayId.Right
				const color = control.id == "left" ? this.DisplayColors.LeftColor : this.DisplayColors.RightColor
				const val = side == "left" ? this.DisplayColors.LeftValue : this.DisplayColors.RightValue
				this.#loupedeck
					.drawSolidColour(side, { red: 0, green: 0, blue: 0 }, 60, 270, 0, 0)
					.catch(() => {})				
				if (this.config.invertFaderValues) {
					this.#loupedeck
						.drawSolidColour(side, color, 60, val == 0 ? -3 : 262 - val, 0, val + 7)
						.catch(() => {})
				} else {
					this.#loupedeck
						.drawSolidColour(side, color, 60, val == 0 ? -3 : val, 0, 0)
						.catch(() => {})
				}
			}
	}

	clearDeck(): void {
		this.#loupedeck.blankDevice(true, true).catch((e) => {
			this.#logger.debug(`blank failed: ${e}`)
		})
	}
}

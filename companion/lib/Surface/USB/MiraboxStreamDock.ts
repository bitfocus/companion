/*
 * This file is part of the Companion project
 * Copyright (c) 2025 Dorian Meid
 * Authors: Dorian Meid <dnmeid@gmx.net>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 */

import { EventEmitter } from 'events'
import { Device, HIDAsync } from 'node-hid'
import util from 'util'
import imageRs from '@julusian/image-rs'
import jpg from '@julusian/jpeg-turbo'
import LogController, { Logger } from '../../Log/Controller.js'
import { ImageWriteQueue } from '../../Resources/ImageWriteQueue.js'
import { offsetRotation } from '../../Resources/Util.js'
import {
	BrightnessConfigField,
	LockConfigFields,
	OffsetConfigFields,
	RotationConfigField,
} from '../CommonConfigFields.js'
import type { CompanionSurfaceConfigField, GridSize } from '@companion-app/shared/Model/Surfaces.js'
import type { DrawButtonItem, SurfacePanel, SurfacePanelEvents, SurfacePanelInfo } from '../Types.js'

const setTimeoutPromise = util.promisify(setTimeout)

export class SurfaceUSBMiraboxStreamDock extends EventEmitter<SurfacePanelEvents> implements SurfacePanel {
	public logger: Logger

	config: Record<string, any> = {}

	readonly #streamDock: StreamDock

	readonly #writeQueue: ImageWriteQueue<string, [DrawButtonItem]>

	readonly info: SurfacePanelInfo
	readonly gridSize: GridSize

	constructor(devicePath: string, streamDock: StreamDock) {
		super()

		this.logger = LogController.createLogger(`Surface/USB/MiraboxStreamDock/${devicePath}`)

		this.config = {
			brightness: 100,
			rotation: 0,
		}

		this.#streamDock = streamDock

		this.logger.debug(`Adding Mirabox ${this.#streamDock.productName} device: ${devicePath}`)

		const configFields: CompanionSurfaceConfigField[] = [
			...OffsetConfigFields,
			BrightnessConfigField,
			RotationConfigField,
			...LockConfigFields,
		]

		// if (streamDock.productName.includes('N4')) {
		// 	configFields.push({
		// 		id: 'layout',
		// 		label: 'Mapping of bottom rows',
		// 		type: 'dropdown',
		// 		choices: [
		// 			{
		// 				id: '1234',
		// 				label: 'Map to columns 1,2,3,4. Swipe is 5'
		// 			},
		// 			{
		// 				id: '1245',
		// 				label: 'Map to columns 1,2,4,5. Swipe is 3'
		// 			},
		// 		],
		// 		default: '1234',
		// 	})
		// }

		this.info = {
			type: `Mirabox ${this.#streamDock.productName}`,
			devicePath: devicePath,
			configFields,
			deviceId: '', // set in #init()
			location: undefined, // set later
		}

		this.gridSize = {
			columns: this.#streamDock.columns,
			rows: this.#streamDock.rows,
		}

		this.#writeQueue = new ImageWriteQueue(this.logger, async (_id, drawItem) => {
			const output = this.#streamDock.outputs.find((control) => {
				if (control.row !== drawItem.y) return false
				if (control.column === drawItem.x) return true
				return false
			})
			if (!output) return

			if (output.type === 'lcd') {
				if (output.resolutionx < 1 || output.resolutiony < 1) {
					return
				}

				let newbuffer: Uint8Array
				try {
					newbuffer = await drawItem.defaultRender.drawNative(
						output.resolutionx,
						output.resolutiony,
						offsetRotation(this.config.rotation, 180),
						imageRs.PixelFormat.Rgb
					)
				} catch (e: any) {
					this.logger.debug(`scale image failed: ${e}\n${e.stack}`)
					this.emit('remove')
					return
				}

				const maxAttempts = 3
				for (let attempts = 1; attempts <= maxAttempts; attempts++) {
					try {
						await this.#streamDock.setKeyImage(output.column, output.row, Buffer.from(newbuffer))
						return
					} catch (e) {
						if (attempts == maxAttempts) {
							this.logger.debug(`fillImage failed after ${attempts} attempts: ${e}`)
							this.emit('remove')
							return
						}
						await setTimeoutPromise(20)
					}
				}
			}
		})

		this.#streamDock.on('error', (error) => {
			this.logger.error(`Error: ${error}`)
			this.emit('remove')
		})

		this.#streamDock.on('down', (control) => {
			this.emit('click', control.column, control.row, true)
		})

		this.#streamDock.on('up', (control) => {
			this.emit('click', control.column, control.row, false)
		})

		this.#streamDock.on('push', (control) => {
			this.emit('click', control.column, control.row, true)
			setTimeout(() => this.emit('click', control.column, control.row, false), 8)
		})

		this.#streamDock.on('rotate', (control, amount) => {
			this.emit('rotate', control.column, control.row, amount > 0)
		})
	}

	async #init() {
		this.info.deviceId = `streamdock:${this.#streamDock.serialNumber}`

		// Make sure the first clear happens properly
		await this.#streamDock.clearPanel()
	}

	/**
	 * Open a Stream Dock
	 */
	static async create(devicePath: string): Promise<SurfaceUSBMiraboxStreamDock> {
		const device = await HIDAsync.open(devicePath).catch(() => {
			throw new Error('Device not found')
		})

		// if (!device) {
		// 	throw('Device not found')
		// }
		const info = await device.getDeviceInfo()
		const streamDock = new StreamDock(info, device)

		await streamDock.wakeScreen()
		await streamDock.clearPanel()

		try {
			const self = new SurfaceUSBMiraboxStreamDock(devicePath, streamDock)

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
			await streamDock.close().catch(() => null)

			throw e
		}
	}

	/**
	 * Process the information from the GUI and what is saved in database
	 * @returns false when nothing happens
	 */
	setConfig(config: Record<string, any>, force: boolean = false): void {
		if ((force || this.config.brightness != config.brightness) && config.brightness !== undefined) {
			this.#streamDock.setBrightness(config.brightness).catch((e) => {
				this.logger.debug(`Set brightness failed: ${e}`)
			})
		}
		// if ((force || this.config.layout != config.layout) && config.layout !== undefined) {
		// 	//this.#streamDock.setLayout(config.layout)
		// }

		this.config = config
	}

	quit(): void {
		this.#streamDock
			.clearPanel()
			.catch((e) => {
				this.logger.debug(`Clear deck failed: ${e}`)
			})
			.then(async () => {
				//close after the clear has been sent
				await this.#streamDock.close()
			})
			.catch(() => {
				// Ignore error
			})
	}

	clearDeck(): void {
		this.logger.silly('StreamDock.clearPanel()')

		this.#streamDock.clearPanel().catch((e) => {
			this.logger.debug(`Clear deck failed: ${e}`)
		})
	}

	/**
	 * Draw a button
	 */
	draw(item: DrawButtonItem): void {
		this.#writeQueue.queue(`${item.x}_${item.y}`, item)
	}
}

interface StreamDockModelDefinition {
	productName: string
	inputs: any[]
	outputs: any[]
}

/**
 * Class Definition for the Mirabox Stream Dock
 *
 */
class StreamDock extends EventEmitter {
	static models = {
		'293V3': {
			productName: 'Stream Dock 293V3',
			pid: 0x1001,

			inputs: [
				{
					type: 'button',
					id: 0x01,
					row: 0,
					column: 0,
					name: 'Button 1',
				},
				{
					type: 'button',
					id: 0x02,
					row: 0,
					column: 1,
					name: 'Button 2',
				},
				{
					type: 'button',
					id: 0x03,
					row: 0,
					column: 2,
					name: 'Button 3',
				},
				{
					type: 'button',
					id: 0x04,
					row: 0,
					column: 3,
					name: 'Button 4',
				},
				{
					type: 'button',
					id: 0x05,
					row: 0,
					column: 4,
					name: 'Button 5',
				},
				{
					type: 'button',
					id: 0x06,
					row: 1,
					column: 0,
					name: 'Button 6',
				},
				{
					type: 'button',
					id: 0x07,
					row: 1,
					column: 1,
					name: 'Button 7',
				},
				{
					type: 'button',
					id: 0x08,
					row: 1,
					column: 2,
					name: 'Button 8',
				},
				{
					type: 'button',
					id: 0x09,
					row: 1,
					column: 3,
					name: 'Button 9',
				},
				{
					type: 'button',
					id: 0x0a,
					row: 1,
					column: 4,
					name: 'Button 10',
				},
				{
					type: 'button',
					id: 0x0b,
					row: 2,
					column: 0,
					name: 'Button 11',
				},
				{
					type: 'button',
					id: 0x0c,
					row: 2,
					column: 1,
					name: 'Button 12',
				},
				{
					type: 'button',
					id: 0x0d,
					row: 2,
					column: 2,
					name: 'Button 13',
				},
				{
					type: 'button',
					id: 0x0e,
					row: 2,
					column: 3,
					name: 'Button 14',
				},
				{
					type: 'button',
					id: 0x0f,
					row: 2,
					column: 4,
					name: 'Button 15',
				},
			],
			outputs: [
				{
					type: 'lcd',
					id: 0x0b,
					row: 0,
					column: 0,
					name: 'LCD 1',
					resolutionx: 112,
					resolutiony: 112,
				},
				{
					type: 'lcd',
					id: 0x0c,
					row: 0,
					column: 1,
					name: 'LCD 2',
					resolutionx: 112,
					resolutiony: 112,
				},
				{
					type: 'lcd',
					id: 0x0d,
					row: 0,
					column: 2,
					name: 'LCD 3',
					resolutionx: 112,
					resolutiony: 112,
				},
				{
					type: 'lcd',
					id: 0x0e,
					row: 0,
					column: 3,
					name: 'LCD 4',
					resolutionx: 112,
					resolutiony: 112,
				},
				{
					type: 'lcd',
					id: 0x0f,
					row: 0,
					column: 4,
					name: 'LCD 5',
					resolutionx: 112,
					resolutiony: 112,
				},
				{
					type: 'lcd',
					id: 0x06,
					row: 1,
					column: 0,
					name: 'LCD 6',
					resolutionx: 112,
					resolutiony: 112,
				},
				{
					type: 'lcd',
					id: 0x07,
					row: 1,
					column: 1,
					name: 'LCD 7',
					resolutionx: 112,
					resolutiony: 112,
				},
				{
					type: 'lcd',
					id: 0x08,
					row: 1,
					column: 2,
					name: 'LCD 8',
					resolutionx: 112,
					resolutiony: 112,
				},
				{
					type: 'lcd',
					id: 0x09,
					row: 1,
					column: 3,
					name: 'LCD 9',
					resolutionx: 112,
					resolutiony: 112,
				},
				{
					type: 'lcd',
					id: 0x0a,
					row: 1,
					column: 4,
					name: 'LCD 10',
					resolutionx: 112,
					resolutiony: 112,
				},
				{
					type: 'lcd',
					id: 0x01,
					row: 2,
					column: 0,
					name: 'LCD 11',
					resolutionx: 112,
					resolutiony: 112,
				},
				{
					type: 'lcd',
					id: 0x02,
					row: 2,
					column: 1,
					name: 'LCD 12',
					resolutionx: 112,
					resolutiony: 112,
				},
				{
					type: 'lcd',
					id: 0x03,
					row: 2,
					column: 2,
					name: 'LCD 13',
					resolutionx: 112,
					resolutiony: 112,
				},
				{
					type: 'lcd',
					id: 0x04,
					row: 2,
					column: 3,
					name: 'LCD 14',
					resolutionx: 112,
					resolutiony: 112,
				},
				{
					type: 'lcd',
					id: 0x05,
					row: 2,
					column: 4,
					name: 'LCD 15',
					resolutionx: 112,
					resolutiony: 112,
				},
			],
		},
		'N4-1234': {
			productName: 'Stream Dock N4',
			pid: 0x1002,
			inputs: [
				{
					type: 'button',
					id: 0x01,
					row: 0,
					column: 0,
					name: 'Button 1',
				},
				{
					type: 'button',
					id: 0x02,
					row: 0,
					column: 1,
					name: 'Button 2',
				},
				{
					type: 'button',
					id: 0x03,
					row: 0,
					column: 2,
					name: 'Button 3',
				},
				{
					type: 'button',
					id: 0x04,
					row: 0,
					column: 3,
					name: 'Button 4',
				},
				{
					type: 'button',
					id: 0x05,
					row: 0,
					column: 4,
					name: 'Button 5',
				},
				{
					type: 'button',
					id: 0x06,
					row: 1,
					column: 0,
					name: 'Button 6',
				},
				{
					type: 'button',
					id: 0x07,
					row: 1,
					column: 1,
					name: 'Button 7',
				},
				{
					type: 'button',
					id: 0x08,
					row: 1,
					column: 2,
					name: 'Button 8',
				},
				{
					type: 'button',
					id: 0x09,
					row: 1,
					column: 3,
					name: 'Button 9',
				},
				{
					type: 'button',
					id: 0x0a,
					row: 1,
					column: 4,
					name: 'Button 10',
				},
				{
					type: 'push',
					id: 0x40,
					row: 2,
					column: 0,
					name: 'Softbutton 1',
				},
				{
					type: 'push',
					id: 0x41,
					row: 2,
					column: 1,
					name: 'Softbutton 2',
				},
				{
					type: 'push',
					id: 0x42,
					row: 2,
					column: 2,
					name: 'Softbutton 3',
				},
				{
					type: 'push',
					id: 0x43,
					row: 2,
					column: 3,
					name: 'Softbutton 4',
				},
				{
					type: 'push',
					id: 0x37,
					row: 3,
					column: 0,
					name: 'Rotary encoder 1',
				},
				{
					type: 'rotateLeft',
					id: 0xa0,
					row: 3,
					column: 0,
					name: 'Rotary encoder 1',
				},
				{
					type: 'rotateRight',
					id: 0xa1,
					row: 3,
					column: 0,
					name: 'Rotary encoder 1',
				},
				{
					type: 'push',
					id: 0x35,
					row: 3,
					column: 1,
					name: 'Rotary encoder 2',
				},
				{
					type: 'rotateLeft',
					id: 0x50,
					row: 3,
					column: 1,
					name: 'Rotary encoder 2',
				},
				{
					type: 'rotateRight',
					id: 0x51,
					row: 3,
					column: 1,
					name: 'Rotary encoder 2',
				},
				{
					type: 'push',
					id: 0x33,
					row: 3,
					column: 2,
					name: 'Rotary encoder 3',
				},
				{
					type: 'rotateLeft',
					id: 0x90,
					row: 3,
					column: 2,
					name: 'Rotary encoder 3',
				},
				{
					type: 'rotateRight',
					id: 0x91,
					row: 3,
					column: 2,
					name: 'Rotary encoder 3',
				},
				{
					type: 'push',
					id: 0x36,
					row: 3,
					column: 3,
					name: 'Rotary encoder 4',
				},
				{
					type: 'rotateLeft',
					id: 0x70,
					row: 3,
					column: 3,
					name: 'Rotary encoder 3',
				},
				{
					type: 'rotateRight',
					id: 0x71,
					row: 3,
					column: 3,
					name: 'Rotary encoder 3',
				},
				{
					type: 'swipeLeft',
					id: 0x38,
					row: 2,
					column: 4,
					name: 'LCD Strip',
				},
				{
					type: 'swipeRight',
					id: 0x39,
					row: 2,
					column: 4,
					name: 'LCD Strip',
				},
			],
			outputs: [
				{
					type: 'lcd',
					id: 0x0b,
					row: 0,
					column: 0,
					name: 'LCD 1',
					resolutionx: 112,
					resolutiony: 112,
				},
				{
					type: 'lcd',
					id: 0x0c,
					row: 0,
					column: 1,
					name: 'LCD 2',
					resolutionx: 112,
					resolutiony: 112,
				},
				{
					type: 'lcd',
					id: 0x0d,
					row: 0,
					column: 2,
					name: 'LCD 3',
					resolutionx: 112,
					resolutiony: 112,
				},
				{
					type: 'lcd',
					id: 0x0e,
					row: 0,
					column: 3,
					name: 'LCD 4',
					resolutionx: 112,
					resolutiony: 112,
				},
				{
					type: 'lcd',
					id: 0x0f,
					row: 0,
					column: 4,
					name: 'LCD 5',
					resolutionx: 112,
					resolutiony: 112,
				},
				{
					type: 'lcd',
					id: 0x06,
					row: 1,
					column: 0,
					name: 'LCD 6',
					resolutionx: 112,
					resolutiony: 112,
				},
				{
					type: 'lcd',
					id: 0x07,
					row: 1,
					column: 1,
					name: 'LCD 7',
					resolutionx: 112,
					resolutiony: 112,
				},
				{
					type: 'lcd',
					id: 0x08,
					row: 1,
					column: 2,
					name: 'LCD 8',
					resolutionx: 112,
					resolutiony: 112,
				},
				{
					type: 'lcd',
					id: 0x09,
					row: 1,
					column: 3,
					name: 'LCD 9',
					resolutionx: 112,
					resolutiony: 112,
				},
				{
					type: 'lcd',
					id: 0x0a,
					row: 1,
					column: 4,
					name: 'LCD 10',
					resolutionx: 112,
					resolutiony: 112,
				},
				{
					type: 'lcd',
					id: 0x01,
					row: 2,
					column: 0,
					name: 'Strip 1',
					resolutionx: 176,
					resolutiony: 124,
				},
				{
					type: 'lcd',
					id: 0x02,
					row: 2,
					column: 1,
					name: 'Strip 2',
					resolutionx: 176,
					resolutiony: 124,
				},
				{
					type: 'lcd',
					id: 0x03,
					row: 2,
					column: 2,
					name: 'Strip 3',
					resolutionx: 176,
					resolutiony: 124,
				},
				{
					type: 'lcd',
					id: 0x04,
					row: 2,
					column: 3,
					name: 'Strip 4',
					resolutionx: 176,
					resolutiony: 124,
				},
			],
		},
		'N4-1245': {
			productName: 'Stream Dock N4',
			pid: 0x1002,
			inputs: [
				{
					type: 'button',
					id: 0x01,
					row: 0,
					column: 0,
					name: 'Button 1',
				},
				{
					type: 'button',
					id: 0x02,
					row: 0,
					column: 1,
					name: 'Button 2',
				},
				{
					type: 'button',
					id: 0x03,
					row: 0,
					column: 2,
					name: 'Button 3',
				},
				{
					type: 'button',
					id: 0x04,
					row: 0,
					column: 3,
					name: 'Button 4',
				},
				{
					type: 'button',
					id: 0x05,
					row: 0,
					column: 4,
					name: 'Button 5',
				},
				{
					type: 'button',
					id: 0x06,
					row: 1,
					column: 0,
					name: 'Button 6',
				},
				{
					type: 'button',
					id: 0x07,
					row: 1,
					column: 1,
					name: 'Button 7',
				},
				{
					type: 'button',
					id: 0x08,
					row: 1,
					column: 2,
					name: 'Button 8',
				},
				{
					type: 'button',
					id: 0x09,
					row: 1,
					column: 3,
					name: 'Button 9',
				},
				{
					type: 'button',
					id: 0x0a,
					row: 1,
					column: 4,
					name: 'Button 10',
				},
				{
					type: 'push',
					id: 0x40,
					row: 2,
					column: 0,
					name: 'Softbutton 1',
				},
				{
					type: 'push',
					id: 0x41,
					row: 2,
					column: 1,
					name: 'Softbutton 2',
				},
				{
					type: 'push',
					id: 0x42,
					row: 2,
					column: 3,
					name: 'Softbutton 3',
				},
				{
					type: 'push',
					id: 0x43,
					row: 2,
					column: 4,
					name: 'Softbutton 4',
				},
				{
					type: 'push',
					id: 0x37,
					row: 3,
					column: 0,
					name: 'Rotary encoder 1',
				},
				{
					type: 'rotateLeft',
					id: 0xa0,
					row: 3,
					column: 0,
					name: 'Rotary encoder 1',
				},
				{
					type: 'rotateRight',
					id: 0xa1,
					row: 3,
					column: 0,
					name: 'Rotary encoder 1',
				},
				{
					type: 'push',
					id: 0x35,
					row: 3,
					column: 1,
					name: 'Rotary encoder 2',
				},
				{
					type: 'rotateLeft',
					id: 0x50,
					row: 3,
					column: 1,
					name: 'Rotary encoder 2',
				},
				{
					type: 'rotateRight',
					id: 0x51,
					row: 3,
					column: 1,
					name: 'Rotary encoder 2',
				},
				{
					type: 'push',
					id: 0x33,
					row: 3,
					column: 3,
					name: 'Rotary encoder 3',
				},
				{
					type: 'rotateLeft',
					id: 0x90,
					row: 3,
					column: 3,
					name: 'Rotary encoder 3',
				},
				{
					type: 'rotateRight',
					id: 0x91,
					row: 3,
					column: 3,
					name: 'Rotary encoder 3',
				},
				{
					type: 'push',
					id: 0x36,
					row: 3,
					column: 4,
					name: 'Rotary encoder 4',
				},
				{
					type: 'rotateLeft',
					id: 0x70,
					row: 3,
					column: 4,
					name: 'Rotary encoder 3',
				},
				{
					type: 'rotateRight',
					id: 0x71,
					row: 3,
					column: 4,
					name: 'Rotary encoder 3',
				},
				{
					type: 'swipeLeft',
					id: 0x38,
					row: 2,
					column: 2,
					name: 'LCD Strip',
				},
				{
					type: 'swipeRight',
					id: 0x39,
					row: 2,
					column: 2,
					name: 'LCD Strip',
				},
			],
			outputs: [
				{
					type: 'lcd',
					id: 0x0b,
					row: 0,
					column: 0,
					name: 'LCD 1',
					resolutionx: 112,
					resolutiony: 112,
				},
				{
					type: 'lcd',
					id: 0x0c,
					row: 0,
					column: 1,
					name: 'LCD 2',
					resolutionx: 112,
					resolutiony: 112,
				},
				{
					type: 'lcd',
					id: 0x0d,
					row: 0,
					column: 2,
					name: 'LCD 3',
					resolutionx: 112,
					resolutiony: 112,
				},
				{
					type: 'lcd',
					id: 0x0e,
					row: 0,
					column: 3,
					name: 'LCD 4',
					resolutionx: 112,
					resolutiony: 112,
				},
				{
					type: 'lcd',
					id: 0x0f,
					row: 0,
					column: 4,
					name: 'LCD 5',
					resolutionx: 112,
					resolutiony: 112,
				},
				{
					type: 'lcd',
					id: 0x06,
					row: 1,
					column: 0,
					name: 'LCD 6',
					resolutionx: 112,
					resolutiony: 112,
				},
				{
					type: 'lcd',
					id: 0x07,
					row: 1,
					column: 1,
					name: 'LCD 7',
					resolutionx: 112,
					resolutiony: 112,
				},
				{
					type: 'lcd',
					id: 0x08,
					row: 1,
					column: 2,
					name: 'LCD 8',
					resolutionx: 112,
					resolutiony: 112,
				},
				{
					type: 'lcd',
					id: 0x09,
					row: 1,
					column: 3,
					name: 'LCD 9',
					resolutionx: 112,
					resolutiony: 112,
				},
				{
					type: 'lcd',
					id: 0x0a,
					row: 1,
					column: 4,
					name: 'LCD 10',
					resolutionx: 112,
					resolutiony: 112,
				},
				{
					type: 'lcd',
					id: 0x01,
					row: 2,
					column: 0,
					name: 'Strip 1',
					resolutionx: 176,
					resolutiony: 124,
				},
				{
					type: 'lcd',
					id: 0x02,
					row: 2,
					column: 1,
					name: 'Strip 2',
					resolutionx: 176,
					resolutiony: 124,
				},
				{
					type: 'lcd',
					id: 0x03,
					row: 2,
					column: 3,
					name: 'Strip 3',
					resolutionx: 176,
					resolutiony: 124,
				},
				{
					type: 'lcd',
					id: 0x04,
					row: 2,
					column: 4,
					name: 'Strip 4',
					resolutionx: 176,
					resolutiony: 124,
				},
			],
		},
	}

	private static cmdPrefix = [0x43, 0x52, 0x54, 0, 0]
	private static packetSize = 1024

	private info: Device
	private device: HIDAsync
	private model: StreamDockModelDefinition = { productName: 'Unknown Stream Dock', inputs: [], outputs: [] }

	constructor(deviceInfo: Device, device: HIDAsync) {
		super()

		this.info = deviceInfo
		this.device = device

		this.device.on('error', (error) => {
			console.error(`Stream Dock Error: ${error}`)
			this.emit('error', error)
		})

		if (this.info.productId === 0x1005 || this.info.productId === 0x1006) {
			// modelType = '293V3'
			this.model = StreamDock.models['293V3']
		} else if (this.info.productId === 0x1001 || this.info.productId === 0x1007) {
			// modelType = 'N4'
			this.model = StreamDock.models['N4-1234']
		} else {
			// this.modelType = 'Unknown'
			this.emit('remove')
		}

		this.device.on('data', (data) => {
			// console.log(`received data ${Array.from(data).slice(0,16).map(d => (d as number).toString(16))}`)
			if (data.length >= 11) {
				const functionRaw = data[9]
				const parameterRaw = data[10]

				const action = this.model.inputs.find((input) => {
					return input.id === functionRaw
				})

				if (action) {
					if (action.type === 'button') {
						if (parameterRaw === 0x00) {
							this.emit('up', action)
						} else {
							this.emit('down', action)
						}
					} else if (action.type === 'push') {
						this.emit('push', action)
					} else if (action.type === 'rotateLeft') {
						this.emit('rotate', action, -1)
					} else if (action.type === 'rotateRight') {
						this.emit('rotate', action, 1)
					} else if (action.type === 'swipeLeft') {
						this.emit('rotate', action, -1)
					} else if (action.type === 'swipeRight') {
						this.emit('rotate', action, 1)
					} else {
						console.error(`Unknown action received: ${parameterRaw} from ${this.info.path}`)
					}
				}
			}
		})
	}

	/**
	 * Sends a command to the device async
	 *
	 * The command will be packetized in packages of packetSize bytes. Smaller commands are zero-padded, larger commands are chunked. The packets might be written interrupted by other writes.
	 * @param data the data to be sent
	 * @param prefix optional prefix. If not set, the default prefix will be used
	 */
	async sendCmd(data: Buffer | Array<number>, prefix = StreamDock.cmdPrefix) {
		if (!Buffer.isBuffer(data)) {
			data = Buffer.from(data)
		}

		const prefixbuffer = Buffer.from(prefix)
		// const writebuffer = Buffer.concat([prefixbuffer, data], StreamDock.packetSize)
		const writebuffer = Buffer.concat([Buffer.from([0]), prefixbuffer, data], StreamDock.packetSize + 1)

		// if (writebuffer.byteLength != StreamDock.packetSize) {
		if (writebuffer.byteLength != StreamDock.packetSize + 1) {
			console.error(
				`Data length problem while sending packet to stream dock. Should be ${StreamDock.packetSize}B, but is ${writebuffer.byteLength}B. Payload size is ${data.length}B and prefix is [${prefix.join(',')}] `
			)
		}
		await this.writeRaw(writebuffer).catch((e) => {
			throw new Error('Sending command to Stream Dock failed ' + e)
		})

		if (data.byteLength + prefixbuffer.byteLength > StreamDock.packetSize) {
			const remain = data.subarray(StreamDock.packetSize - prefixbuffer.byteLength)
			await this.sendCmd(remain, []).catch((e) => {
				console.error('Sending remaining data to Stream Dock failed ' + e)
			})
		}
	}

	/**
	 * Sends a command to the device sync
	 *
	 * The command will be packetized in packages of packetSize bytes. Smaller commands are zero-padded, larger commands are chunked.
	 * @param data the data to be sent
	 * @param prefix optional prefix. If not set, the default prefix will be used
	 */
	async sendCmdSync(data: Buffer | Array<number>, prefix = StreamDock.cmdPrefix): Promise<void> {
		if (!Buffer.isBuffer(data)) {
			data = Buffer.from(data)
		}

		const prefixbuffer = Buffer.from(prefix)
		// const writebuffer = Buffer.concat([prefixbuffer, data], StreamDock.packetSize)
		const writebuffer = Buffer.concat([Buffer.from([0]), prefixbuffer, data], StreamDock.packetSize + 1)

		// if (writebuffer.byteLength != StreamDock.packetSize) {
		if (writebuffer.byteLength != StreamDock.packetSize + 1) {
			console.error(
				`Data length problem while sending packet to stream dock. Should be ${StreamDock.packetSize}B, but is ${writebuffer.byteLength}B. Payload size is ${data.length}B and prefix is [${prefix.join(',')}] `
			)
		}
		let sendpr: Promise<void> | undefined
		const writepr = this.writeRaw(writebuffer)

		if (data.byteLength + prefixbuffer.byteLength > StreamDock.packetSize) {
			const remain = data.subarray(StreamDock.packetSize - prefixbuffer.byteLength)
			sendpr = this.sendCmdSync(remain, [])
		}

		if (sendpr instanceof Promise) {
			return sendpr
		}

		if (writepr instanceof Promise) {
			return writepr
		}

		throw new Error('Unknown error during sync send')
	}

	/**
	 * Sets the different layout variations of the stream dock N4
	 * @param layout
	 */
	setLayout(layout: '1234' | '1245') {
		if (this.model?.productName === 'Stream Dock N4') {
			const newmodel = StreamDock.models[`N4-${layout}`]
			if (newmodel !== undefined) {
				this.model = newmodel
			}
		}
	}

	get serialNumber() {
		return this.info.serialNumber
	}

	get productName() {
		return this.model.productName ?? 'Unknown'
	}

	/**
	 * The amount of columns found in the surface
	 */
	get columns() {
		return (
			Math.max(
				...this.model.inputs.map((input) => input.column),
				...this.model.outputs.map((output) => output.column)
			) + 1
		)
	}

	/**
	 * The amount of rows found in the surface
	 */
	get rows() {
		return (
			Math.max(...this.model.inputs.map((input) => input.row), ...this.model.outputs.map((output) => output.row)) + 1
		)
	}

	get outputs() {
		return this.model.outputs
	}

	async writeRaw(data: Buffer | Array<number>): Promise<void> {
		const written = await this.device.write(data).catch(() => {
			throw new Error('Write to Stream Dock failed!')
		})
		if (typeof written === 'number' && written !== data.length) {
			throw new Error('Write to Stream Dock failed')
		}
	}

	async wakeScreen() {
		await this.sendCmd([0x44, 0x49, 0x53]).catch((e) => {
			console.error('Sending wake screen to Stream Dock failed ' + e)
		})
	}

	async clearPanel() {
		await this.sendCmd([0x43, 0x4c, 0x45, 0, 0, 0, 0xff]).catch((e) => {
			console.error('Sending clear panel to Stream Dock failed ' + e)
		})
	}

	async refresh() {
		await this.sendCmd([0x53, 0x54, 0x50]).catch((e) => {
			console.error('Sending refresh to Stream Dock failed ' + e)
		})
	}

	async setBrightness(value: number) {
		const clamped = Math.max(Math.min(value, 100), 0)
		const y = Math.pow(clamped / 100, 0.75)

		const brightness = Math.round(y * 100)

		await this.sendCmd([0x4c, 0x49, 0x47, 0, 0, brightness]).catch((e) => {
			console.error('Sending brightness to Stream Dock failed ' + e)
		})
	}

	async setKeyImage(column: number, row: number, imageBuffer: Buffer) {
		const output = this.outputs.find((output) => output.row === row && output.column === column)

		if (!output) return

		// console.log('sending image', column, row, output.id)

		let imgData: Buffer = Buffer.from([])
		let size = 0xffffff
		let quality: number

		for (quality = 90; quality > 11; quality -= 10) {
			// 90% quality will fit almost all images in the 10k limit
			const options = {
				format: jpg.FORMAT_RGB,
				width: output.resolutionx,
				height: output.resolutiony,
				subsampling: jpg.SAMP_422,
				quality,
			}

			try {
				imgData = jpg.compressSync(imageBuffer, options)
			} catch (error) {
				console.error(`compressing jpg at position ${row}/${column} failed`, error)
			}

			// console.log('imgData', Array.from(imgData).map(d => d.toString(16).padStart(2, '0')).join(' '))

			size = imgData.byteLength
			if (size <= 10240) break
		}

		if (size > 10240) {
			imgData = imgData.subarray(0, 10240)
			console.error(
				`Streamdock image at position ${row}/${column} could not be compressed to 10KB or less, truncating to 10KB`
			)
		}

		// console.log(`image ${row}/${column} size ${size}B compression ${quality}%`)

		this.sendCmdSync([
			0x42,
			0x41,
			0x54,
			(size >> 24) & 0xff,
			(size >> 16) & 0xff,
			(size >> 8) & 0xff,
			size & 0xff,
			output.id,
		]).catch((e) => {
			console.error('Sending set image command to Stream Dock failed ' + e)
		})
		this.sendCmdSync(imgData, []).catch((e) => {
			console.error('Sending image data to Stream Dock failed ' + e)
		})
		await this.refresh()
	}

	async clearKeyImage(keyId: number) {
		await this.sendCmd([0x43, 0x4c, 0x45, 0, 0, 0, keyId]).catch((e) => {
			console.error('Sending clear key image to Stream Dock failed ' + e)
		})
	}

	async sendHeartbeat() {
		await this.sendCmd([0x43, 0x4f, 0x4e, 0x4e, 0x45, 0x43, 0x54]).catch((e) => {
			console.error('Sending heartbeat to Stream Dock failed ' + e)
		})
	}

	async close() {
		await this.sendCmd([0x43, 0x4c, 0x45, 0, 0, 0x44, 0x43]).catch((e) => {
			console.error('Sending close to Stream Dock failed ' + e)
		})
		await this.device.close()
	}
}

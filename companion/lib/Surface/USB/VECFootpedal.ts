/*
 * This file is part of the Companion project
 * Copyright (c) 2024 Peter Newman
 * Author: Peter Newman
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 */

import EventEmitter from 'events'
import LogController, { Logger } from '../../Log/Controller.js'
import { LockConfigFields, OffsetConfigFields, RotationConfigField } from '../CommonConfigFields.js'
import type { CompanionSurfaceConfigField, GridSize } from '@companion-app/shared/Model/Surfaces.js'
import type { SurfacePanel, SurfacePanelEvents, SurfacePanelInfo } from '../Types.js'
import { Device, HIDAsync } from 'node-hid'
import crypto from 'crypto'

const configFields: CompanionSurfaceConfigField[] = [
	//
	...OffsetConfigFields,
	RotationConfigField,
	...LockConfigFields,
]

export function isVecFootpedal(device: Device): boolean {
	return device.vendorId === 0x05f3 && device.productId === 0x00ff
}

export class SurfaceUSBVECFootpedal extends EventEmitter<SurfacePanelEvents> implements SurfacePanel {
	readonly #logger: Logger

	config: Record<string, any>

	readonly info: SurfacePanelInfo
	readonly gridSize: GridSize

	readonly #hidDevice: HIDAsync

	constructor(devicePath: string, hidDevice: HIDAsync, info: Device) {
		super()

		this.#logger = LogController.createLogger(`Surface/USB/VECFootpedal/${devicePath}`)

		const fakeSerial = crypto
			.createHash('md5')
			.update(info.serialNumber || devicePath)
			.digest('hex')

		this.#hidDevice = hidDevice

		this.config = {
			// No config currently present
		}

		this.#logger.debug(`Adding VEC Footpedal USB device ${devicePath}`)

		this.info = {
			type: `VEC Footpedal`,
			devicePath: devicePath,
			configFields: configFields,
			deviceId: `vecfootpedal:${fakeSerial}`,
		}

		this.gridSize = {
			columns: 3,
			rows: 1,
		}

		this.#hidDevice.on('error', (error) => {
			console.error(error)
			this.emit('remove')
		})

		const buttonState: boolean[] = new Array(3).fill(false)
		const buttonMasks = [0x0001, 0x0002, 0x0004]

		this.#hidDevice.on('data', (data: Buffer) => {
			if (data.length !== 2) return

			const buttonsRaw = data.readUint16LE()

			// Treat buttons a little differently. Need to do button up and button down events
			buttonMasks.forEach((mask, index) => {
				const button = buttonsRaw & mask
				if (button && !buttonState[index]) {
					this.emit('click', index, 0, true)
				} else if (!button && buttonState[index]) {
					this.emit('click', index, 0, false)
				}
				buttonState[index] = button > 0
			})
		})
	}

	/**
	 * Open a VEC Footpedal
	 */
	static async create(devicePath: string): Promise<SurfaceUSBVECFootpedal> {
		let hidDevice: HIDAsync | undefined

		try {
			hidDevice = await HIDAsync.open(devicePath)
			if (!hidDevice) throw new Error('Failed to open device')

			const info = await hidDevice.getDeviceInfo()

			const self = new SurfaceUSBVECFootpedal(devicePath, hidDevice, info)

			return self
		} catch (e) {
			hidDevice?.close().catch(() => null)

			throw e
		}
	}

	/**
	 * Process the information from the GUI and what is saved in database
	 */
	setConfig(config: Record<string, any>, _force = false): void {
		// No config currently present
		this.config = config
	}

	quit(): void {
		this.#hidDevice.close().catch(() => null)
	}

	draw(): void {
		// Not relevant for this device
	}

	clearDeck(): void {
		// Not relevant for this device
	}
}

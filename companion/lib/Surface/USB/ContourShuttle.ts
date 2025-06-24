/*
 * This file is part of the Companion project
 * Copyright (c) 2023 Peter Newman
 * Author: Peter Newman
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 */

import EventEmitter from 'events'
import { Shuttle, setupShuttle, ProductModelId } from 'shuttle-node'
import LogController, { Logger } from '../../Log/Controller.js'
import { LockConfigFields, OffsetConfigFields, RotationConfigField } from '../CommonConfigFields.js'
import type { CompanionSurfaceConfigField, GridSize } from '@companion-app/shared/Model/Surfaces.js'
import type { SurfacePanel, SurfacePanelEvents, SurfacePanelInfo } from '../Types.js'
import { assertNever } from '@companion-app/shared/Util.js'

interface ShuttleModelInfo {
	totalCols: number
	totalRows: number
	jog: [number, number]
	shuttle: [number, number]
	buttons: [number, number][]
}

const contourShuttleXpressInfo: ShuttleModelInfo = {
	// Treat as:
	// 3 buttons
	// button, two encoders (jog and shuttle), button
	// Map the encoders in the same position (but a different row) for consistency and compatibility
	totalCols: 4,
	totalRows: 2,

	// TODO(Someone with hardware): This mapping is guesswork and hasn't been tested
	jog: [1, 1],
	shuttle: [2, 1],
	buttons: [
		[0, 1],
		[0, 0],
		[1, 0],
		[2, 0],
		[3, 0],
		[3, 1],
	],
}
const contourShuttleProV1Info: ShuttleModelInfo = {
	// Same as Pro V2 only without the buttons either side of the encoders
	// Map the same for consistency and compatibility
	totalCols: 5,
	totalRows: 4,

	jog: [1, 2],
	shuttle: [2, 2],
	buttons: [
		// 4 buttons
		[0, 0],
		[1, 0],
		[2, 0],
		[3, 0],

		// 5 buttons
		[0, 1],
		[1, 1],
		[2, 1],
		[3, 1],
		[4, 1],

		// 2 buttons (combine with below)
		[0, 3],
		[3, 3],

		// 2 buttons
		[1, 3],
		[2, 3],
	],
}
const contourShuttleProV2Info: ShuttleModelInfo = {
	// 4 buttons
	// 5 buttons
	// button, two encoders (jog and shuttle), button
	// 2 buttons (combine with the row below)
	// 2 buttons
	totalCols: 5,
	totalRows: 4,

	jog: [1, 2],
	shuttle: [2, 2],
	buttons: [
		// 4 buttons
		[0, 0],
		[1, 0],
		[2, 0],
		[3, 0],

		// 5 buttons
		[0, 1],
		[1, 1],
		[2, 1],
		[3, 1],
		[4, 1],

		// 2 buttons (combine with below)
		[0, 3],
		[3, 3],

		// 2 buttons
		[1, 3],
		[2, 3],

		// 2 buttons either side of encoder
		[0, 2],
		[3, 2],
	],
}

function buttonToXy(modelInfo: ShuttleModelInfo, info: number): [number, number] | undefined {
	return modelInfo.buttons[info]
}

const configFields: CompanionSurfaceConfigField[] = [
	//
	...OffsetConfigFields,
	RotationConfigField,
	...LockConfigFields,
]

export class SurfaceUSBContourShuttle extends EventEmitter<SurfacePanelEvents> implements SurfacePanel {
	readonly #logger: Logger

	private readonly contourShuttle: Shuttle
	private readonly modelInfo: ShuttleModelInfo

	config: Record<string, any>

	readonly info: SurfacePanelInfo
	readonly gridSize: GridSize

	private static devices = new Set<string>() // ids of currently-attached devices
	private static makeDeviceId(devname: string): string {
		// this function ensures we don't assign the same id twice.
		// for example with two devices, if user unplugs dev1 and replugs it, then
		//   if we were simply tracking the number of devices, both devices would be assigned "dev2"
		//  This code will reassign "dev1" instead...
		let n = 1
		while (true) {
			const deviceId = `contourshuttle:${devname}-dev${n++}`
			if (!SurfaceUSBContourShuttle.devices.has(deviceId)) {
				SurfaceUSBContourShuttle.devices.add(deviceId)
				return deviceId
			}
		}
	}

	constructor(devicePath: string, contourShuttle: Shuttle, modelInfo: ShuttleModelInfo) {
		super()

		this.#logger = LogController.createLogger(`Surface/USB/ContourShuttle/${devicePath}`)

		this.contourShuttle = contourShuttle
		this.modelInfo = modelInfo

		this.config = {
			// No config currently present
		}

		this.#logger.debug(`Adding Contour Shuttle USB device ${devicePath}`)

		// The devices don't have serialnumbers, so assign device IDs serially
		const fakeDeviceId = SurfaceUSBContourShuttle.makeDeviceId(contourShuttle.info.productModelId)

		this.info = {
			type: `Contour Shuttle ${contourShuttle.info.name}`,
			devicePath: devicePath,
			configFields: configFields,
			deviceId: fakeDeviceId,
		}

		this.gridSize = {
			columns: this.modelInfo.totalCols,
			rows: this.modelInfo.totalRows,
		}

		this.contourShuttle.on('error', (error) => {
			console.error(error)
			this.emit('remove')
		})

		this.contourShuttle.on('down', (info) => {
			const xy = buttonToXy(this.modelInfo, info)
			if (xy === undefined) {
				return
			}

			this.emit('click', ...xy, true)
		})

		this.contourShuttle.on('up', (info) => {
			const xy = buttonToXy(this.modelInfo, info)
			if (xy === undefined) {
				return
			}

			this.emit('click', ...xy, false)
		})

		this.contourShuttle.on('jog', (delta) => {
			const xy = this.modelInfo.jog
			if (xy === undefined) {
				return
			}

			console.log(`Jog position has changed`, delta)
			this.emit('setVariable', 'jog', delta)
			setTimeout(() => {
				this.emit('setVariable', 'jog', 0)
			}, 20)

			this.emit('rotate', ...xy, delta == 1)
		})

		let lastShuttle = 0
		this.contourShuttle.on('shuttle', (shuttle) => {
			const xy = this.modelInfo.shuttle
			if (xy === undefined) {
				return
			}

			this.emit('setVariable', 'shuttle', shuttle)

			this.emit('rotate', ...xy, lastShuttle < shuttle)
			lastShuttle = shuttle
		})

		this.contourShuttle.on('disconnected', () => {
			this.emit('remove')
		})
	}

	/**
	 * Open a countour shuttle
	 */
	static async create(devicePath: string): Promise<SurfaceUSBContourShuttle> {
		const contourShuttle = await setupShuttle(devicePath)

		try {
			let info: ShuttleModelInfo

			switch (contourShuttle.info.productModelId) {
				case ProductModelId.ShuttleXpress:
					info = contourShuttleXpressInfo
					break
				case ProductModelId.ShuttleProV1:
					info = contourShuttleProV1Info
					break
				case ProductModelId.ShuttleProV2:
					info = contourShuttleProV2Info
					break
				default:
					assertNever(contourShuttle.info.productModelId)
					throw new Error(`Unknown Contour Shuttle device detected: ${contourShuttle.info.name}`)
			}

			const self = new SurfaceUSBContourShuttle(devicePath, contourShuttle, info)

			return self
		} catch (e) {
			await contourShuttle.close()

			throw e
		}
	}

	/**
	 * Process the information from the GUI and what is saved in database
	 * @returns false when nothing happens
	 */
	setConfig(config: Record<string, any>, _force = false): void {
		// No config currently present
		this.config = config
	}

	quit(): void {
		SurfaceUSBContourShuttle.devices.delete(this.info.deviceId)
		this.contourShuttle.close().catch((e) => {
			this.#logger.error(`Failed to close contour shuttle: ${e}`)
		})
	}

	draw(): void {
		// Should never be fired
	}

	clearDeck(): void {
		// Not relevant for this device
	}
}

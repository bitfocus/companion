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
import vecFootpedal, { VecFootpedalDeviceInfo } from 'vec-footpedal'
import LogController, { Logger } from '../../Log/Controller.js'
import { LockConfigFields, OffsetConfigFields, RotationConfigField } from '../CommonConfigFields.js'
import type { CompanionSurfaceConfigField, GridSize } from '@companion-app/shared/Model/Surfaces.js'
import type { SurfacePanel, SurfacePanelEvents, SurfacePanelInfo } from '../Types.js'

type XYValue = [x: number, y: number]
interface ModelInfo {
	totalCols: number
	totalRows: number
	buttons: XYValue[]
}

const vecFootpedalInfo: ModelInfo = {
	// Treat as:
	// 3 buttons
	totalCols: 3,
	totalRows: 1,

	buttons: [
		[0, 0],
		[1, 0],
		[2, 0],
	],
}

function buttonToXy(modelInfo: ModelInfo, info: number): XYValue | undefined {
	return modelInfo.buttons[info - 1]
}

const configFields: CompanionSurfaceConfigField[] = [
	//
	...OffsetConfigFields,
	RotationConfigField,
	...LockConfigFields,
]

export class SurfaceUSBVECFootpedal extends EventEmitter<SurfacePanelEvents> implements SurfacePanel {
	readonly #logger: Logger

	config: Record<string, any>

	readonly info: SurfacePanelInfo
	readonly gridSize: GridSize

	readonly #vecFootpedal: typeof vecFootpedal
	readonly #deviceInfo: VecFootpedalDeviceInfo
	readonly #modelInfo: ModelInfo

	constructor(
		devicePath: string,
		device: typeof vecFootpedal,
		modelInfo: ModelInfo,
		deviceInfo: VecFootpedalDeviceInfo
	) {
		super()

		this.#logger = LogController.createLogger(`Surface/USB/VECFootpedal/${devicePath}`)

		this.#vecFootpedal = device
		this.#deviceInfo = deviceInfo
		this.#modelInfo = modelInfo

		this.config = {
			// No config currently present
		}

		this.#logger.debug(`Adding VEC Footpedal USB device ${devicePath}`)

		this.info = {
			type: `VEC Footpedal ${this.#deviceInfo.name}`,
			devicePath: devicePath,
			configFields: configFields,
			deviceId: `vecfootpedal:${this.#deviceInfo.id}`,
		}

		this.gridSize = {
			columns: this.#modelInfo.totalCols,
			rows: this.#modelInfo.totalRows,
		}

		this.#vecFootpedal.on('error', (error) => {
			console.error(error)
			this.emit('remove')
		})

		this.#vecFootpedal.on('buttondown', (info) => {
			const xy = buttonToXy(this.#modelInfo, info)
			if (xy === undefined) {
				return
			}

			this.emit('click', ...xy, true)
		})

		this.#vecFootpedal.on('buttonup', (info) => {
			const xy = buttonToXy(this.#modelInfo, info)
			if (xy === undefined) {
				return
			}

			this.emit('click', ...xy, false)
		})

		this.#vecFootpedal.on('disconnected', (error) => {
			console.error(error)
			this.emit('remove')
		})
	}

	/**
	 * Open a VEC Footpedal
	 */
	static async create(devicePath: string): Promise<SurfaceUSBVECFootpedal> {
		const pedal = vecFootpedal
		// We're doing device search via Companion so don't run it here too
		pedal.start(false)
		try {
			let deviceInfo: VecFootpedalDeviceInfo | undefined = undefined
			let info = null
			pedal.connect(devicePath)
			deviceInfo = pedal.getDeviceByPath(devicePath)
			if (!deviceInfo) throw new Error('Device not found!')

			switch (deviceInfo.name) {
				case 'VEC Footpedal':
					info = vecFootpedalInfo
					break
				default:
					throw new Error(`Unknown VEC Footpedal device detected: ${deviceInfo.name}`)
			}
			if (!info) {
				throw new Error('Unsupported model')
			}

			const self = new SurfaceUSBVECFootpedal(devicePath, pedal, info, deviceInfo)

			return self
		} catch (e) {
			pedal.stop()

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

	quit() {
		this.#vecFootpedal.stop()
	}

	draw() {
		// Should never be fired
	}

	clearDeck() {
		// Not relevant for this device
	}
}

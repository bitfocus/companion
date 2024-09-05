// @ts-nocheck
/*
 * This file is part of the Companion project
 * Copyright (c) 2024 Peter Newman
 * Author: Peter Newman
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

import EventEmitter from 'events'
import vecFootpedal from 'vec-footpedal'
import LogController from '../../Log/Controller.js'
import { LockConfigFields, OffsetConfigFields, RotationConfigField } from '../CommonConfigFields.js'

const vecFootpedalInfo = {
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

function buttonToXy(modelInfo, info) {
	return modelInfo.buttons[info - 1]
}

/**
 * @type {import('@companion-app/shared/Model/Surfaces.js').CompanionSurfaceConfigField[]}
 */
const configFields = [
	//
	...OffsetConfigFields,
	RotationConfigField,
	...LockConfigFields,
]

class SurfaceUSBVECFootpedal extends EventEmitter {
	/**
	 * @type {import('winston').Logger}
	 * @access private
	 * @readonly
	 */
	#logger

	constructor(devicePath, contourShuttle, modelInfo, deviceInfo) {
		super()

		this.#logger = LogController.createLogger(`Surface/USB/VECFootpedal/${devicePath}`)

		this.vecFootpedal = vecFootpedal
		this.deviceInfo = deviceInfo
		this.modelInfo = modelInfo

		this.config = {
			// No config currently present
		}

		this.#logger.debug(`Adding VEC Footpedal USB device ${devicePath}`)

		/** @type {import('../Handler.js').SurfacePanelInfo} */
		this.info = {
			type: `VEC Footpedal ${this.deviceInfo.name}`,
			devicePath: devicePath,
			configFields: configFields,
			deviceId: `vecfootpedal:${this.deviceInfo.id}`,
		}

		this.gridSize = {
			columns: this.modelInfo.totalCols,
			rows: this.modelInfo.totalRows,
		}

		this.vecFootpedal.on('error', (error) => {
			console.error(error)
			this.emit('remove')
		})

		this.vecFootpedal.on('buttondown', (info) => {
			const xy = buttonToXy(this.modelInfo, info)
			if (xy === undefined) {
				return
			}

			this.emit('click', ...xy, true)
		})

		this.vecFootpedal.on('buttonup', (info) => {
			const xy = buttonToXy(this.modelInfo, info)
			if (xy === undefined) {
				return
			}

			this.emit('click', ...xy, false)
		})

		this.vecFootpedal.on('disconnect', (error) => {
			console.error(error)
			this.emit('remove')
		})
	}

	/**
	 * Open a VEC Footpedal
	 * @param {string} devicePath
	 * @returns {Promise<SurfaceUSBVECFootpedal>}
	 */
	static async create(devicePath) {
		const pedal = vecFootpedal
		// We're doing device search via Companion so don't run it here too
		pedal.start(false)
		try {
			let deviceInfo = null
			let info = null
			pedal.connect(devicePath)
			deviceInfo = pedal.getDeviceByPath(devicePath)
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
	 * @param {Record<string, any>} config
	 * @param {boolean=} _force
	 * @returns false when nothing happens
	 */
	setConfig(config, _force) {
		// No config currently present
		this.config = config
	}

	quit() {
		this.vecFootpedal.close()
	}

	draw() {
		// Should never be fired
	}

	clearDeck() {
		// Not relevant for this device
	}
}

export default SurfaceUSBVECFootpedal

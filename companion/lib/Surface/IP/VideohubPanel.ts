/*
 * This file is part of the Companion project
 * Copyright (c) 2019 Bitfocus AS
 * Authors: Håkon Nessjøen <haakon@bitfocus.io>, William Viker <william@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 */
import LogController from '../../Log/Controller.js'
import { EventEmitter } from 'events'
import { convertPanelIndexToXY } from '../Util.js'
// @ts-ignore
import VideohubServer from 'videohub-server'
import {
	OffsetConfigFields,
	BrightnessConfigField,
	LockConfigFields,
	RotationConfigField,
} from '../CommonConfigFields.js'
import type { CompanionSurfaceConfigField, GridSize } from '@companion-app/shared/Model/Surfaces.js'
import type { SurfacePanel, SurfacePanelEvents, SurfacePanelInfo } from '../Types.js'
import type { ImageResult } from '../../Graphics/ImageResult.js'

export interface VideohubPanelDeviceInfo {
	productName: string
	path: string
	remoteAddress: string
	panelInfo: {
		buttonsColumns: number
		buttonsRows: number
	}
	serverId: string
	server: VideohubServer
}

const configFields: CompanionSurfaceConfigField[] = [
	...OffsetConfigFields,
	BrightnessConfigField,
	RotationConfigField,
	{
		id: 'videohub_page_count',
		type: 'number',
		label: 'Page Count',
		default: 0,
		min: 0,
		step: 2,
		max: 8,
	},
	...LockConfigFields,
]

export class SurfaceIPVideohubPanel extends EventEmitter<SurfacePanelEvents> implements SurfacePanel {
	#logger = LogController.createLogger('Surface/IP/VideohubPanel')

	readonly info: SurfacePanelInfo

	readonly gridSize: GridSize

	private readonly server: VideohubServer
	private readonly serverId: string
	private readonly deviceId: string

	private _config: {
		brightness: number
		videohub_page_count: number
	}

	constructor(deviceInfo: VideohubPanelDeviceInfo) {
		super()

		this.info = {
			type: deviceInfo.productName,
			devicePath: deviceInfo.path,
			configFields: configFields,
			deviceId: deviceInfo.path,
			location: deviceInfo.remoteAddress,
		}

		this.gridSize = {
			columns: deviceInfo.panelInfo.buttonsColumns,
			rows: deviceInfo.panelInfo.buttonsRows,
		}

		this.server = deviceInfo.server
		this.serverId = deviceInfo.serverId

		this.deviceId = deviceInfo.path

		this.#logger.info(`Adding Videohub Panel device "${this.deviceId}"`)

		this._config = {
			brightness: 100,
			videohub_page_count: 0,
		}
	}

	quit() {}

	/**
	 * Draw a button
	 */
	draw(_x: number, _y: number, _render: ImageResult): void {
		// Not supported
	}

	/**
	 * Produce a click event
	 */
	doButton(destination: number, button: number): void {
		const xy = convertPanelIndexToXY(button, this.gridSize)
		if (xy) {
			this.emit('click', ...xy, true, destination)

			setTimeout(() => {
				// Release after a short delay
				this.emit('click', ...xy, false, destination)
			}, 20)
		}
	}

	clearDeck(): void {
		// Not supported
	}

	/* elgato-streamdeck functions */

	/**
	 * Process the information from the GUI and what is saved in database
	 * @returns false when nothing happens
	 */
	setConfig(config: Record<string, any>, force = false) {
		console.log('setup', config, force)
		const newBrightness = Math.floor(config.brightness / 10)
		if ((force || this._config.brightness != newBrightness) && config.brightness !== undefined) {
			this._config.brightness = newBrightness
			this.#setBrightness(newBrightness)
		}

		const page_count = Math.floor(config.videohub_page_count / 2) * 2
		if (force || this._config.videohub_page_count != page_count) {
			this._config.videohub_page_count = page_count
			this.#setPageCount(page_count)
		}
	}

	/**
	 * Set the brihgtness of the panel
	 * @param value 0-100
	 */
	#setBrightness(value: number): void {
		this.#logger.silly('brightness: ' + value)

		try {
			this.server.setBacklight(this.serverId, value)
		} catch (e) {
			this.#logger.error('Failed to set videohub panel brightness: ' + e?.toString())
		}
	}

	/**
	 * Set the number of page buttons to use on the panel
	 */
	#setPageCount(value: number): void {
		this.#logger.silly('page count: ' + value)

		try {
			this.server.configureDevice(this.serverId, { destinationCount: value })
		} catch (e) {
			this.#logger.error('Failed to set videohub panel destination count: ' + e?.toString())
		}
	}
}

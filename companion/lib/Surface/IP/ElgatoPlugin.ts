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
import { oldBankIndexToXY, xyToOldBankIndex } from '@companion-app/shared/ControlId.js'
import { convertPanelIndexToXY } from '../Util.js'
import { LEGACY_MAX_BUTTONS } from '../../Resources/Constants.js'
import type { SurfacePanel, SurfacePanelEvents, SurfacePanelInfo } from '../Types.js'
import type { ControlsController } from '../../Controls/Controller.js'
import type { PageController } from '../../Page/Controller.js'
import type { ServiceElgatoPluginSocket } from '../../Service/ElgatoPlugin.js'
import type { ImageResult } from '../../Graphics/ImageResult.js'
import type { GridSize } from '@companion-app/shared/Model/Surfaces.js'

export class SurfaceIPElgatoPlugin extends EventEmitter<SurfacePanelEvents> implements SurfacePanel {
	readonly #logger = LogController.createLogger('Surface/IP/ElgatoPlugin')

	readonly info: SurfacePanelInfo
	readonly gridSize: GridSize = {
		columns: 8,
		rows: 4,
	}

	_config: Record<string, any> = {
		rotation: 0,
		never_lock: true,
	}

	readonly #controlsController: ControlsController
	readonly #pageController: PageController

	readonly socket: ServiceElgatoPluginSocket

	constructor(
		controlsController: ControlsController,
		pageController: PageController,
		devicePath: string,
		socket: ServiceElgatoPluginSocket
	) {
		super()

		this.#controlsController = controlsController
		this.#pageController = pageController

		this.socket = socket

		if (this.socket.supportsCoordinates) {
			// The size doesn't matter when in coordinate mode, interaction gets done differently
			this.gridSize = {
				columns: 0,
				rows: 0,
			}
		}

		this.#logger.debug(`Adding Elgato Streamdeck Plugin (${this.socket.supportsPng ? 'PNG' : 'Bitmap'})`)

		this.info = {
			type: 'Elgato Streamdeck Plugin',
			devicePath: devicePath,
			configFields: [],
			deviceId: devicePath,
		}

		const triggerKeyPress = (data: Record<string, any>, pressed: boolean) => {
			if ('row' in data || 'column' in data) {
				if (data.page == null) {
					this.emit('click', Number(data.column), Number(data.row), pressed)
				} else {
					const controlId = this.#pageController.getControlIdAt({
						pageNumber: Number(data.page),
						column: Number(data.column),
						row: Number(data.row),
					})
					if (controlId) {
						this.#controlsController.pressControl(controlId, pressed, this.info.devicePath)

						this.#logger.debug(`${controlId} ${pressed ? 'pressed' : 'released'}`)
					}
				}
			} else if ('keyIndex' in data) {
				this.#emitClick(data.keyIndex, pressed)
			} else {
				const xy = oldBankIndexToXY(data.bank + 1)
				if (xy) {
					const controlId = this.#pageController.getControlIdAt({
						pageNumber: Number(data.page),
						column: xy[0],
						row: xy[1],
					})
					if (controlId) {
						this.#controlsController.pressControl(controlId, pressed, this.info.devicePath)

						this.#logger.debug(`${controlId} ${pressed ? 'pressed' : 'released'}`)
					}
				}
			}
		}

		socket.on('keydown', (data: any) => triggerKeyPress(data, true))
		socket.on('keyup', (data: any) => triggerKeyPress(data, false))

		socket.on('rotate', (data: any) => {
			const right = data.ticks > 0

			if ('row' in data || 'column' in data) {
				if (data.page == null) {
					this.emit('rotate', Number(data.column), Number(data.row), right)
				} else {
					const controlId = this.#pageController.getControlIdAt({
						pageNumber: Number(data.page),
						column: Number(data.column),
						row: Number(data.row),
					})
					if (controlId) {
						this.#controlsController.rotateControl(controlId, right, this.info.devicePath)

						this.#logger.debug(`${controlId} rotated ${right}`)
					}
				}
			} else if ('keyIndex' in data) {
				const xy = convertPanelIndexToXY(data.keyIndex, this.gridSize)
				if (xy) {
					this.emit('rotate', ...xy, right)
				}
			} else {
				const xy = oldBankIndexToXY(data.bank + 1)
				if (xy) {
					const controlId = this.#pageController.getControlIdAt({
						pageNumber: Number(data.page),
						column: xy[0],
						row: xy[1],
					})
					if (controlId) {
						this.#controlsController.rotateControl(controlId, right, this.info.devicePath)

						this.#logger.debug(`${controlId} rotated ${right}`)
					}
				}
			}
		})
	}

	/**
	 * Produce a click event
	 */
	#emitClick(key: number, state: boolean) {
		const xy = convertPanelIndexToXY(key, this.gridSize)
		if (xy) {
			this.emit('click', ...xy, state)
		}
	}

	quit(): void {
		this.socket.removeAllListeners('keyup')
		this.socket.removeAllListeners('keydown')
		this.socket.removeAllListeners('rotate')
	}

	/**
	 * Draw a button
	 */
	draw(x: number, y: number, render: ImageResult): void {
		if (this.socket.supportsCoordinates) {
			// Uses manual subscriptions
			return
		}

		if (render.buffer === undefined || render.buffer.length === 0) {
			this.#logger.silly('buffer was not 15552, but ', render.buffer?.length)
			return
		}

		const key = xyToOldBankIndex(x, y)
		if (key) {
			this.socket.fillImage(key, { keyIndex: key - 1 }, render)
		}
	}

	clearDeck(): void {
		this.#logger.silly('elgato.prototype.clearDeck()')

		if (this.socket.supportsCoordinates) {
			this.socket.apicommand('clearAllKeys', {})
		} else {
			const emptyBuffer = Buffer.alloc(72 * 72 * 3)

			for (let i = 0; i < LEGACY_MAX_BUTTONS; ++i) {
				this.socket.apicommand('fillImage', { keyIndex: i, data: emptyBuffer })
			}
		}
	}

	/**
	 * Process the information from the GUI and what is saved in database
	 * @returns false when nothing happens
	 */
	setConfig(config: Record<string, any>, _force = false): void {
		this._config = config

		// ensure rotation is disabled
		this._config.rotation = 0
		this._config.never_lock = true
	}
}

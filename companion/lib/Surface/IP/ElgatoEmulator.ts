/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 *
 */

import { EventEmitter } from 'events'
import isEqual from 'fast-deep-equal'
import LogController from '../../Log/Controller.js'
import debounceFn from 'debounce-fn'
import { OffsetConfigFields, RotationConfigField, LockConfigFields } from '../CommonConfigFields.js'
import type { CompanionSurfaceConfigField, GridSize } from '@companion-app/shared/Model/Surfaces.js'
import type { EmulatorConfig, EmulatorImage, EmulatorLockedState } from '@companion-app/shared/Model/Common.js'
import type { DrawButtonItem, SurfacePanel, SurfacePanelEvents, SurfacePanelInfo } from '../Types.js'

export function EmulatorRoom(id: string): string {
	return `emulator:${id}`
}

const DefaultConfig: EmulatorConfig = {
	emulator_control_enable: false,
	emulator_prompt_fullscreen: false,

	emulator_columns: 8,
	emulator_rows: 4,
}

const configFields: CompanionSurfaceConfigField[] = [
	{
		id: 'emulator_rows',
		type: 'number',
		label: 'Row count',
		default: 4,
		min: 1,
		step: 1,
		max: 100,
	},
	{
		id: 'emulator_columns',
		type: 'number',
		label: 'Column count',
		default: 8,
		min: 1,
		step: 1,
		max: 100,
	},
	...OffsetConfigFields,
	RotationConfigField,
	{
		id: 'emulator_control_enable',
		type: 'checkbox',
		label: 'Enable support for Logitech R400/Mastercue/DSan',
		default: true,
	},
	{
		id: 'emulator_prompt_fullscreen',
		type: 'checkbox',
		label: 'Prompt to enter fullscreen',
		default: true,
	},
	...LockConfigFields,
]

export type EmulatorUpdateEvents = {
	emulatorConfig: [id: string, diff: EmulatorConfig | null]
	emulatorImages: [id: string, images: EmulatorImage[], clearCache: boolean]
	emulatorLocked: [id: string, lockedState: EmulatorLockedState | false]
}

function getCacheKey(x: number, y: number): string {
	return `${x}/${y}`
}

export class SurfaceIPElgatoEmulator extends EventEmitter<SurfacePanelEvents> implements SurfacePanel {
	readonly #logger = LogController.createLogger('Surface/IP/ElgatoEmulator')

	readonly #emulatorId: string

	readonly #events: Pick<EventEmitter<EmulatorUpdateEvents>, 'emit' | 'listenerCount'>

	#lastSentConfigJson: EmulatorConfig = structuredClone(DefaultConfig)

	#lastLockedState: EmulatorLockedState | false = false

	readonly #pendingBufferUpdates = new Map<string, [number, number]>()

	#imageCache = new Map<string, string>()

	readonly info: SurfacePanelInfo

	#emitChanged = debounceFn(
		() => {
			if (this.#pendingBufferUpdates.size > 0) {
				const newImages: EmulatorImage[] = []
				for (const [x, y] of this.#pendingBufferUpdates.values()) {
					newImages.push({
						x,
						y,
						buffer: this.#imageCache.get(getCacheKey(x, y)) ?? false,
					})
				}

				this.#pendingBufferUpdates.clear()

				if (this.#events.listenerCount('emulatorImages') > 0) {
					this.#events.emit('emulatorImages', this.#emulatorId, newImages, false)
				}
			}
		},
		{
			wait: 5,
			maxWait: 50,
			before: false,
			after: true,
		}
	)

	constructor(events: Pick<EventEmitter<EmulatorUpdateEvents>, 'emit' | 'listenerCount'>, emulatorId: string) {
		super()

		this.#events = events
		this.#emulatorId = emulatorId

		this.info = {
			description: 'Emulator',
			configFields: configFields,
			surfaceId: `emulator:${emulatorId}`,
			location: null,
		}

		this.#logger.debug('Adding Elgato Streamdeck Emulator')
	}

	get gridSize(): GridSize {
		return {
			columns: this.#lastSentConfigJson?.emulator_columns || 8,
			rows: this.#lastSentConfigJson?.emulator_rows || 4,
		}
	}

	latestConfig(): EmulatorConfig {
		return this.#lastSentConfigJson
	}

	latestImages(): EmulatorImage[] {
		const images: EmulatorImage[] = []

		for (let y = 0; y < this.gridSize.rows; y++) {
			for (let x = 0; x < this.gridSize.columns; x++) {
				images.push({
					x,
					y,
					buffer: this.#imageCache.get(getCacheKey(x, y)) ?? false,
				})
			}
		}

		return images
	}

	lockedState(): EmulatorLockedState | false {
		return this.#lastLockedState
	}

	getDefaultConfig(): EmulatorConfig {
		return structuredClone(DefaultConfig)
	}

	/**
	 * Process the information from the GUI and what is saved in database
	 */
	setConfig(config: EmulatorConfig, _force = false): void {
		// Populate some defaults
		if (!config.emulator_columns) config.emulator_columns = this.getDefaultConfig().emulator_columns
		if (!config.emulator_rows) config.emulator_rows = this.getDefaultConfig().emulator_rows

		// Send config to clients
		if (this.#events.listenerCount('emulatorConfig') > 0) {
			if (!isEqual(this.#lastSentConfigJson, config)) {
				this.#events.emit('emulatorConfig', this.#emulatorId, config)
			}
		}

		// Handle resize
		const oldSize = this.gridSize
		if (config.emulator_columns !== oldSize.columns || config.emulator_rows !== oldSize.rows) {
			// Clear the cache to ensure no bleed
			this.#imageCache.clear()

			for (let y = 0; y < oldSize.rows; y++) {
				for (let x = 0; x < oldSize.columns; x++) {
					this.#trackChanged(x, y)
				}
			}

			setImmediate(() => {
				// Trigger the redraw after this call has completed
				this.emit('resized')
			})
		}

		this.#lastSentConfigJson = structuredClone(config)
	}

	setLocked(locked: boolean, characterCount: number): void {
		if (locked) {
			this.#lastLockedState = { characterCount }
		} else {
			this.#lastLockedState = false
		}

		console.log('Emulator setLocked', this.#emulatorId, this.#lastLockedState)

		if (this.#events.listenerCount('emulatorLocked') > 0) {
			this.#events.emit('emulatorLocked', this.#emulatorId, this.#lastLockedState)
		}
	}

	quit(): void {}

	/**
	 * Draw a button
	 */
	draw(item: DrawButtonItem): void {
		const { x, y } = item

		const size = this.gridSize
		if (x < 0 || y < 0 || x >= size.columns || y >= size.rows) return

		const dataUrl = item.image.asDataUrl
		if (!dataUrl) {
			this.#logger.verbose('draw call had no data-url')
			return
		}

		this.#imageCache.set(getCacheKey(x, y), dataUrl)

		this.#trackChanged(x, y)
		this.#emitChanged()
	}

	/**
	 * Track the pending changes
	 */
	#trackChanged(x: number, y: number): void {
		this.#pendingBufferUpdates.set(`${x}/${y}`, [x, y])
	}

	clearDeck(): void {
		this.#logger.silly('elgato.prototype.clearDeck()')

		// clear all images
		this.#imageCache.clear()

		if (this.#events.listenerCount('emulatorImages') > 0) {
			this.#events.emit('emulatorImages', this.#emulatorId, [], true)
		}
	}
}

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
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 *
 */

import { EventEmitter } from 'events'
import { cloneDeep } from 'lodash-es'
import LogController from '../../Log/Controller.js'
import jsonPatch from 'fast-json-patch'
import debounceFn from 'debounce-fn'

export function EmulatorRoom(id) {
	return `emulator:${id}`
}

class SurfaceIPElgatoEmulator extends EventEmitter {
	logger = LogController.createLogger('Surface/IP/ElgatoEmulator')

	#lastSentConfigJson = {}
	#pendingBufferUpdates = new Map()

	#emitChanged = debounceFn(
		() => {
			if (this.#pendingBufferUpdates.size > 0) {
				const newImages = []
				for (const [x, y] of this.#pendingBufferUpdates.values()) {
					newImages.push({
						x,
						y,
						buffer: this.imageCache[y]?.[x] || false,
					})
				}

				this.#pendingBufferUpdates.clear()

				this.io.emitToRoom(EmulatorRoom(this.id), 'emulator:images', newImages)
			}
		},
		{
			wait: 5,
			maxWait: 50,
			before: false,
			after: true,
		}
	)

	constructor(registry, emulatorId) {
		super()

		this.registry = registry
		this.io = this.registry.io

		this.id = emulatorId

		this.info = {
			type: 'Emulator',
			devicepath: `emulator:${emulatorId}`,
			configFields: ['emulator_control_enable', 'emulator_prompt_fullscreen', 'emulator_size'],
			deviceId: `emulator:${emulatorId}`,
		}

		this.logger.debug('Adding Elgato Streamdeck Emulator')

		this.imageCache = {}
	}

	get gridSize() {
		return {
			columns: this.#lastSentConfigJson?.emulator_columns || 8,
			rows: this.#lastSentConfigJson?.emulator_rows || 4,
		}
	}

	setupClient(client) {
		client.emit('emulator:images', this.imageCache)

		return this.#lastSentConfigJson
	}

	getDefaultConfig() {
		return {
			emulator_control_enable: false,
			emulator_prompt_fullscreen: false,

			emulator_columns: 8,
			emulator_rows: 4,
		}
	}

	setConfig(config) {
		// Populate some defaults
		if (!config.emulator_columns) config.emulator_columns = this.getDefaultConfig().emulator_columns
		if (!config.emulator_rows) config.emulator_rows = this.getDefaultConfig().emulator_rows

		// Send config to clients
		const roomName = EmulatorRoom(this.id)
		if (this.io.countRoomMembers(roomName) > 0) {
			const patch = jsonPatch.compare(this.#lastSentConfigJson || {}, config || {})
			if (patch.length > 0) {
				this.io.emitToRoom(roomName, `emulator:config`, config)
			}
		}

		// Handle resize
		const oldSize = this.gridSize
		if (config.emulator_columns !== oldSize.columns || config.emulator_rows !== oldSize.rows) {
			// Clear the cache to ensure no bleed
			this.imageCache = {}

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

		this.#lastSentConfigJson = cloneDeep(config)
	}

	quit() {}

	draw(x, y, render) {
		const size = this.gridSize
		if (x < 0 || y < 0 || x >= size.columns || y >= size.rows) return true

		const dataUrl = render.asDataUrl
		if (!dataUrl) {
			this.logger.verbose('draw call had no data-url')
			return false
		}

		if (!this.imageCache[y]) this.imageCache[y] = {}
		this.imageCache[y][x] = dataUrl || null

		this.#trackChanged(x, y)
		this.#emitChanged()

		return true
	}

	#trackChanged(x, y) {
		this.#pendingBufferUpdates.set(`${x}/${y}`, [x, y])
	}

	clearDeck() {
		this.logger.silly('elgato.prototype.clearDeck()')

		// clear all images
		this.imageCache = {}
		this.io.emitToRoom(EmulatorRoom(this.id), 'emulator:images', {})
	}
}

export default SurfaceIPElgatoEmulator

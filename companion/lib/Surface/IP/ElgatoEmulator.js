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

/**
 *
 * @param {string} id
 * @returns {string}
 */
export function EmulatorRoom(id) {
	return `emulator:${id}`
}

/** @type {import('../../Shared/Model/Common.js').EmulatorConfig} */
const DefaultConfig = {
	emulator_control_enable: false,
	emulator_prompt_fullscreen: false,

	emulator_columns: 8,
	emulator_rows: 4,
}

class SurfaceIPElgatoEmulator extends EventEmitter {
	#logger = LogController.createLogger('Surface/IP/ElgatoEmulator')

	/**
	 * @type {string}
	 */
	#emulatorId

	/**
	 * @type {import('../../UI/Handler.js').default}
	 */
	#io

	/**
	 * @type {import('../../Shared/Model/Common.js').EmulatorConfig}
	 * @access private
	 */
	#lastSentConfigJson = cloneDeep(DefaultConfig)

	/**
	 * @type {Map<string, [number, number]>}
	 */
	#pendingBufferUpdates = new Map()

	/**
	 * @type {Record<number, Record<number, string | null | undefined>>}
	 * @access private
	 */
	imageCache = {}

	#emitChanged = debounceFn(
		() => {
			if (this.#pendingBufferUpdates.size > 0) {
				/** @type {import('../../Shared/Model/Common.js').EmulatorImage[]} */
				const newImages = []
				for (const [x, y] of this.#pendingBufferUpdates.values()) {
					newImages.push({
						x,
						y,
						buffer: this.imageCache[y]?.[x] || false,
					})
				}

				this.#pendingBufferUpdates.clear()

				const roomName = EmulatorRoom(this.#emulatorId)
				if (this.#io.countRoomMembers(roomName) > 0) {
					this.#io.emitToRoom(roomName, 'emulator:images', newImages)
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

	/**
	 * @param {import('../../UI/Handler.js').default} io
	 * @param {string} emulatorId
	 */
	constructor(io, emulatorId) {
		super()

		this.#io = io
		this.#emulatorId = emulatorId

		this.info = {
			type: 'Emulator',
			devicePath: `emulator:${emulatorId}`,
			configFields: ['emulator_control_enable', 'emulator_prompt_fullscreen', 'emulator_size'],
			deviceId: `emulator:${emulatorId}`,
		}

		this.#logger.debug('Adding Elgato Streamdeck Emulator')

		this.imageCache = {}
	}

	get gridSize() {
		return {
			columns: this.#lastSentConfigJson?.emulator_columns || 8,
			rows: this.#lastSentConfigJson?.emulator_rows || 4,
		}
	}

	/**
	 * @param {import('../../UI/Handler.js').ClientSocket} client
	 * @returns {import('../../Shared/Model/Common.js').EmulatorConfig}
	 */
	setupClient(client) {
		client.emit('emulator:images', this.imageCache)

		return this.#lastSentConfigJson
	}

	getDefaultConfig() {
		return cloneDeep(DefaultConfig)
	}

	/**
	 * Process the information from the GUI and what is saved in database
	 * @param {import('../../Shared/Model/Common.js').EmulatorConfig} config
	 * @param {boolean=} _force
	 * @returns {void}
	 */
	setConfig(config, _force) {
		// Populate some defaults
		if (!config.emulator_columns) config.emulator_columns = this.getDefaultConfig().emulator_columns
		if (!config.emulator_rows) config.emulator_rows = this.getDefaultConfig().emulator_rows

		// Send config to clients
		const roomName = EmulatorRoom(this.#emulatorId)
		if (this.#io.countRoomMembers(roomName) > 0) {
			const patch = jsonPatch.compare(this.#lastSentConfigJson || {}, config || {})
			if (patch.length > 0) {
				this.#io.emitToRoom(roomName, `emulator:config`, config)
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

	/**
	 * Draw a button
	 * @param {number} x
	 * @param {number} y
	 * @param {import('../../Graphics/ImageResult.js').ImageResult} render
	 * @returns {void}
	 */
	draw(x, y, render) {
		const size = this.gridSize
		if (x < 0 || y < 0 || x >= size.columns || y >= size.rows) return

		const dataUrl = render.asDataUrl
		if (!dataUrl) {
			this.#logger.verbose('draw call had no data-url')
			return
		}

		if (!this.imageCache[y]) this.imageCache[y] = {}
		this.imageCache[y][x] = dataUrl || null

		this.#trackChanged(x, y)
		this.#emitChanged()
	}

	/**
	 * Track the pending changes
	 * @param {number} x
	 * @param {number} y
	 * @returns {void}
	 */
	#trackChanged(x, y) {
		this.#pendingBufferUpdates.set(`${x}/${y}`, [x, y])
	}

	clearDeck() {
		this.#logger.silly('elgato.prototype.clearDeck()')

		// clear all images
		this.imageCache = {}

		const roomName = EmulatorRoom(this.#emulatorId)
		if (this.#io.countRoomMembers(roomName) > 0) {
			this.#io.emitToRoom(roomName, 'emulator:images', {})
		}
	}
}

export default SurfaceIPElgatoEmulator

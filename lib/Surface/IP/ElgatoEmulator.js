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
import { xyToOldBankIndex } from '../../Shared/ControlId.js'

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
			configFields: ['emulator_control_enable', 'emulator_prompt_fullscreen'],
			keysPerRow: 8,
			keysTotal: 32,
			deviceId: `emulator:${emulatorId}`,
		}

		this.logger.debug('Adding Elgato Streamdeck Emulator')

		this.imageCache = {}
		for (let y = 0; y < global.MAX_BUTTONS_PER_COL; ++y) {
			this.imageCache[y] = {}
			for (let x = 0; x < global.MAX_BUTTONS_PER_ROW; ++x) {
				this.imageCache[y][x] = null
			}
		}
	}

	setupClient(client) {
		client.emit('emulator:images', this.imageCache)

		return this.#lastSentConfigJson
	}

	setConfig(config) {
		const roomName = EmulatorRoom(this.id)
		if (this.io.countRoomMembers(roomName) > 0) {
			const patch = jsonPatch.compare(this.#lastSentConfigJson || {}, config || {})
			if (patch.length > 0) {
				this.io.emitToRoom(roomName, `emulator:config`, config)
			}
		}

		this.#lastSentConfigJson = cloneDeep(config)
	}

	quit() {}

	draw(x, y, buffer, style) {
		//if (buffer === undefined || buffer.length != 15552) {
		if (buffer === undefined || buffer.length === 0) {
			this.logger.verbose('buffer was not 15552, but ', buffer.length)
			return false
		}

		// Temporarily use this to validate that the key is usable by the emulator
		const key = xyToOldBankIndex(x, y)
		if (key !== null) {
			if (!this.imageCache[y]) this.imageCache[y] = {}
			this.imageCache[y][x] = buffer || null

			this.#pendingBufferUpdates.set(`${x}/${y}`, [x, y])
			this.#emitChanged()
		}

		return true
	}

	clearDeck() {
		this.logger.silly('elgato.prototype.clearDeck()')

		// clear all images
		this.imageCache = {}
		for (let y = 0; y < global.MAX_BUTTONS_PER_COL; ++y) {
			if (!this.imageCache[y]) this.imageCache[y] = {}
			for (let x = 0; x < global.MAX_BUTTONS_PER_ROW; ++x) {
				this.imageCache[y][x] = null
			}
		}

		this.io.emitToRoom(EmulatorRoom(this.id), 'emulator:images', {})
	}
}

export default SurfaceIPElgatoEmulator

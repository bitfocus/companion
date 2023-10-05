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
	#pendingKeyBuffers = new Set()

	#emitChanged = debounceFn(
		() => {
			if (this.#pendingKeyBuffers.size > 0) {
				const newImages = {}
				for (const key of this.#pendingKeyBuffers.values()) {
					newImages[key] = this.imageCache[key] || false
				}

				this.#pendingKeyBuffers.clear()

				const roomName = EmulatorRoom(this.id)
				if (this.io.countRoomMembers(roomName) > 0) {
					this.io.emitToRoom(roomName, 'emulator:images', newImages)
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

	constructor(registry, emulatorId) {
		super()

		this.registry = registry
		this.io = this.registry.io

		this.id = emulatorId

		this.info = {
			type: 'Emulator',
			devicePath: `emulator:${emulatorId}`,
			configFields: ['emulator_control_enable', 'emulator_prompt_fullscreen'],
			keysPerRow: 8,
			keysTotal: 32,
			deviceId: `emulator:${emulatorId}`,
		}

		this.logger.debug('Adding Elgato Streamdeck Emulator')

		this.imageCache = {}
		for (let key = 0; key < this.info.keysTotal; key++) {
			this.imageCache[key] = false
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

	draw(key, buffer, style) {
		if (buffer === undefined || buffer.length != 15552) {
			this.logger.verbose('buffer was not 15552, but ', buffer.length)
			return false
		}

		this.imageCache[key] = buffer || false

		this.#pendingKeyBuffers.add(key)
		this.#emitChanged()

		// this.io.emitToRoom(EmulatorRoom(this.id), 'emulator:image', key, buffer)

		return true
	}

	clearDeck() {
		this.logger.silly('elgato.prototype.clearDeck()')

		// clear all images
		this.imageCache = {}
		for (let key = 0; key < this.info.keysTotal; key++) {
			this.imageCache[key] = false
		}

		const roomName = EmulatorRoom(this.id)
		if (this.io.countRoomMembers(roomName) > 0) {
			this.io.emitToRoom(roomName, 'emulator:images', this.imageCache)
		}
	}
}

export default SurfaceIPElgatoEmulator

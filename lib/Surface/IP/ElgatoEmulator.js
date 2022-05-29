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
import LogController from '../../Log/Controller.js'

const EmulatorRoom = 'emulator'

class SurfaceIPElgatoEmulator extends EventEmitter {
	logger = LogController.createLogger('Surface/IP/ElgatoEmulator')

	constructor(registry, devicepath) {
		super()

		this.registry = registry
		this.userconfig = this.registry.userconfig
		this.io = this.registry.io

		this.info = {
			type: 'Elgato Streamdeck Emulator',
			devicepath: devicepath,
			configFields: [],
			keysPerRow: 8,
			keysTotal: 32,
			serialnumber: 'emulator',
		}

		this.logger.debug('Adding Elgato Streamdeck Emulator')

		this.imageCache = {}
	}

	/**
	 * Setup a new socket client's events
	 * @param {SocketIO} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
		client.on('emul_startup', () => {
			client.join(EmulatorRoom)

			// TODO: need to send updates to this setting to the client as well
			client.emit('emul_controlkeys', this.userconfig.getKey('emulator_control_enable'))
			for (let key in this.imageCache) {
				client.emit('emulator:image', key, this.imageCache[key])
			}
		})

		client.on('emulator:press', (keyIndex) => {
			this.emit('click', keyIndex, true)
		})

		client.on('emulator:release', (keyIndex) => {
			this.emit('click', keyIndex, false)
		})
	}

	quit() {}

	draw(key, buffer, style) {
		if (buffer === undefined || buffer.length != 15552) {
			this.logger.verbose('buffer was not 15552, but ', buffer.length)
			return false
		}

		this.imageCache[key] = buffer

		this.io.emitToRoom(EmulatorRoom, 'emulator:image', key, buffer)

		return true
	}

	clearDeck() {
		this.logger.silly('elgato.prototype.clearDeck()')
		for (let key = 0; key < this.info.keysTotal; key++) {
			this.imageCache[key] = undefined

			this.io.emitToRoom(EmulatorRoom, 'emulator:image', key, undefined)
		}
	}
}

export default SurfaceIPElgatoEmulator

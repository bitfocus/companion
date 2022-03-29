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
import debug0 from 'debug'

class SurfaceIPElgatoEmulator extends EventEmitter {
	debug = debug0('lib/Surface/IP/ElgatoEmulator')

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

		this.debug('Adding Elgato Streamdeck Emulator')

		this.imageCache = {}
	}

	/**
	 * Setup a new socket client's events
	 * @param {SocketIO} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
		client.on('emul_startup', () => {
			client.join('emulator')

			// TODO: need to send updates to this setting to the client as well
			client.emit('emul_controlkeys', this.userconfig.getKey('emulator_control_enable'))
			for (let key in this.imageCache) {
				client.emit('emul_fillImage', key, this.imageCache[key])
			}
		})

		client.on('emul_down', (keyIndex) => {
			this.emit('click', keyIndex, true)
		})

		client.on('emul_up', (keyIndex) => {
			this.emit('click', keyIndex, false)
		})
	}

	quit() {}

	draw(key, buffer, style) {
		if (buffer === undefined || buffer.length != 15552) {
			this.debug('buffer was not 15552, but ', buffer.length)
			return false
		}

		this.imageCache[key] = buffer

		this.io.emitToRoom('emulator', 'emul_fillImage', key, buffer)

		return true
	}

	clearDeck() {
		this.debug('elgato.prototype.clearDeck()')
		for (let x = 0; x < this.info.keysTotal; x++) {
			this.imageCache[x] = Buffer.alloc(15552)

			this.io.emitToRoom('emulator', 'emul_clearKey', x)
		}
	}
}

export default SurfaceIPElgatoEmulator

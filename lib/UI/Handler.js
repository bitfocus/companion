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

import { Server as _io } from 'socket.io'
import debug0 from 'debug'

const debug = debug0('lib/UI/Handler')

class UIHandler {
	constructor(registry, http) {
		this.registry = registry
		this.system = this.registry.system

		this.options = {
			allowEIO3: true,
			maxHttpBufferSize: 100 * 1000 * 1000, // bytes. 100mb matches socket.io v2. while not entirely safe, its what it used to be so is good enough for now
			cors: {
				// Allow everything
				origin: (o, cb) => cb(null, o),
				credentials: true,
			},
		}

		this.httpIO = new _io(http, this.options)

		this.httpIO.on('connect', this.clientConnect.bind(this))
	}

	/**
	 * Setup a new socket client's events
	 * @param {SocketIO} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
		debug('socket ' + client.id + ' connected')

		client.emit('app-version-info', {
			appVersion: this.registry.appVersion,
			appBuild: this.registry.appBuild,
		})

		// Wrap all 'client.on' calls, so that we 'handle' any errors they might throw
		const originalOn = client.on.bind(client)
		client.on = (name, fcn) => {
			return originalOn.call(client, name, (...args) => {
				try {
					fcn(...args)
				} catch (e) {
					debug(`Error in client handler '${name}': ${e}`)
					this.system.emit('log', 'Internal', 'error', `Error in client handler '${name}': ${e}`)
					console.error(e)
				}
			})
		}

		this.registry.ui.clientConnect(client)
		this.registry.data.clientConnect(client)
		this.registry.page.clientConnect(client)
		this.registry.bank.clientConnect(client)
		this.registry.graphics.clientConnect(client)
		this.registry.preview.clientConnect(client)
		this.registry.surfaces.clientConnect(client)
		this.registry.instance.clientConnect(client)
		this.registry.triggers.clientConnect(client)
		this.registry.cloud.clientConnect(client)

		client.on('disconnect', () => {
			debug('socket ' + client.id + ' disconnected')
		})
	}

	emit(...args) {
		this.httpIO.emit(...args)

		if (this.httpsIO !== undefined) {
			this.httpsIO.emit(...args)
		}
	}

	emitToRoom(room, ...args) {
		this.httpIO.to(room).emit(...args)

		if (this.httpsIO !== undefined) {
			this.httpsIO.to(room).emit(...args)
		}
	}

	enableHttps(https) {
		if (https !== undefined) {
			this.httpsIO = _io(https, this.options)

			this.httpsIO.on('connect', this.clientConnect.bind(this))
		}
	}
}

export default UIHandler

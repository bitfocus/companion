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

const _io = require('socket.io')
const debug = require('debug')('lib/io')

class io {
	constructor(system, http) {
		this.system = system

		this.options = {
			allowEIO3: true,
			maxHttpBufferSize: 100 * 1000 * 1000, // bytes. 100mb matches socket.io v2. while not entirely safe, its what it used to be so is good enough for now
			cors: {
				// Allow everything
				origin: (o, cb) => cb(null, o),
				credentials: true,
			},
		}

		this.httpIO = _io(http, this.options)

		this.httpIO.on('connect', this.clientConnect.bind(this))

		this.system.on('io_get', (cb) => {
			if (typeof cb == 'function') {
				cb(this)
			}
		})
	}

	clientConnect(client) {
		debug('io-connect')

		this.system.emit('skeleton-info-info', (info) => {
			client.emit('skeleton-info', info)
		})

		this.system.emit('io_connect', client)
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

exports = module.exports = function (system, http) {
	return new io(system, http)
}

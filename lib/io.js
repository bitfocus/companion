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

var _io = require('socket.io')
var debug = require('debug')('lib/io')

exports = module.exports = function (system, http) {
	const io = _io(http, {
		allowEIO3: true,
		cors: {
			// Allow everything
			origin: (o, cb) => cb(null, o),
			credentials: true,
		},
	})

	system.on('io_get', function (cb) {
		if (typeof cb == 'function') {
			cb(io)
		}
	})

	io.on('connect', function (client) {
		debug('io-connect')

		system.emit('skeleton-info-info', function (info) {
			client.emit('skeleton-info', info)
		})

		system.emit('io_connect', client)
	})

	return io
}

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

var debug = require('debug')('lib/tablet')
var system

function tablet(system) {
	var self = this

	self.tablet = {}

	system.on('get_tablet', function (cb) {
		cb(self.tablet)
	})

	system.emit('io_get', function (io) {
		system.on('io_connect', function (socket) {
			debug('socket ' + socket.id + ' connected')

			socket.on('tablet_startup', function () {})

			socket.on('disconnect', function () {
				debug('socket ' + socket.id + ' disconnected')
			})
		})
	})
}

module.exports = function (system) {
	return new tablet(system)
}

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

var debug = require('debug')('lib/log')

function log(system, io) {
	var self = this
	self.system = system
	self.io = io
	self.history = [[Date.now(), 'log', 'info', 'Application started']]

	self.system.on('log', function (source, level, message) {
		if (level) {
			var now = Date.now()
			io.emit('log', now, source, level, message)
			self.history.push([now, source, level, message])
			if (self.history.length > 500) {
				self.history.shift()
			}
		}
	})

	system.on('io_connect', function (client) {
		client.on('log_clear', function () {
			client.broadcast.emit('log_clear')
			self.history = []
			self.io.emit('log', Date.now(), 'log', 'info', 'Log cleared')
		})
		client.on('log_catchup', function () {
			for (var n in self.history) {
				var arr = self.history[n]
				client.emit('log', arr[0], arr[1], arr[2], arr[3])
			}
		})
	})

	return self
}

exports = module.exports = function (system, io) {
	return new log(system, io)
}

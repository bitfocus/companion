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

var debug = require('debug')('lib/page')
var system

function page(system) {
	var self = this

	self.page = {}

	system.emit('db_get', 'page', function (config) {
		self.page = config

		// Default values
		if (self.page === undefined) {
			self.page = {}
			for (var n = 1; n <= 99; n++) {
				if (self.page['' + n] === undefined) {
					self.page['' + n] = {
						name: 'PAGE',
					}
				}
			}
		}
	})

	system.on('page_set_noredraw', function (page, name) {
		debug('NR: Set page ' + page + ' to ', name)
		self.page[page] = name
		self.io.emit('set_page', page, name)
	})

	system.on('page_set', function (page, value) {
		debug('Set page ' + page + ' to ', value)
		self.page[page] = value

		self.io.emit('set_page', page, value)

		system.emit('db_set', 'page', self.page)
		system.emit('page_update', page, value)
		system.emit('db_save')
	})

	system.on('get_page', function (cb) {
		cb(self.page)
	})

	system.emit('io_get', function (io) {
		self.io = io

		system.on('io_connect', function (socket) {
			debug('socket ' + socket.id + ' connected')

			socket.on('set_page', function (key, value) {
				debug('socket: set_page ' + key, value)
				system.emit('page_set', key, value)
			})

			socket.on('get_page_all', function (answer) {
				debug('socket: get_page_all')

				if (typeof answer === 'function') {
					answer(self.page)
				} else {
					socket.emit('get_page_all', self.page)
				}
			})

			socket.on('disconnect', function () {
				debug('socket ' + socket.id + ' disconnected')
			})
		})
	})
}

module.exports = function (system) {
	return new page(system)
}

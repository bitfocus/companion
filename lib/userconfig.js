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

var debug = require('debug')('lib/userconfig')
var system

function userconfig(system) {
	var self = this

	self.userconfig = {}

	system.emit('db_get', 'userconfig', function (config) {
		if (config === undefined) {
			config = {}
		}

		self.userconfig = config

		for (var key in config) {
			system.emit('set_userconfig_key', key, config[key])
		}
	})

	system.on('get_userconfig', function (cb) {
		cb(self.userconfig)
	})

	system.emit('io_get', function (io) {
		system.on('io_connect', function (socket) {
			function sendResult(answer, name, ...args) {
				if (typeof answer === 'function') {
					answer(...args)
				} else {
					socket.emit(name, ...args)
				}
			}

			debug('socket ' + socket.id + ' connected')

			socket.on('set_userconfig_key', function (key, value) {
				self.userconfig[key] = value
				debug('set_userconfig_key', key, value)
				system.emit('log', 'set_userconfig(' + key + ')', 'info', 'new value: ' + value)
				io.emit('set_userconfig_key', key, value)
				system.emit('set_userconfig_key', key, value)
				system.emit('db_save')
			})

			socket.on('get_userconfig_all', function (answer) {
				sendResult(answer, 'get_userconfig_all', self.userconfig)
			})

			socket.on('disconnect', function () {
				debug('socket ' + socket.id + ' disconnected')
			})
		})
	})
}

module.exports = function (system) {
	return new userconfig(system)
}

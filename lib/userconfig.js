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

// The config for new installs
const default_config = {
	page_direction_flipped: false,
	page_plusminus: false,
	remove_topbar: false,

	emulator_control_enable: false,

	pin_enable: false,
	link_lockouts: false,
	pin: '',
	pin_timeout: 0,

	tcp_enabled: false,
	tcp_listen_port: 16759,

	udp_enabled: false,
	udp_listen_port: 16759,

	osc_enabled: false,
	osc_listen_port: 12321,

	rosstalk_enabled: false,

	artnet_enabled: false,
	artnet_universe: 1,
	artnet_channel: 1,
}

function userconfig(system) {
	var self = this

	self.system = system
	self.userconfig = {}

	system.emit('db_get', 'userconfig', function (config) {
		if (config === undefined) {
			config = {}
		}

		self.userconfig = config

		self.ensure_listen_ports_are_defined()

		// copy default values. this will set newly added defaults too
		for (let k in default_config) {
			if (self.userconfig[k] === undefined) {
				self.userconfig[k] = default_config[k]
			}
		}

		// make sure the db has an updated copy
		system.emit('db_set', 'userconfig', self.userconfig)

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
				setImmediate(() => {
					// give the change a chance to be pushed to the ui first
					system.emit('set_userconfig_key', key, value)
					system.emit('db_set', 'userconfig', self.userconfig)
					system.emit('db_save')
				})
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

userconfig.prototype.ensure_listen_ports_are_defined = function () {
	var self = this

	self.system.emit('db_is_first_run', function (is_first_run) {
		if (!is_first_run) {
			// This is an existing db, so setup the ports to match how it used to be
			const legacy_config = {
				tcp_enabled: true,
				tcp_listen_port: 51234,

				udp_enabled: true,
				udp_listen_port: 51235,

				osc_enabled: true,
				osc_listen_port: 12321,
			}

			// check if these fields have already been defined
			let has_been_defined = false
			for (const k in legacy_config) {
				if (self.userconfig[k] !== undefined) {
					has_been_defined = true
					break
				}
			}

			// copy across the legacy values
			if (!has_been_defined) {
				for (let k in legacy_config) {
					if (self.userconfig[k] === undefined) {
						self.userconfig[k] = legacy_config[k]
					}
				}
			}
		}
	})
}

module.exports = function (system) {
	return new userconfig(system)
}

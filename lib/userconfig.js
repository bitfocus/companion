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
var selfsigned = require('selfsigned')

// The config for new installs
const default_config = {
	setup_wizard: 0,

	page_direction_flipped: false,
	page_plusminus: false,
	remove_topbar: false,

	emulator_control_enable: false,
	xkeys_enable: true,
	elgato_plugin_enable: false, // Also disables local streamdeck

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

	emberplus_enabled: false,

	artnet_enabled: false,
	artnet_universe: 1,
	artnet_channel: 1,

	https_enabled: false,
	https_port: 8443,
	https_cert_type: 'self',
	https_self_cn: '',
	https_self_expiry: 365,
	https_self_cert: '',
	https_self_cert_created: '',
	https_self_cert_cn: '',
	https_self_cert_expiry: '',
	https_self_cert_private: '',
	https_self_cert_public: '',
	https_ext_private_key: '',
	https_ext_certificate: '',
	https_ext_chain: '',

	admin_lockout: false,
	admin_timeout: 5,
	admin_password: '',
}

function userconfig(system) {
	var self = this

	self.system = system
	self.userconfig = {}

	system.emit('config_get', 'bind_ip', function (value) {
		default_config.https_self_cn = value
	})

	system.on('config_set', function (key, value) {
		if (key == 'bind_ip') {
			if (self.userconfig !== undefined && default_config.https_self_cn == self.userconfig.https_self_cn) {
				self.set_userconfig_key('https_self_cn', value)
			}
		}
		default_config.https_self_cn = value
	})

	system.emit('db_get', 'userconfig', function (config) {
		if (config === undefined) {
			config = {}
		}

		self.userconfig = config

		self.checkV2InPlaceUpgrade()

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

	system.on('get_userconfig_key', function (key, cb) {
		cb(self.userconfig[key])
	})

	system.emit('io_get', function (io) {
		self.io = io

		system.on('io_connect', function (socket) {
			function sendResult(answer, name, ...args) {
				if (typeof answer === 'function') {
					answer(...args)
				} else {
					socket.emit(name, ...args)
				}
			}

			debug('socket ' + socket.id + ' connected')

			socket.on('set_userconfig_key', self.set_userconfig_key.bind(self))
			socket.on('set_userconfig_keys', self.set_userconfig_keys.bind(self))

			socket.on('reset_userconfig_key', function (key) {
				self.set_userconfig_key(key, default_config[key])
			})

			socket.on('get_userconfig_all', function (answer) {
				sendResult(answer, 'get_userconfig_all', self.userconfig)
			})

			socket.on('disconnect', function () {
				debug('socket ' + socket.id + ' disconnected')
			})

			socket.on('ssl_certificate_create', function () {
				try {
					const attrs = [{ name: 'commonName', value: self.userconfig.https_self_cn }]
					const pems = selfsigned.generate(attrs, {
						days: self.userconfig.https_self_expiry,
						algorithm: 'sha256',
						keySize: 2048,
					})
					if (pems.private && pems.public && pems.cert) {
						const cert = {
							https_self_cert_public: pems.public,
							https_self_cert_private: pems.private,
							https_self_cert: pems.cert,
							https_self_cert_cn: self.userconfig.https_self_cn,
							https_self_cert_created: new Date().toLocaleString(),
							https_self_cert_expiry: `${self.userconfig.https_self_expiry} days`,
						}

						self.set_userconfig_keys(cert)
					} else {
						self.system.emit('log', 'userconfig', 'error', `Couldn't generate certificate: not all pems returned`)
						debug(`Couldn't generate certificate: not all pems returned`)
					}
				} catch (e) {
					self.system.emit('log', 'userconfig', 'error', `Couldn't generate certificate: ${e.message}`)
					debug(`Couldn't generate certificate: ${e}`)
				}
			})

			socket.on('ssl_certificate_renew', function () {
				try {
					const attrs = [{ name: 'commonName', value: self.userconfig.https_self_cert_cn }]
					const pems = selfsigned.generate(attrs, {
						days: self.userconfig.https_self_expiry,
						algorithm: 'sha256',
						keySize: 2048,
						keyPair: {
							publicKey: self.userconfig.https_self_cert_public,
							privateKey: self.userconfig.https_self_cert_private,
						},
					})
					if (pems.private && pems.public && pems.cert) {
						const cert = {
							https_self_cert: pems.cert,
							https_self_cert_created: new Date().toLocaleString(),
							https_self_cert_expiry: `${self.userconfig.https_self_expiry} days`,
						}

						self.set_userconfig_keys(cert)
					} else {
						self.system.emit('log', 'userconfig', 'error', `Couldn't renew certificate: not all pems returned`)
						debug(`Couldn't renew certificate: not all pems returned`)
					}
				} catch (e) {
					self.system.emit('log', 'userconfig', 'error', `Couldn't renew certificate: ${e.message}`)
					debug(`Couldn't renew certificate: ${e}`)
				}
			})

			socket.on('ssl_certificate_delete', function () {
				self.set_userconfig_keys({
					https_self_cert: '',
					https_self_cert_created: '',
					https_self_cert_cn: '',
					https_self_cert_expiry: '',
					https_self_cert_private: '',
					https_self_cert_public: '',
				})
			})
		})
	})
}

userconfig.prototype.set_userconfig_key = function (key, value) {
	var self = this

	self.userconfig[key] = value
	debug('set_userconfig_key', key, value)
	self.system.emit('log', 'set_userconfig(' + key + ')', 'info', 'new value: ' + value)
	self.io.emit('set_userconfig_key', key, value)
	setImmediate(() => {
		// give the change a chance to be pushed to the ui first
		self.system.emit('set_userconfig_key', key, value)
		self.system.emit('db_set', 'userconfig', self.userconfig)
		self.system.emit('db_save')
	})
}

userconfig.prototype.set_userconfig_keys = function (objects) {
	var self = this

	if (objects !== undefined) {
		for (let key in objects) {
			let value = objects[key]
			self.userconfig[key] = value
			debug('set_userconfig_key', key, value)
			self.io.emit('set_userconfig_key', key, value)
			setImmediate(() => {
				// give the change a chance to be pushed to the ui first
				self.system.emit('set_userconfig_key', key, value)
			})
		}
		self.system.emit('log', 'set_userconfig', 'info', 'multiple keys')
		setImmediate(() => {
			self.system.emit('db_set', 'userconfig', self.userconfig)
			self.system.emit('db_save')
		})
	}
}

userconfig.prototype.checkV2InPlaceUpgrade = function () {
	var self = this

	self.system.emit('db_is_first_run', function (is_first_run) {
		if (!is_first_run) {
			// This is an existing db, so setup defaults to keep behavior the same
			const legacy_config = {
				tcp_enabled: true,
				tcp_listen_port: 51234,

				udp_enabled: true,
				udp_listen_port: 51235,

				osc_enabled: true,
				osc_listen_port: 12321,

				emberplus_enabled: true,

				xkeys_enable: false,
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
				debug('Running one-time userconfig v2 upgrade')
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

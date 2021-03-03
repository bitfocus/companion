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
const { SendResult } = require('./resources/utils')

class userconfig {
	constructor(system) {
		this.system = system

		this.userconfig = {}

		this.system.emit('db_get', 'userconfig', (config) => {
			if (config === undefined) {
				config = {}
			}

			this.userconfig = config

			for (var key in config) {
				this.system.emit('set_userconfig_key', key, config[key])
			}
		})

		this.system.on('get_userconfig', (cb) => {
			cb(this.userconfig)
		})

		this.system.emit('io_get', (io) => {
			this.system.on('io_connect', (client) => {
				debug('client ' + client.id + ' connected')

				client.on('set_userconfig_key', (key, value) => {
					this.userconfig[key] = value
					debug('set_userconfig_key', key, value)
					this.system.emit('log', 'set_userconfig(' + key + ')', 'info', 'new value: ' + value)
					client.broadcast.emit('set_userconfig_key', key, value)
					this.system.emit('set_userconfig_key', key, value)
					this.system.emit('db_save')
				})

				client.on('get_userconfig_all', (answer) => {
					SendResult(client, answer, 'get_userconfig_all', this.userconfig)
				})

				client.on('disconnect', () => {
					debug('client ' + client.id + ' disconnected')
				})
			})
		})
	}
}

module.exports = function (system) {
	return new userconfig(system)
}

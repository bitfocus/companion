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

var _http = require('http')
var util = require('util')
var debug = require('debug')('lib/server_http')

function server_http(system, express) {
	var self = this

	_http.Server.call(self, express)

	self.listen_for_http = function () {
		if (self !== undefined && self.close !== undefined) {
			self.close()
		}
		try {
			self
				.on('error', function (e) {
					if (e.code == 'EADDRNOTAVAIL') {
						debug('EADDRNOTAVAIL: ' + self.config.bind_ip)
						system.emit('skeleton-ip-unavail')
						system.emit('skeleton-info', 'appURL', self.config.bind_ip + ' unavailable. Select another IP')
						system.emit('skeleton-info', 'appStatus', 'Error')
					} else {
						debug(e)
					}
				})
				.listen(self.config.http_port, self.config.bind_ip, function () {
					debug('new url:', 'http://' + self.address().address + ':' + self.address().port + '/')
					let ip = self.config.bind_ip == '0.0.0.0' ? '127.0.0.1' : self.config.bind_ip
					let url = `http://${ip}:${self.address().port}/`
					let info = self.config.bind_ip == '0.0.0.0' ? `All Interfaces: e.g. ${url}` : url
					system.emit('skeleton-info', 'appStatus', 'Running')
					system.emit('skeleton-info', 'appURL', info)
					system.emit('skeleton-info', 'appLaunch', url)
				})
		} catch (e) {
			debug('http bind error', e)
		}
	}

	system.emit('config_object', function (config) {
		self.config = config
		system.on('ip_rebind', self.listen_for_http)
	})

	return self
}
util.inherits(server_http, _http.Server)

server_http.prototype.log = function () {
	var self = this
	var args = Array.prototype.slice.call(arguments)
	args.unshift('log', 'http')
	debug(args)
}

exports = module.exports = function (system, express) {
	return new server_http(system, express)
}

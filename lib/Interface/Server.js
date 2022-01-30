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

const { Server: _http } = require('http')

exports = module.exports = function (system, express) {
	return new InterfaceServer(system, express)
}

class InterfaceServer extends _http {
	debug = require('debug')('lib/Interface/Server')

	constructor(system, express) {
		super(express)
		this.system = system

		this.system.on('http_rebind', this.listen_for_http.bind(this))
	}

	listen_for_http(bind_ip, http_port) {
		this.bind_ip = bind_ip
		this.http_port = http_port

		if (this !== undefined && this.close !== undefined) {
			this.close()
		}
		try {
			this.on('error', (e) => {
				if (e.code == 'EADDRNOTAVAIL') {
					this.debug('EADDRNOTAVAIL: ' + this.bind_ip)
					this.system.emit('http-bind-status', {
						appStatus: 'Error',
						appURL: `${this.bind_ip} unavailable. Select another IP`,
						appLaunch: null,
					})
				} else {
					this.debug(e)
				}
			}).listen(this.http_port, this.bind_ip, () => {
				this.debug('new url:', 'http://' + this.address().address + ':' + this.address().port + '/')
				let ip = this.bind_ip == '0.0.0.0' ? '127.0.0.1' : this.bind_ip
				let url = `http://${ip}:${this.address().port}/`
				let info = this.bind_ip == '0.0.0.0' ? `All Interfaces: e.g. ${url}` : url
				this.system.emit('http-bind-status', {
					appStatus: 'Running',
					appURL: info,
					appLaunch: url,
				})
			})
		} catch (e) {
			this.debug('http bind error', e)
		}
	}

	log() {
		let args = Array.prototype.slice.call(arguments)
		args.unshift('log', 'http')
		this.debug(args)
	}
}

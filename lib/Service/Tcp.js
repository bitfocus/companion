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

const debug = require('debug')('lib/Service/Tcp')
const ServiceTcpBase = require('./TcpBase')

class ServiceTcp extends ServiceTcpBase {
	constructor(registry, api) {
		super(registry, 'tcp_server')
		this.debug = debug
		this.api = api

		this.port = 51234

		this.init()
	}

	processIncoming(client, chunk) {
		let i = 0,
			line = '',
			offset = 0
		this.receivebuffer += chunk

		while ((i = this.receivebuffer.indexOf('\n', offset)) !== -1) {
			line = this.receivebuffer.substr(offset, i - offset)
			offset = i + 1

			this.api.parseApiCommand(line.toString().replace(/\r/, ''), (err, res) => {
				if (err == null) {
					this.debug('{$this.logSource} command succeeded')
				} else {
					this.debug('{$this.logSource} command failed')
				}

				client.write(res + '\n')
			})
		}

		this.receivebuffer = this.receivebuffer.substr(offset)
	}
}

exports = module.exports = ServiceTcp

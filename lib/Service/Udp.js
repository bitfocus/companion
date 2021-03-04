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

const debug = require('debug')('lib/Service/Udp')
const ServiceUdpBase = require('./UdpBase')

class ServiceUdp extends ServiceUdpBase {
	constructor(registry, api) {
		super(registry, 'udp_server')
		this.debug = debug
		this.api = api

		this.port = 51235

		this.init()
	}

	processIncoming(data, remote) {
		this.debug(remote.address + ':' + remote.port + ' received packet: ' + data.toString().trim())

		this.api.parseApiCommand(data.toString(), (err, res) => {
			if (err == null) {
				this.debug('UDP command succeeded')
			} else {
				this.debug('UDP command failed')
			}
		})
	}
}

exports = module.exports = ServiceUdp

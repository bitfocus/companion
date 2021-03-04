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

const debug = require('debug')('lib/Service/Rosstalk')
const ServiceTcpBase = require('./TcpBase')

class ServiceRosstalk extends ServiceTcpBase {
	constructor(registry) {
		super(registry, 'rosstalk', { rosstalk_enabled: false }, 'rosstalk_enabled')
		this.debug = debug

		this.port = 7788

		this.releaseTime = 20 // ms to send button release

		this.init()
	}

	pressButton(page, bank) {
		page = parseInt(page)
		bank = parseInt(bank)

		this.log('debug', `Push button ${page}.${bank}`)
		this.system.emit('bank_pressed', page, bank, true)

		setTimeout(() => {
			this.log('debug', `Release button ${page}.${bank}`)
			this.system.emit('bank_pressed', page, bank, false)
		}, this.releaseTime)
	}

	processIncomming(client, data) {
		data = data.toString('utf8')
		// Type, bank/page, CC/bnt number
		const match = data.match(/(CC) ([0-9]*)\:([0-9]*)/)

		if (match === null) {
			this.log('warn', `Invalid incomming command: ${data}`)
			return
		}

		if (match[1] === 'CC') {
			this.pressButton(match[2], match[3])
		}
	}
}

exports = module.exports = ServiceRosstalk

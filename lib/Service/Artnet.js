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

const debug = require('debug')('lib/Service/Artnet')
const ServiceUdpBase = require('./UdpBase')

class ServiceArtnet extends ServiceUdpBase {
	constructor(registry) {
		super(registry, 'artnet', { artnet_enabled: false, artnet_universe: '1', artnet_channel: '1' }, 'artnet_enabled')
		this.debug = debug

		this.port = 6454

		this.currentPage = 0
		this.currentBank = 0
		this.currentDir = 0

		this.init()
	}

	processIncoming(msg, remote) {
		const sequence = msg.readUInt8(12, true)
		const physical = msg.readUInt8(13, true)
		const universe = msg.readUInt8(14, true)
		const offset = msg.readUInt8(16, true)
		const length = msg.readUInt8(17, true)

		let rawData = []

		for (let i = 18; i < 18 + 255; i++) {
			rawData.push(msg.readUInt8(i, true))
		}

		const packet = {
			sequence: sequence,
			physical: physical,
			universe: universe,
			length: length,
			data: rawData,
		}

		if (parseInt(packet.universe) === parseInt(this.userconfig().getKey('artnet_universe'))) {
			const ch = parseInt(this.userconfig().getKey('artnet_channel'))

			if (ch >= 1) {
				ch -= 1
			}

			const dmxPage = parseInt(packet.data[ch])
			const dmxBank = parseInt(packet.data[ch + 1])
			const dmxDir = parseInt(packet.data[ch + 2])

			if (dmxPage !== this.currentPage || dmxBank !== this.currentBank || dmxDir !== this.currentDir) {
				this.currentPage = dmxPage
				this.currentBank = dmxBank
				this.currentDir = dmxDir

				if (dmxDir == 0 || dmxPage == 0 || dmxBank == 0) {
					return
				}

				// down
				if (dmxDir > 128) {
					this.system.emit('bank_pressed', dmxPage, dmxBank, false)
				}
				// up
				else if (dmxDir >= 10) {
					this.system.emit('bank_pressed', dmxPage, dmxBank, true)
				}
			}
		}
	}
}

exports = module.exports = ServiceArtnet

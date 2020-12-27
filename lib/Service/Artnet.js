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

var debug          = require('debug')('lib/Service/Artnet');
var ServiceUdpBase = require('./UdpBase');

class ServiceArtnet extends ServiceUdpBase {

	constructor(registry) {
		super(registry, 'artnet', {artnet_enabled: false, artnet_universe: '1', artnet_channel: '1'}, 'artnet_enabled');
		this.debug = debug;

		this.port = 6454;

		this.current_page = 0;
		this.current_bank = 0;
		this.current_dir  = 0;

		this.init();
	}

	processIncoming(msg, remote) {
		var sequence = msg.readUInt8(12,true);
		var physical = msg.readUInt8(13,true);
		var universe = msg.readUInt8(14,true);
		var offset = msg.readUInt8(16,true);
		var length = msg.readUInt8(17,true);

		var rawData = [];

		for (var i = 18; i < 18 + 255; i++) {
			rawData.push( msg.readUInt8(i,true) );
		}

		var packet = {
			sequence: sequence,
			physical: physical,
			universe: universe,
			length: length,
			data: rawData
		};

		if (parseInt(packet.universe) === parseInt(this.userconfig.getKey('artnet_universe'))) {
			var ch = parseInt(this.userconfig.getKey('artnet_channel'));
			if (ch >= 1) ch -= 1;

			var dmx_page = parseInt(packet.data[ch]);
			var dmx_bank = parseInt(packet.data[ch+1]);
			var dmx_dir = parseInt(packet.data[ch+2]);

			if (dmx_page !== this.current_page || dmx_bank !== this.current_bank || dmx_dir !== this.current_dir) {
				this.current_page = dmx_page;
				this.current_bank = dmx_bank;
				this.current_dir  = dmx_dir;

				if (dmx_dir == 0 || dmx_page == 0 || dmx_bank == 0) {
					return;
				}

				// down
				if (dmx_dir > 128) {
					this.system.emit('bank_pressed', dmx_page, dmx_bank, false);
				}
				// up
				else if (dmx_dir >= 10) {
					this.system.emit('bank_pressed', dmx_page, dmx_bank, true);
				}
			}
		}
	}
}

exports = module.exports = ServiceArtnet;
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

var debug = require('debug')('lib/artnet');
var dgram = require('dgram');

class artnet {

	constructor(system) {
		this.system = system;

		this.config = {};
		this.currentState = false;
		this.port = 6454;

		this.current_page = 0;
		this.current_bank = 0;
		this.current_dir  = 0;

		this.system.emit('get_userconfig', (obj) => {
			this.config = obj;

			this.setDefaults();

			if (this.config['artnet_enabled'] === true) {
				this.enableModule();
			}
		});

		this.system.on('set_userconfig_key', (key,val) => {

			if (key == 'artnet_enabled') {
				if (this.currentState == false && val == true) {
					this.enableModule();
				}
				else if (this.currentState == true && val == false) {
					this.disableModule();
				}
			}
		});
	}

	disableModule() {
		this.currentState = false;
		this.system.emit('log', 'artnet', 'debug', 'Stopped listening on port ' + this.port);

		if (this.socket) {
			try {
				this.socket.close();
			}
			catch(e) {

			}
		}
	}

	enableModule() {
		try {
			this.listen();
			this.currentState = true;
			this.system.emit('log', 'artnet', 'debug', 'Listening on port ' + this.port);
		}
		catch(e) {
			console.log("Error listening for artnet",e);
		}
	}

	listen() {

		if (this.socket === undefined) {
			this.socket = dgram.createSocket("udp4", (msg, peer) => {

				var sequence = msg.readUInt8(12,true);
				var physical = msg.readUInt8(13,true);
				var universe = msg.readUInt8(14,true);
				var offset = msg.readUInt8(16,true);
				var length = msg.readUInt8(17,true);

				var rawData = [];

				for (var i = 18; i < 18 + 255; i++) {
					rawData.push( msg.readUInt8(i,true) );
				}

				var retData = {
					sequence: sequence,
					physical: physical,
					universe: universe,
					length: length,
					data: rawData
				};

				this.processIncoming(retData);
			});

			this.socket.on('error', (err) => {
				debug('server error:', err.stack);
				this.socket.close();
			});

			this.socket.bind(this.port);
		}
	}

	processIncoming(packet) {

		if (this.config['artnet_enabled'] == true) {
			// this.config['artnet_channel']
			// this.config['artnet_universe']
			if (parseInt(packet.universe) === parseInt(this.config['artnet_universe'])) {
				var ch = parseInt(this.config['artnet_channel']);
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

	setDefaults() {

		if (this.config['artnet_enabled'] === undefined) {
			this.config['artnet_enabled'] = false;
			this.system.emit('set_userconfig_key', 'artnet_enabled', this.config['artnet_enabled'])
		}

		if (this.config['artnet_universe'] === undefined || this.config['artnet_universe'] == "") {
			this.config['artnet_universe'] = "1";
			this.system.emit('set_userconfig_key', 'artnet_universe', this.config['artnet_universe'])
		}

		if (this.config['artnet_channel'] === undefined || this.config['artnet_channel'] == "") {
			this.config['artnet_channel'] = "1";
			this.system.emit('set_userconfig_key', 'artnet_channel', this.config['artnet_channel'])
		}
	}
}

module.exports = function (system) {
	return new artnet(system);
};

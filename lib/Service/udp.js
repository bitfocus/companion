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

var debug = require('debug')('lib/Service/udp');
var dgram = require('dgram');

class UdpServer {

	constructor(registry) {
		this.registry = registry
		this.system = this.registry.system;

		this.currentState = false;
		this.port = 51235;

		this.enableModule();
	}

	disableModule() {
		this.currentState = false;
		this.system.emit('log', 'UDP Server', 'debug', 'Stopped listening for UDP commands on port ' + this.port);

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
			this.system.emit('log', 'UDP Server', 'debug', 'Listening for UDP commands on port ' + this.port);
		}
		catch(e) {
			system.emit('log', 'UDP Server', 'error', 'Couldn\'t bind to UDP port ' + this.port);
		}
	}

	listen() {

		if (this.socket === undefined) {
			this.socket = dgram.createSocket("udp4", this.processIncoming.bind(this));

			this.socket.on('error', (err) => {
				debug('UDP server error:', err.stack);
				//this.socket.close();
			});

			this.socket.bind(this.port);
		}
	}

	processIncoming(data, remote) {
		debug(remote.address + ':' + remote.port +' received packet: ' + data.toString().trim() );

		this.system.emit('server_api_command', data.toString(), (err, res) => {
			if (err == null) {
				debug("UDP command succeeded");
			}
			else {
				debug("UDP command failed")
			}
		});
	}
}

exports = module.exports = UdpServer;
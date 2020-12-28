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

const ServiceBase = require('./Base');
const dgram       = require('dgram');

class ServiceUdpBase extends ServiceBase {

	listen() {

		if (this.socket === undefined) {
			try {
				this.socket = dgram.createSocket("udp4", this.processIncoming.bind(this));

				this.socket.on('error', (err) => {
					debug('UDP server error:', err.stack);
					//this.socket.close();
				});

				this.socket.bind(this.port);
				this.currentState = true;
				this.log('debug', 'Listening on port ' + this.port);
				this.debug('Listening on port ' + this.port);
			}
			catch(e) {
				debug('UDP server error:', e.stack);
			}
		}
	}
}

exports = module.exports = ServiceUdpBase;
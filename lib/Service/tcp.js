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

var debug = require('debug')('lib/Service/tcp');
var net   = require('net');

class ServiceTcp {

	constructor(registry, api) {
		this.registry = registry
		this.system = this.registry.system;
		this.api = api;

		this.currentState = false;
		this.port = 51234;
		this.clients = [];

		this.enableModule();
	}

	disableModule() {
		this.currentState = false;
		this.system.emit('log', 'TCP Server', 'debug', 'Stopped listening for TCP commands on port ' + this.port);

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
			this.system.emit('log', 'TCP Server', 'debug', 'Listening for TCP commands on port ' + this.port);
		}
		catch(e) {
			system.emit('log', 'TCP Server', 'error', 'Couldn\'t bind to TCP port ' + this.port);
		}
	}

	listen() {

		if (this.socket === undefined) {
			this.socket = net.createServer((client) => {

				client.on('end', () => {
					this.clients.splice(this.clients.indexOf(client), 1);
					debug('Client disconnected: ' + client.name);
					this.system.emit('log', 'TCP Server', 'debug', 'Client disconnected: ' + client.name);
				});
		
				client.on('error', () => {
					this.clients.splice(this.clients.indexOf(client), 1);
					debug('Client debug disconnected: ' + client.name);
					this.system.emit('log', 'TCP Server', 'error', 'Client errored/died: ' + client.name);
				});
		
				client.name = client.remoteAddress + ":" + client.remotePort;
				this.clients.push(client);
				debug('Client connected: ' + client.name);
		
				system.emit('log', 'TCP Server', 'debug', 'Client connected: ' + client.name);
		
				// separate buffered stream into lines with responses
				var receivebuffer = "";
		
				client.on('data', (chunk) => {
					var i = 0, line = '', offset = 0;
					receivebuffer += chunk;
					while ( (i = receivebuffer.indexOf('\n', offset)) !== -1) {
						line = receivebuffer.substr(offset, i - offset);
						offset = i + 1;
						this.processIncoming(client, line);
					}
					receivebuffer = receivebuffer.substr(offset);
				});
		
			});

			this.socket.on('error', (err) => {
				debug('TCP server error:', err.stack);
				//this.socket.close();
			});
		
			this.socket.listen(this.port);
		}
	}

	processIncoming(client, line) {

		this.api.parseApiCommand(line.toString().replace(/\r/, ""), (err, res) => {
			if (err == null) {
				debug("TCP command succeeded");
			}
			else {
				debug("TCP command failed")
			}

			client.write(res + "\n");
		});
	}
}

exports = module.exports = ServiceTcp;
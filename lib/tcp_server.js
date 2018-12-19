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

var debug = require('debug')('lib/tcp_server');
var net   = require('net');

function tcp_server(system) {

	var self = this;

	self.ready = true;
	self.system = system;
	self.clients = [];

	self.server = net.createServer(function (socket) {

		socket.name = socket.remoteAddress + ":" + socket.remotePort;
		self.clients.push(socket);

		system.emit('log', 'TCP Server', 'debug', 'Client connected: ' + socket.name);

		//socket.write("Welcome " + socket.name + "\n");

		socket.on('data', function (data) {

			if (data.length > 0) {
				var command = data.toString();

				var match;

				if (match = command.match(/^(exit|die|quit|bye)\n?$/i)) {
					self.clients.splice(self.clients.indexOf(socket), 1);
					debug(socket.name + " disconnected");
					socket.write("+OK " + match[1] + "!\n");
					socket.destroy();
				}

				else if (match = command.match(/^(press|up|down) (\d+) (\d+)\n?$/i)) {

					var func = match[1].toLowerCase();
					var page = parseInt(match[2]);
					var bank = parseInt(match[3]);

					if (page > 0 && page <= 99 && bank > 0 && bank <= 15) {
						system.emit('log', 'TCP Server', 'debug', func + ': ' + page + "." + bank);

						if (func == 'press') {

							debug("Got /press/bank/ (trigger)",page,"button",bank);
							system.emit('bank-pressed', page, bank, true);

							setTimeout(function (){
								debug("Auto releasing /press/bank/ (trigger)",page,"button",bank);
								system.emit('bank-pressed', page, bank, false);
							}, 20);

						}

						else if (func == 'down') {
							system.emit('bank-pressed', page, bank, true);
						}

						else if (func == 'up') {
							system.emit('bank-pressed', page, bank, false);
						}

						socket.write("+OK\n");
					}

					else {
						socket.write("-ERR Page/bank out of range\n");
					}

				}
				else {
					socket.write("-ERR Syntax error\n");
				}

			}
		});

		socket.on('end', function () {
			self.clients.splice(self.clients.indexOf(socket), 1);
			debug(socket.name + " disconnected");
			system.emit('log', 'TCP Server', 'debug', 'Client disconnected: ' + socket.name);
		});

	});

	try {
		debug("Trying: listen to tcp 51234");
		self.server.listen(51234);
		system.emit('log', 'TCP Server', 'info', 'Listening for TCP commands on port 51234');
	} catch(e) {
		system.emit('log', 'TCP Server', 'error', 'TCP Server', 'Couldnt bind to TCP port 51234');
	}

	return self;
}

exports = module.exports = function (system) {
	return new tcp_server(system);
};

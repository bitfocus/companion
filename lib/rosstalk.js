/*
 * This file is part of the Companion project
 * Copyright (c) Oliver Herrmann
 * Authors: Oliver Herrmann <oliver@monoxane.com>
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

var debug = require('debug')('lib/rosstalk');
var net = require('net');

function rosstalk(system) {
	var self = this;
	self.ready = true;
	self.system = system;
	self.panel_size = 12;
	self.userconfig = {};

	// get userconfig object
	system.emit('get_userconfig', function(userconfig) {
		self.userconfig = userconfig;
		self.panel_size = self.userconfig.panel_size;
		if (typeof self.panel_size != 'number') {
			system.emit('set_userconfig_key', 'panel_size', 12)
			self.panel_size = 12;
		};
	});

	system.on('set_userconfig_key', function(key,val) {
		if (key == 'panel_size') {
			self.panel_size = val
		}
	});

	self.rosstalk = net.createServer(function(socket) {
		socket.on('data', function(data){
			data = data.toString('utf8')
			if (data.match(/CC (([1-9]|([1-9][0-9])):((\b((1[1-2])|[1-9])\b)))/g)) {
				button = parseInt(data.replace('CC ','').split(":")[1])
				bank = parseInt(data.replace('CC ','').split(":")[0])
				debug('CC', bank, ':', button)
				system.emit('bank-pressed', bank, button, true);
				system.emit('log', 'RossTalk CC', 'debug', 'Button ' + bank + '.' + button + ' pressed');

				setTimeout(function (){
					system.emit('bank-pressed', bank, button, false);
					system.emit('log', 'RossTalk CC', 'debug', 'Button ' + bank + '.' + button + ' released');
				}, 20);
			}
			if (data.match(/GPI [0-9]*/g)) {
				button = parseInt(data.replace('GPI ',''))%self.panel_size,
				bank = Math.ceil(parseInt(data.replace('GPI ','')/self.panel_size))+1
				debug('GPI', data.replace('GPI ',''), '=', bank, button)
				system.emit('bank-pressed', bank, button, true);
				system.emit('log', 'RossTalk GPI', 'debug', 'Button ' + bank + '.' + button + ' pressed');

				setTimeout(function (){
					system.emit('bank-pressed', bank, button, false);
					system.emit('log', 'RossTalk GPI', 'debug', 'Button ' + bank + '.' + button + ' released');
				}, 20);
			}
		});
	});

	self.rosstalk.listen(7788, '0.0.0.0');
	debug("listening for rosstalk on port 7788")

	return self;
}

exports = module.exports = function (system) {
	return new rosstalk(system);
};

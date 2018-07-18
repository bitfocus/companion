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

var debug   = require('debug')('lib/osc');
var OSC     = require('osc')

function osc(system) {
	var self = this;
	self.ready = true;
	self.system = system;

	self.listener = new OSC.UDPPort({
		localAddress: "0.0.0.0",
		localPort: 12321,
		metadata: true
	});

	self.listener.open();

	self.listener.on("ready", function () {
		self.ready = true;
	});

	self.listener.on("message", function (message) {
		var a = message.address.split("/");
		if (a[1] == 'press' && a[2] == 'bank' && a[3] !== undefined && a[4] !== undefined && a[5] == undefined) {
			if ((message.args.length == 0) || (message.args.length > 0 && message.args[0].type == 'i' && message.args[0].value == '1')) {
				debug("Got /press/bank/ for bank",parseInt(a[3]),"button",parseInt(a[4]));
				system.emit('bank-pressed',parseInt(a[3]),parseInt(a[4]));
			}
		}
	});

	self.system.on('osc_send', function(host, port, path, args) {
		self.listener.send({
			address: path,
			args: args
		}, host, port);
	});

	return self;
}

exports = module.exports = function (system) {
	return new osc(system);
};

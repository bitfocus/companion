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

var util    = require("util");
var _io     = require('socket.io');
var debug   = require('debug')('lib/io');
var system;

function io(_system, http) {
	var self = this;
	system = _system;
	self.modules = {};
	self.system = _system;

	_io.call(self, http);

	// We have a lot of on('connect') listeners
	self.setMaxListeners(20);

	self.system.on('io_get', function (cb) {
		if (typeof cb == 'function') {
			cb(self);
		}
	});

	self.initIO();
}
util.inherits(io, _io);

io.prototype.initIO = function() {
	var self = this;

	self.on('connect', function (client) {
		debug('connect');
		system.emit('skeleton-info-info', function(hash) {
			client.emit('skeleton-info', hash);
		});
	});
};

exports = module.exports = function (_system, http) {
	return new io(_system, http);
};

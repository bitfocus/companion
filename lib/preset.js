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

var system;
var debug   = require('debug')('lib/preset');
var shortid = require('shortid');

function preset(system) {
	var self = this;

	self.system = system;
	self.presets = {};

	self.system.emit('io_get', function(io) {
		self.io = io;
		self.io.on('connect', function(client) {

			client.on('get_presets', function() {
				client.emit('get_presets:result', self.presets);
			});

		});
	});

	self.system.on('preset_instance_definitions_set', function (instance, presets) {
		self.presets[instance.id] = presets;
		self.io.emit('presets_update', instance.id, presets);
	});

	return self;
}

exports = module.exports = function (system) {
	return new preset(system);
};

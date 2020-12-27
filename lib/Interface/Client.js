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

var debug   = require('debug')('lib/Interface/Client');
var IO      = require('socket.io');

class InterfaceClient extends IO {

	constructor(registry) {
		super(registry.server_http);

		this.registry = registry
		this.system = this.registry.system;

		this.modules = {};

		this.system.on('io_get', (cb) => {
			if (typeof cb == 'function') {
				cb(this);
			}
		});

		this.init();
	}

	init() {
		this.on('connect', (client) => {
			debug('client ' + client.id + ' connected');

			this.system.emit('skeleton-info-info', (hash) => {
				client.emit('skeleton-info', hash);
			});

			this.system.emit('io_connect', client);
		});
		this.on('disconnect', (client) => {
			debug('client ' + client.id + ' disconnected');
		});
	}
}

exports = module.exports = InterfaceClient;
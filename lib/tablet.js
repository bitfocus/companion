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

var debug   = require('debug')('lib/tablet');

class tablet {

	constructor(system) {
		this.system = system;
		this.tablet = {};

		this.system.on('get_tablet', (cb) => {
			cb(this.tablet);
		});

		this.system.emit('io_get', (io) => {
			this.system.on('io_connect', (client) => {
				debug('client ' + client.id + ' connected');

				client.on('tablet_startup', () => {});

				client.on('disconnect', () => {
					debug('client ' + client.id + ' disconnected');
				});
			});
		});
	}
}

module.exports = function (system) {
	return new tablet(system);
};

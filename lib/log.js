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

var debug   = require('debug')('lib/log');

class log {

	constructor(system,io) {
		this.system = system;
		this.io = io;
		this.history = [
			[Date.now(), 'log', 'info', 'Application started']
		];

		this.system.on('log', this.add.bind(this));

		system.on('io_connect', (client) => {
			client.on('log_clear', () => {
				client.broadcast.emit('log_clear');
				this.clear();
			});

			client.on('log_catchup', () => {
				for (var n in this.history) {
					var arr = this.history[n];
					client.emit('log', arr[0], arr[1], arr[2], arr[3]);
				}
			});
		});
	}

	add(source, level, message) {

		if (level) {
			var now = Date.now();
			this.io.emit('log', now, source, level, message);
			this.history.push([now, source, level, message])

			if (this.history.length > 500) {
				this.history.shift();
			}
		}
	}

	clear() {
		this.history = [];
		this.io.emit('log', Date.now(), 'log', 'info', 'Log cleared');
	}
}

exports = module.exports = function (system,io) {
	return new log(system,io);
};

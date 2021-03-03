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

var debug   = require('debug')('lib/page');
const { SendResult } = require('./resources/utils');

class page {

	constructor(system) {
		this.system = system;

		this.pages = {};

		this.system.emit('db_get', 'page', this.setupPages.bind(this));

		this.system.on('page_set_noredraw', this.setPageNoRedraw.bind(this));

		this.system.on('page_set', this.setPage.bind(this));

		this.system.on('get_page', this.getPages.bind(this));

		this.system.emit('io_get', (io) => {
			this.io = io;

			this.system.on('io_connect', (client) => {
				debug('client ' + client.id + ' connected');

				client.on('set_page', (key, value) => {
					debug('client: set_page ' + key, value);
					this.setPage(key, value);
				});

				client.on('get_page_all', (answer) => {
					debug("client: get_page_all");
					SendResult(client, answer, 'get_page_all', this.pages);
				});
			});
		});
	}

	getPages(cb) {
		if (cb !== undefined && typeof cb == 'function') {
			cb(this.pages);
		}
	}

	setPage(page, name) {
		debug('Set page ' + page + ' to ', name);
		this.pages[page] = name;

		if (io !== undefined) {
			io.broadcast.emit('set_page', page, name);
		}
		else if (this.io !== undefined) {
			this.io.emit('set_page', page, name);
		}

		this.system.emit('db_set', 'page', this.pages);
		this.system.emit('page_update', page, name);
		this.system.emit('db_save');
	}

	setPageNoRedraw(page, name) {
		debug('NR: Set page ' + page + ' to ', name);
		this.pages[page] = name;

		if (this.io !== undefined) {
			this.io.emit('set_page', page, name);
		}
	}

	setupPages(config) {
		this.pages = config;

		// Default values
		if (this.pages === undefined) {
			this.pages = {};
			for (var n = 1; n <= 99; n++) {
				if (this.pages[''+n] === undefined) {
					this.pages[''+n] = {
						name: 'PAGE'
					};
				}
			}
		}
	}
}

module.exports = function (system) {
	return new page(system);
};

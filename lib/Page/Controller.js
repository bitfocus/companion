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

var debug = require('debug')('Page/Controller')
var CoreBase = require('../Core/Base')

class PageController extends CoreBase {
	constructor(registry) {
		super(registry, 'page')

		this.pages = this.db.getKey('page')

		this.setupPages()

		this.system.on('page_set_noredraw', this.setPageNoRedraw.bind(this))

		this.system.on('page_set', this.setPage.bind(this))

		this.system.on('get_page', this.getPages.bind(this))

		this.system.on('io_connect', (client) => {
			client.on('set_page', (key, value) => {
				debug('client: set_page ' + key, value)
				this.setPage(key, value)
			})

			client.on('get_page_all', (answer) => {
				debug('client: get_page_all')
				answer(this.pages)
			})
		})
	}

	getPages(cb) {
		if (cb !== undefined && typeof cb == 'function') {
			cb(this.pages)
		}
	}

	setPage(page, name) {
		debug('Set page ' + page + ' to ', name)
		this.pages[page] = name

		this.io.emit('set_page', page, name)

		this.db.setKey('page', this.pages)
		this.system.emit('page_update', page, name)
		//this.db.setDirty();
	}

	setPageNoRedraw(page, name) {
		debug('NR: Set page ' + page + ' to ', name)
		this.pages[page] = name

		if (this.io !== undefined) {
			this.io.emit('set_page', page, name)
		}
	}

	setupPages() {
		// Default values
		if (this.pages === undefined) {
			this.pages = {}
			for (var n = 1; n <= 99; n++) {
				if (this.pages['' + n] === undefined) {
					this.pages['' + n] = {
						name: 'PAGE',
					}
				}
			}
		}
	}
}

exports = module.exports = PageController

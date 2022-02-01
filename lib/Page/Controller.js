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

const { cloneDeep } = require('lodash')
const CoreBase = require('../Core/Base')

class PageController extends CoreBase {
	constructor(registry) {
		super(registry, 'page', 'lib/Page/Controller')

		this.pages = this.db.getKey('page')

		this.setupPages()

		this.system.emit('io_get', (io) => {
			this.system.on('io_connect', this.clientConnect.bind(this))
		})
	}

	clientConnect(client) {
		client.on('set_page', (key, value) => {
			this.debug('socket: set_page ' + key, value)
			this.setPage(key, value)
		})

		client.on('get_page_all', (answer) => {
			this.debug('socket: get_page_all')

			if (typeof answer === 'function') {
				answer(this.pages)
			} else {
				socket.emit('get_page_all', this.pages)
			}
		})
	}
	getAll(clone = false) {
		let out

		if (this.pages !== undefined) {
			if (clone === true) {
				out = cloneDeep(this.pages)
			} else {
				out = this.pages
			}
		}

		return out
	}

	getPage(page, clone = false) {
		let out

		if (this.pages[page] !== undefined) {
			if (clone === true) {
				out = cloneDeep(this.pages[page])
			} else {
				out = this.pages[page]
			}
		}

		return out
	}

	getPageName(page) {
		let out = ''

		if (this.pages[page] !== undefined && this.pages[page].name !== undefined) {
			out = this.pages[page].name
		}

		return out
	}

	setPage(page, value, redraw = true) {
		this.debug('Set page ' + page + ' to ', value)
		this.pages[page] = value

		this.io.emit('set_page', page, value)

		this.db.setKey('page', this.pages)

		if (redraw === true) {
			this.debug('page controls invalidated for page', page)
			this.system.emit('graphics_page_controls_invalidated', page)
			this.preview.updateWebButtonsPage(page)
		}
	}

	setupPages() {
		// Default values
		if (this.pages === undefined) {
			this.pages = {}

			for (let n = 1; n <= 99; n++) {
				if (this.pages['' + n] === undefined) {
					this.pages['' + n] = {
						name: 'PAGE',
					}
				}
			}

			this.db.setKey('page', this.pages)
		}
	}
}

module.exports = PageController

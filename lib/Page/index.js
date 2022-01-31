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

class Page {
	debug = require('debug')('lib/Page')

	constructor(system) {
		this.system = system

		this.page = {}

		this.system.emit('db_get', 'page', (config) => {
			this.page = config

			// Default values
			if (this.page === undefined) {
				this.page = {}
				for (let n = 1; n <= 99; n++) {
					if (this.page['' + n] === undefined) {
						this.page['' + n] = {
							name: 'PAGE',
						}
					}
				}
			}
		})

		this.system.on('page_set_noredraw', (page, name) => {
			this.debug('NR: Set page ' + page + ' to ', name)
			this.page[page] = name
			this.io.emit('set_page', page, name)
		})

		this.system.on('page_set', (page, value) => {
			this.debug('Set page ' + page + ' to ', value)
			this.page[page] = value

			this.io.emit('set_page', page, value)

			this.system.emit('db_set', 'page', this.page)
			this.system.emit('page_update', page, value)
			this.system.emit('db_save')
		})

		this.system.on('get_page', (cb) => {
			cb(this.page)
		})

		this.system.emit('io_get', (io) => {
			this.io = io

			this.system.on('io_connect', (socket) => {
				this.debug('socket ' + socket.id + ' connected')

				socket.on('set_page', (key, value) => {
					this.debug('socket: set_page ' + key, value)
					this.system.emit('page_set', key, value)
				})

				socket.on('get_page_all', (answer) => {
					this.debug('socket: get_page_all')

					if (typeof answer === 'function') {
						answer(this.page)
					} else {
						socket.emit('get_page_all', this.page)
					}
				})

				socket.on('disconnect', () => {
					this.debug('socket ' + socket.id + ' disconnected')
				})
			})
		})
	}
}

module.exports = Page

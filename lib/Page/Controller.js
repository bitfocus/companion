const CoreBase = require('../Core/Base')

class PageController extends CoreBase {
	debug = require('debug')('Page/Controller')
	pages
	constructor(registry) {
		super(registry, 'page')

		this.pages = this.db.getKey('page')

		this.setupPages()

		this.system.on('page_set_noredraw', this.setPageNoRedraw.bind(this))

		this.system.on('page_set', this.setPage.bind(this))

		this.system.on('get_page', this.getPages.bind(this))

		this.system.on('io_connect', (client) => {
			client.on('set_page', (key, value) => {
				this.debug('client: set_page ' + key, value)
				this.setPage(key, value)
			})

			client.on('get_page_all', (answer) => {
				this.debug('client: get_page_all')
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
		this.debug('Set page ' + page + ' to ', name)
		this.pages[page] = name

		this.io.emit('set_page', page, name)

		this.db.setKey('page', this.pages)
		this.system.emit('page_update', page, name)
		//this.db.setDirty();
	}

	setPageNoRedraw(page, name) {
		this.debug('NR: Set page ' + page + ' to ', name)
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

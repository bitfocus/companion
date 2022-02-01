const { cloneDeep } = require('lodash')
const { sendResult } = require('../Resources/Util')
const CoreBase = require('../Core/Base')

/**
 * The class that manages the user pages
 *
 * @extends CoreBase
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 1.1.0
 * @copyright 2022 Bitfocus AS
 * @license
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for Companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 */
class PageController extends CoreBase {
	/**
	 * Create a new application page controller
	 * @param {Registry} registry - the application core
	 */
	constructor(registry) {
		super(registry, 'page', 'lib/Page/Controller')

		this.pages = this.db.getKey('page')

		this.setupPages()

		this.system.emit('io_get', (io) => {
			this.system.on('io_connect', this.clientConnect.bind(this))
		})
	}

	/**
	 * Setup a new socket client's events
	 * @param {SocketIO} client - the client socket
	 */
	clientConnect(client) {
		client.on('set_page', (key, value) => {
			this.debug('socket: set_page ' + key, value)
			this.setPage(key, value)
		})

		client.on('get_page_all', (answer) => {
			this.debug('socket: get_page_all')
			sendResult(client, answer, 'get_page_all', this.pages)
		})
	}

	/**
	 * Get the entire page table
	 * @param {boolean} [clone = false] - <code>true</code> if a copy should be returned
	 * @returns 
	 */
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

	/**
	 * Get a specific page object
	 * @param {string} page - the page id
	 * @param {boolean} [clone = false] - <code>true</code> if a copy should be returned
	 * @returns 
	 */
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

	/**
	 * Get the name for a page
	 * @param {string} page - the page id
	 * @returns {string} the page's name
	 */
	getPageName(page) {
		let out = ''

		if (this.pages[page] !== undefined && this.pages[page].name !== undefined) {
			out = this.pages[page].name
		}

		return out
	}

	/**
	 * Set/update a page
	 * @param {string} page - the page id
	 * @param {Object} value - the page object containing the name
	 * @param {boolean} [clone = false] - <code>true</code> if the graphics should invalidate
	 */
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

	/**
	 * Load the page table with defaults
	 */
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

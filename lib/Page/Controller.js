import { cloneDeep } from 'lodash-es'
import CoreBase from '../Core/Base.js'
import Registry from '../Registry.js'

const PagesRoom = 'pages'

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
	 * Cache the location of each control
	 */
	#locationCache = new Map()

	/**
	 * @param {Registry} registry - the application core
	 */
	constructor(registry) {
		super(registry, 'page', 'Page/Controller')

		this.pages = this.db.getKey('page')

		this.#setupPages()
	}

	/**
	 * Setup a new socket client's events
	 * @param {SocketIO} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
		client.onPromise('pages:set-name', (page, name) => {
			this.logger.silly(`socket: pages:set-name ${page}: ${name}`)

			const existingData = this.pages[page]
			if (!existingData) throw new Error(`Page "${page}" does not exist`)

			this.logger.silly('Set page name ' + page + ' to ', name)
			this.pages[pageNumber].name = name

			this.#commitChanges(pageNumber, this.pages[pageNumber], redraw)
		})

		client.onPromise('pages:subscribe', () => {
			this.logger.silly('socket: get_page_all')

			client.join(PagesRoom)

			return this.pages
		})
		client.onPromise('pages:unsubscribe', () => {
			client.leave(PagesRoom)
		})
	}

	/**
	 * Get the entire page table
	 * @param {boolean} [clone = false] - <code>true</code> if a copy should be returned
	 * @returns {Object} the pages
	 * @access public
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

	getAllControlIdsOnPage(pageNumber) {
		const page = this.pages[pageNumber]
		if (page) {
			return Object.values(page.controls)
		} else {
			return []
		}
	}

	getAllPopulatedCoordinates(pageNumber) {
		const page = this.pages[pageNumber]
		if (page) {
			return Object.keys(page.controls)
		} else {
			return []
		}
	}

	isPageValid(pageNumber) {
		return !!this.pages[pageNumber]
	}

	getLocationOfControlId(controlId) {
		return this.#locationCache.get(controlId)
	}

	/**
	 * Set the controlId at a specific coordinate
	 * @param {number} pageNumber
	 * @param {string} coordinate
	 * @param {string} controlId
	 * @returns
	 */
	setControlIdAt(pageNumber, coordinate, controlId) {
		const page = this.pages[pageNumber]
		if (page) {
			// Update the cache
			const oldControlId = page.controls[coordinate]
			if (oldControlId) {
				this.#locationCache.delete(oldControlId)
			}

			if (controlId) {
				page.controls[coordinate] = controlId
				this.#locationCache.set(controlId, { pageNumber, coordinate })
			} else {
				delete page.controls[coordinate]
			}

			this.#commitChanges(pageNumber, page, false)

			return true
		} else {
			return false
		}
	}

	/**
	 * Get the controlId at a specific coordinate
	 * @param {number} pageNumber
	 * @param {string} coordinate
	 * @returns
	 */
	getControlIdAt(pageNumber, coordinate) {
		const page = this.pages[pageNumber]
		if (page) {
			return page.controls[coordinate]
		} else {
			return null
		}
	}

	/**
	 * Get a specific page object
	 * @param {string} page - the page id
	 * @param {boolean} [clone = false] - <code>true</code> if a copy should be returned
	 * @returns the requested page
	 * @access public
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
	 * @access public
	 */
	getPageName(page) {
		let out = ''

		if (this.pages[page] !== undefined && this.pages[page].name !== undefined) {
			out = this.pages[page].name
		}

		return out
	}
	/**
	 * Reset a page to defaults and empty
	 * Note: Controls will be orphaned if not explicitly deleted
	 * @param {string} pageNumber - the page id
	 * @param {boolean} [clone = false] - <code>true</code> if the graphics should invalidate
	 * @returns ControlIds referenced on the page
	 * @access public
	 */
	resetPage(pageNumber, redraw = true) {
		const oldPage = this.pages[pageNumber]

		// Clear cache for old controls
		if (this.pages[pageNumber]) {
			for (const controlId of Object.values(oldPage)) {
				this.#locationCache.delete(controlId)
			}
		}

		this.logger.silly('Reset page ' + pageNumber)
		this.pages[pageNumber] = { name: 'PAGE', controls: {} }

		this.#commitChanges(pageNumber, this.pages[pageNumber], redraw)

		return Object.values(oldPage?.controls ?? {}).filter(Boolean)
	}

	/**
	 * Set/update a page
	 * @param {string} pageNumber - the page id
	 * @param {Object} value - the page object containing the name
	 * @param {boolean} [clone = false] - <code>true</code> if the graphics should invalidate
	 * @access public
	 */
	importPage(pageNumber, value, redraw = true) {
		this.resetPage(pageNumber, false)

		if (value) {
			value = cloneDeep({
				...value,
				// Control's must be setup explicitly
				controls: {},
			})

			this.logger.silly('Set page ' + pageNumber + ' to ', value)
			this.pages[pageNumber] = value

			this.#commitChanges(pageNumber, value, redraw)
		}
	}

	#commitChanges(pageNumber, newValue, redraw = true) {
		this.io.emitToRoom(PagesRoom, 'pages:update', pageNumber, newValue)

		this.db.setKey('page', this.pages)

		this.emit('name', pageNumber, newValue?.name)

		if (redraw) {
			this.logger.silly('page controls invalidated for page', pageNumber)
			this.#invalidatePageNumberControls(pageNumber, newValue)
		}
	}

	/**
	 * Redraw the page number control on the specified page
	 * @param {number} page
	 */
	#invalidatePageNumberControls(pageNumber, newValue) {
		if (newValue?.controls) {
			for (const [coordinate, controlId] of Object.entries(newValue.controls)) {
				const control = this.controls.getControl(controlId)
				if (control && control.type === 'pagenum') {
					this.graphics.invalidateBank(pageNumber, coordinate)
				}
			}
		}
	}

	/**
	 * Load the page table with defaults
	 * @access protected
	 */
	#setupPages() {
		// Default values
		if (!this.pages) {
			this.pages = {}

			for (let n = 1; n <= 99; n++) {
				if (!this.pages['' + n]) {
					this.pages['' + n] = {
						name: 'PAGE',
						controls: {},
					}
				}
			}

			this.db.setKey('page', this.pages)
		}

		// Setup #locationCache
		for (const [pageNumber, pageInfo] of Object.entries(this.pages)) {
			for (const [coordinate, controlId] of Object.entries(pageInfo.controls)) {
				this.#locationCache.set(controlId, { pageNumber, coordinate })
			}
		}
	}
}

export default PageController

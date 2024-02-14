import { cloneDeep } from 'lodash-es'
import CoreBase from '../Core/Base.js'
import { oldBankIndexToXY } from '../Shared/ControlId.js'

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
	 * @access private
	 * @readonly
	 */
	#locationCache = new Map()

	/**
	 * Persisted pages data
	 * @type {Record<number, import('../Shared/Model/PageModel.js').PageModel>}
	 * @access private
	 * @readonly
	 */
	#pages

	/**
	 * @param {import('../Registry.js').default} registry - the application core
	 */
	constructor(registry) {
		super(registry, 'page', 'Page/Controller')

		this.#pages = this.db.getKey('page', {}) ?? {}

		this.#setupPages()
	}

	/**
	 * Setup a new socket client's events
	 * @param {import('../UI/Handler.js').ClientSocket} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
		client.onPromise('pages:set-name', (/** @type {number} */ pageNumber, /** @type {string} */ name) => {
			this.logger.silly(`socket: pages:set-name ${pageNumber}: ${name}`)

			const existingData = this.#pages[pageNumber]
			if (!existingData) throw new Error(`Page "${pageNumber}" does not exist`)

			this.logger.silly('Set page name ' + pageNumber + ' to ', name)
			this.#pages[pageNumber].name = name

			this.#commitChanges(pageNumber, this.#pages[pageNumber], true)
		})

		client.onPromise('pages:subscribe', () => {
			this.logger.silly('socket: get_page_all')

			client.join(PagesRoom)

			return this.#pages
		})
		client.onPromise('pages:unsubscribe', () => {
			client.leave(PagesRoom)
		})
	}

	/**
	 * Get the entire page table
	 * @param {boolean} [clone = false] - <code>true</code> if a copy should be returned
	 * @returns {Record<string, import('../Shared/Model/PageModel.js').PageModel>} the pages
	 * @access public
	 */
	getAll(clone = false) {
		if (clone) {
			return cloneDeep(this.#pages)
		} else {
			return this.#pages
		}
	}

	/**
	 * Get all ControlIds on the specified page
	 * @param {number} pageNumber
	 * @returns {string[]}
	 */
	getAllControlIdsOnPage(pageNumber) {
		const page = this.#pages[pageNumber]
		if (page) {
			return Object.values(page.controls)
				.flatMap((row) => Object.values(row))
				.filter(Boolean)
		} else {
			return []
		}
	}

	/**
	 * Get all populated locations on the specified page
	 * @param {number} pageNumber
	 * @returns {import('../Resources/Util.js').ControlLocation[]}
	 */
	getAllPopulatedLocationsOnPage(pageNumber) {
		const page = this.#pages[pageNumber]
		if (page) {
			/** @type {import('../Resources/Util.js').ControlLocation[]} */
			const locations = []
			for (const row of Object.keys(page.controls)) {
				const rowObj = page.controls[Number(row)]
				if (!rowObj) continue

				for (const column of Object.keys(rowObj)) {
					const controlId = rowObj[Number(column)]
					if (controlId) {
						locations.push({
							pageNumber: Number(pageNumber),
							column: Number(column),
							row: Number(row),
						})
					}
				}
			}

			return locations
		} else {
			return []
		}
	}

	/**
	 * Check whether a page number exists
	 * @param {number} pageNumber
	 * @returns {boolean}
	 */
	isPageValid(pageNumber) {
		return !!this.#pages[pageNumber]
	}

	/**
	 * Get the location of a controlId
	 * @param {string} controlId
	 * @returns {import('../Resources/Util.js').ControlLocation | undefined}
	 */
	getLocationOfControlId(controlId) {
		return this.#locationCache.get(controlId)
	}

	/**
	 * Set the controlId at a specific location
	 * @param {*} location
	 * @param {string | null} controlId
	 * @returns {boolean}
	 */
	setControlIdAt(location, controlId) {
		const page = this.#pages[location.pageNumber]
		if (page) {
			if (!page.controls[location.row]) page.controls[location.row] = {}
			// Update the cache
			const oldControlId = page.controls[location.row][location.column]
			if (oldControlId) {
				this.#locationCache.delete(oldControlId)
			}

			if (controlId) {
				page.controls[location.row][location.column] = controlId
				this.#locationCache.set(controlId, cloneDeep(location))
			} else {
				delete page.controls[location.row][location.column]
			}

			this.#commitChanges(location.pageNumber, page, false)

			return true
		} else {
			return false
		}
	}

	/**
	 * Get the controlId at a specific location
	 * @param {import('../Resources/Util.js').ControlLocation} location
	 * @returns {string | null}
	 */
	getControlIdAt(location) {
		const page = this.#pages[location.pageNumber]
		if (page) {
			return page.controls[location.row]?.[location.column]
		} else {
			return null
		}
	}

	/**
	 * Get the controlId at a specific location
	 * @param {number} pageNumber
	 * @param {number} bank
	 * @returns {string | null}
	 */
	getControlIdAtOldBankIndex(pageNumber, bank) {
		const xy = oldBankIndexToXY(bank)
		if (xy) {
			return this.getControlIdAt({
				pageNumber,
				column: xy[0],
				row: xy[1],
			})
		} else {
			return null
		}
	}

	/**
	 * Get a specific page object
	 * @param {number} page - the page id
	 * @param {boolean} [clone = false] - <code>true</code> if a copy should be returned
	 * @returns {import('../Shared/Model/PageModel.js').PageModel | undefined} the requested page
	 * @access public
	 */
	getPage(page, clone = false) {
		let out

		if (this.#pages[page] !== undefined) {
			if (clone === true) {
				out = cloneDeep(this.#pages[page])
			} else {
				out = this.#pages[page]
			}
		}

		return out
	}

	/**
	 * Get the name for a page
	 * @param {number} page - the page id
	 * @returns {string} the page's name
	 * @access public
	 */
	getPageName(page) {
		let out = ''

		if (this.#pages[page] !== undefined && this.#pages[page].name !== undefined) {
			out = this.#pages[page].name
		}

		return out
	}

	/**
	 * Reset a page to defaults and empty
	 * Note: Controls will be orphaned if not explicitly deleted
	 * @param {number} pageNumber - the page id
	 * @param {boolean} [redraw = false] - <code>true</code> if the graphics should invalidate
	 * @returns ControlIds referenced on the page
	 * @access public
	 */
	resetPage(pageNumber, redraw = true) {
		const removedControls = this.getAllControlIdsOnPage(pageNumber)

		// Clear cache for old controls
		if (this.#pages[pageNumber]) {
			for (const controlId of Object.values(this.#pages[pageNumber])) {
				this.#locationCache.delete(controlId)
			}
		}

		this.logger.silly('Reset page ' + pageNumber)
		this.#pages[pageNumber] = { name: 'PAGE', controls: {} }

		this.#commitChanges(pageNumber, this.#pages[pageNumber], redraw)

		return removedControls
	}

	/**
	 * Finds all controls that are outside of the valid grid bounds
	 * @returns {string[]}
	 * @access public
	 */
	findAllOutOfBoundsControls() {
		/** @type {string[]} */
		const foundControlIds = []

		const { minColumn, maxColumn, minRow, maxRow } = this.userconfig.getKey('gridSize')

		for (const page of Object.values(this.#pages)) {
			for (const row of Object.keys(page.controls)) {
				const rowObj = page.controls[Number(row)]
				if (!rowObj) continue

				if (row < minRow || row > maxRow) {
					// Row is out of bounds, delete it all
					foundControlIds.push(...Object.values(rowObj))
				} else {
					for (const column of Object.keys(rowObj)) {
						if (column < minColumn || column > maxColumn) {
							// Column is out of bounds
							foundControlIds.push(rowObj[Number(column)])
						}
					}
				}
			}
		}

		return foundControlIds
	}

	/**
	 * Set/update a page
	 * @param {number} pageNumber - the page id
	 * @param {Omit<import('../Shared/Model/PageModel.js').PageModel, 'controls'>} value - the page object containing the name
	 * @param {boolean} [redraw = false] - <code>true</code> if the graphics should invalidate
	 * @access public
	 */
	importPage(pageNumber, value, redraw = true) {
		this.resetPage(pageNumber, false)

		if (value) {
			const fullValue = cloneDeep({
				...value,
				// Control's must be setup explicitly
				controls: {},
			})

			this.logger.silly('Set page ' + pageNumber + ' to ', value)
			this.#pages[pageNumber] = fullValue

			this.#commitChanges(pageNumber, fullValue, redraw)
		}
	}

	/**
	 * Commit changes to a page entry
	 * @param {number} pageNumber
	 * @param {import('../Shared/Model/PageModel.js').PageModel} newValue
	 * @param {boolean} redraw
	 */
	#commitChanges(pageNumber, newValue, redraw = true) {
		if (this.io.countRoomMembers(PagesRoom) > 0) {
			this.io.emitToRoom(PagesRoom, 'pages:update', pageNumber, newValue)
		}

		this.db.setKey('page', this.#pages)

		this.emit('name', pageNumber, newValue?.name)

		if (redraw) {
			this.logger.silly('page controls invalidated for page', pageNumber)
			this.#invalidatePageNumberControls(pageNumber, newValue)
		}
	}

	/**
	 * Redraw the page number control on the specified page
	 * @param {number} pageNumber
	 * @param {import('../Shared/Model/PageModel.js').PageModel} newValue
	 */
	#invalidatePageNumberControls(pageNumber, newValue) {
		if (newValue?.controls) {
			for (const [row, rowObj] of Object.entries(newValue.controls)) {
				for (const [column, controlId] of Object.entries(rowObj)) {
					const control = this.controls.getControl(controlId)
					if (control && control.type === 'pagenum') {
						this.graphics.invalidateButton({
							pageNumber: Number(pageNumber),
							column: Number(column),
							row: Number(row),
						})
					}
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
		if (Object.keys(this.#pages).length === 0) {
			for (let n = 1; n <= 99; n++) {
				if (!this.#pages[n]) {
					this.#pages[n] = {
						name: 'PAGE',
						controls: {},
					}
				}
			}

			this.db.setKey('page', this.#pages)

			setImmediate(() => {
				// @ts-ignore
				this.registry.data.importExport.createInitialPageButtons(99)
			})
		}

		// Setup #locationCache
		for (const [pageNumber, pageInfo] of Object.entries(this.#pages)) {
			for (const [row, rowObj] of Object.entries(pageInfo.controls)) {
				for (const [column, controlId] of Object.entries(rowObj)) {
					this.#locationCache.set(controlId, {
						pageNumber: Number(pageNumber),
						column: Number(column),
						row: Number(row),
					})
				}
			}
		}
	}
}

export default PageController

import { cloneDeep } from 'lodash-es'
import CoreBase from '../Core/Base.js'
import { oldBankIndexToXY } from '../Shared/ControlId.js'
import { nanoid } from 'nanoid'
import jsonPatch from 'fast-json-patch'

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
	 * Pages data
	 * @type {Record<string, import('../Shared/Model/PageModel.js').PageModel>}
	 * @access private
	 * @readonly
	 */
	#pagesById = {}

	/**
	 * Page ids by index
	 * @type {string[]}
	 * @access private
	 */
	#pageIds = []

	/**
	 * Last sent data to clients
	 * @type {Record<number, import('../Shared/Model/PageModel.js').PageModel> | null}
	 * @access private
	 */
	#lastClientJson = null

	/**
	 * @param {import('../Registry.js').default} registry - the application core
	 */
	constructor(registry) {
		super(registry, 'page', 'Page/Controller')

		const rawPageData = this.db.getKey('page', {}) ?? {}

		this.#setupPages(rawPageData)
	}

	/**
	 * Setup a new socket client's events
	 * @param {import('../UI/Handler.js').ClientSocket} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
		client.onPromise('pages:set-name', (/** @type {number} */ pageNumber, /** @type {string} */ name) => {
			this.logger.silly(`socket: pages:set-name ${pageNumber}: ${name}`)

			const existingData = this.getPageInfo(pageNumber)
			if (!existingData) throw new Error(`Page "${pageNumber}" does not exist`)

			this.logger.silly('Set page name ' + pageNumber + ' to ', name)
			existingData.name = name

			this.#commitChanges([pageNumber], true)
		})

		client.onPromise('pages:subscribe', () => {
			this.logger.silly('socket: get_page_all')

			client.join(PagesRoom)

			if (!this.#lastClientJson) this.#lastClientJson = this.getAll(true)

			return this.#lastClientJson
		})
		client.onPromise('pages:unsubscribe', () => {
			client.leave(PagesRoom)
		})
	}

	/**
	 * Deletes a page
	 * Note: Controls will be orphaned if not explicitly deleted by the caller
	 * @param {number} pageNumber - the page id
	 * @returns ControlIds referenced on the page
	 * @access public
	 */
	deletePage(pageNumber) {
		this.logger.silly('Delete page ' + pageNumber)

		console.log('delete page', pageNumber)

		if (pageNumber === 1 && this.getPageCount() == 1) throw new Error(`Can't delete last page`)

		const removedControls = this.getAllControlIdsOnPage(pageNumber)

		// Fetch the page and ensure it exists
		const pageInfo = this.getPageInfo(pageNumber)
		if (!pageInfo) return removedControls

		// Delete the info for the page
		delete this.#pagesById[pageInfo.id]
		this.#pageIds.splice(pageNumber - 1, 1)

		// Rebuild location cache
		this.#rebuildLocationCache()

		// Update cache for controls on later pages
		const changedPageNumbers = this.#updateAndRedrawAllPagesAfter(pageNumber)

		// the list is a page shorter, ensure the 'old last' page is reported as undefined
		const missingPageNumber = this.#pageIds.length + 1
		changedPageNumbers.push(missingPageNumber)
		this.graphics.clearAllForPage(missingPageNumber)
		this.#commitChanges(changedPageNumbers, false)

		// inform other interested controllers
		this.emit('pagecount', this.getPageCount())

		return removedControls
	}

	/**
	 * Update page info and all renders for pages following
	 * @param {number} firstPageNumber
	 * @return {number[]} pageNumbers
	 */
	#updateAndRedrawAllPagesAfter(firstPageNumber) {
		const pageNumbers = []

		for (let pageNumber = firstPageNumber; pageNumber <= this.#pageIds.length; pageNumber++) {
			const pageInfo = this.getPageInfo(pageNumber)
			if (!pageInfo) continue

			this.#invalidateAllControls(pageNumber, pageInfo)

			pageNumbers.push(pageNumber)
		}

		return pageNumbers
	}

	/**
	 * Get the entire page table
	 * @param {boolean} [clone = false] - <code>true</code> if a copy should be returned
	 * @returns {Record<number, import('../Shared/Model/PageModel.js').PageModel>} the pages
	 * @access public
	 */
	getAll(clone = false) {
		/** @type {Record<number, import('../Shared/Model/PageModel.js').PageModel>} **/
		const savePages = {}
		this.#pageIds.map((id, index) => {
			const pageInfo = this.#pagesById[id]
			savePages[index + 1] = pageInfo || {
				id: nanoid(),
				name: 'PAGE',
				controls: {},
			}
		})

		if (clone) {
			return cloneDeep(savePages)
		} else {
			return savePages
		}
	}

	/**
	 * Get all ControlIds on the specified page
	 * @param {number} pageNumber
	 * @returns {string[]}
	 */
	getAllControlIdsOnPage(pageNumber) {
		const page = this.getPageInfo(pageNumber)
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
		const page = this.getPageInfo(pageNumber)
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
		return !!this.getPageInfo(pageNumber)
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
	 * @param {import('../Resources/Util.js').ControlLocation} location
	 * @param {string | null} controlId
	 * @returns {boolean}
	 */
	setControlIdAt(location, controlId) {
		const page = this.getPageInfo(location.pageNumber)
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

			this.#commitChanges([location.pageNumber], false)

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
		const page = this.getPageInfo(location.pageNumber)
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
	 * Get the total number of pages
	 * @returns number
	 */
	getPageCount() {
		return this.#pageIds.length
	}

	/**
	 * Get a specific page object
	 * @param {number} pageNumber - the page id
	 * @param {boolean} [clone = false] - <code>true</code> if a copy should be returned
	 * @returns {import('../Shared/Model/PageModel.js').PageModel | undefined} the requested page
	 * @access public
	 */
	getPageInfo(pageNumber, clone = false) {
		const pageId = this.#pageIds[pageNumber - 1]
		if (!pageId) return undefined

		const pageInfo = this.#pagesById[pageId]
		if (clone) {
			return cloneDeep(pageInfo)
		} else {
			return pageInfo
		}
	}

	/**
	 * Get the name for a page
	 * @param {number} pageNumber - the page id
	 * @returns {string | undefined} the page's name
	 * @access public
	 */
	getPageName(pageNumber) {
		const pageInfo = this.getPageInfo(pageNumber)
		if (!pageInfo) return undefined
		return pageInfo.name ?? ''
	}

	/**
	 * Reset a page to defaults and empty
	 * Note: Controls will be orphaned if not explicitly deleted by the caller
	 * @param {number} pageNumber - the page id
	 * @param {boolean} [redraw = false] - <code>true</code> if the graphics should invalidate
	 * @returns ControlIds referenced on the page
	 * @access public
	 */
	resetPage(pageNumber, redraw = true) {
		this.logger.silly('Reset page ' + pageNumber)

		const removedControls = this.getAllControlIdsOnPage(pageNumber)

		// Fetch the page and ensure it exists
		const pageInfo = this.getPageInfo(pageNumber)
		if (!pageInfo) return removedControls

		// Clear cache for old controls
		for (const controlId of Object.values(pageInfo.controls)) {
			this.#locationCache.delete(controlId)
		}

		// Reset relevant properties, but not the id
		pageInfo.name = 'PAGE'
		pageInfo.controls = {}

		this.#commitChanges([pageNumber], redraw)

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

		for (const page of Object.values(this.#pagesById)) {
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
	 * @param {string} name - the page object containing the name
	 * @param {boolean} [redraw = true] - <code>true</code> if the graphics should invalidate
	 * @access public
	 */
	setPageName(pageNumber, name, redraw = true) {
		const pageInfo = this.getPageInfo(pageNumber)
		if (!pageInfo) {
			throw new Error('Page must be created before it can be imported to')
		}

		pageInfo.name = name

		this.logger.silly('Set page ' + pageNumber + ' to ', name)

		this.#commitChanges([pageNumber], redraw)
	}

	/**
	 * Commit changes to a page entry
	 * @param {number[]} pageNumbers
	 * @param {boolean} redraw
	 */
	#commitChanges(pageNumbers, redraw = true) {
		const newJson = this.getAll(true)
		if (this.io.countRoomMembers(PagesRoom) > 0) {
			const patch = jsonPatch.compare(this.#lastClientJson || {}, newJson || {})
			if (patch.length > 0) {
				this.io.emitToRoom(PagesRoom, 'pages:patch', patch)
			}
		}
		this.#lastClientJson = newJson

		this.db.setKey('page', this.getAll(false))

		for (const pageNumber of pageNumbers) {
			const pageInfo = this.getPageInfo(pageNumber)

			this.emit('name', pageNumber, pageInfo ? pageInfo.name ?? '' : undefined)

			if (redraw && pageInfo) {
				this.logger.silly('page controls invalidated for page', pageNumber)
				this.#invalidatePageNumberControls(pageNumber, pageInfo)
			}
		}
	}

	/**
	 * Redraw the page number control on the specified page
	 * @param {number} pageNumber
	 * @param {import('../Shared/Model/PageModel.js').PageModel} pageInfo
	 */
	#invalidatePageNumberControls(pageNumber, pageInfo) {
		if (pageInfo?.controls) {
			for (const [row, rowObj] of Object.entries(pageInfo.controls)) {
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
	 * Redraw allcontrols on the specified page
	 * @param {number} pageNumber
	 * @param {import('../Shared/Model/PageModel.js').PageModel} pageInfo
	 */
	#invalidateAllControls(pageNumber, pageInfo) {
		if (pageInfo?.controls) {
			this.graphics.clearAllForPage(pageNumber)

			for (const [row, rowObj] of Object.entries(pageInfo.controls)) {
				for (const [column, controlId] of Object.entries(rowObj)) {
					const control = this.controls.getControl(controlId)
					if (control) {
						this.graphics.invalidateButton({
							pageNumber: pageNumber,
							column: Number(column),
							row: Number(row),
						})
					}
				}
			}
		}
	}

	#rebuildLocationCache() {
		this.#locationCache.clear()

		this.#pageIds.forEach((pageId, pageIndex) => {
			const pageNumber = pageIndex + 1
			const pageInfo = this.#pagesById[pageId]
			if (!pageInfo) return

			for (const [row, rowObj] of Object.entries(pageInfo.controls)) {
				for (const [column, controlId] of Object.entries(rowObj)) {
					this.#locationCache.set(controlId, {
						pageNumber: Number(pageNumber),
						column: Number(column),
						row: Number(row),
					})
				}
			}
		})
	}

	/**
	 * Load the page table with defaults
	 * @param {Record<string, import('../Shared/Model/PageModel.js').PageModel>} rawPageData
	 * @access protected
	 */
	#setupPages(rawPageData) {
		// Load existing data
		for (let i = 1; true; i++) {
			const pageInfo = rawPageData[i]
			if (!pageInfo) break

			// Ensure each page has an id defined
			if (!pageInfo.id) pageInfo.id = nanoid()

			this.#pagesById[pageInfo.id] = pageInfo
			this.#pageIds.push(pageInfo.id)
		}

		// Default values
		if (this.#pageIds.length === 0) {
			/** @type {import('../Shared/Model/PageModel.js').PageModel} */
			const newPageInfo = {
				id: nanoid(),
				name: 'PAGE',
				controls: {},
			}

			// Create a single page
			this.#pagesById[newPageInfo.id] = newPageInfo
			this.#pageIds = [newPageInfo.id]

			this.db.setKey('page', { 1: newPageInfo })

			setImmediate(() => {
				// @ts-ignore
				this.registry.data.importExport.createInitialPageButtons(1)
			})
		}

		// Setup #locationCache
		this.#rebuildLocationCache()
	}
}

export default PageController

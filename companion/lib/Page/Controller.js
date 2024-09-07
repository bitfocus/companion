import { cloneDeep } from 'lodash-es'
import CoreBase from '../Core/Base.js'
import { oldBankIndexToXY } from '@companion-app/shared/ControlId.js'
import { nanoid } from 'nanoid'
import { default_nav_buttons_definitions } from './Defaults.js'

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
	 * @type {Map<string, import('@companion-app/shared/Model/Common.js').ControlLocation>}
	 * @access private
	 * @readonly
	 */
	#locationCache = new Map()

	/**
	 * Pages data
	 * @type {Record<string, import('@companion-app/shared/Model/PageModel.js').PageModel>}
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
	 * @param {import('../Registry.js').default} registry - the application core
	 */
	constructor(registry) {
		super(registry, 'Page/Controller')

		const rawPageData = this.db.getKey('page', {}) ?? {}

		this.#setupPages(rawPageData)
	}

	/**
	 * Setup a new socket client's events
	 * @param {import('../UI/Handler.js').ClientSocket} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
		client.onPromise('pages:set-name', (pageNumber, name) => {
			this.logger.silly(`socket: pages:set-name ${pageNumber}: ${name}`)

			const existingData = this.getPageInfo(pageNumber)
			if (!existingData) throw new Error(`Page "${pageNumber}" does not exist`)

			this.logger.silly('Set page name ' + pageNumber + ' to ', name)
			existingData.name = name

			this.#commitChanges([pageNumber], true)

			this.io.emitToRoom(PagesRoom, 'pages:update', {
				updatedOrder: null,
				added: [],
				changes: [
					{
						id: existingData.id,
						name: name,
						controls: [],
					},
				],
			})
		})

		client.onPromise('pages:subscribe', () => {
			this.logger.silly('socket: get_page_all')

			client.join(PagesRoom)

			return {
				order: this.#pageIds,
				pages: this.#pagesById,
			}
		})
		client.onPromise('pages:unsubscribe', () => {
			client.leave(PagesRoom)
		})

		client.onPromise('pages:delete-page', (pageNumber) => {
			this.logger.silly(`Delete page ${pageNumber}`)

			if (this.getPageCount() === 1) return 'fail'

			// Delete the controls, and allow them to redraw
			const controlIds = this.getAllControlIdsOnPage(pageNumber)
			for (const controlId of controlIds) {
				this.controls.deleteControl(controlId)
			}

			// Delete the page
			this.deletePage(pageNumber)

			return 'ok'
		})

		client.onPromise('pages:insert-pages', (asPageNumber, pageNames) => {
			this.logger.silly(`Insert new page ${asPageNumber}`)

			// Delete the page
			const pageIds = this.insertPages(asPageNumber, pageNames)
			if (pageIds.length === 0) throw new Error(`Failed to insert pages`)

			// Add nav buttons
			for (let i = 0; i < pageIds.length; i++) {
				this.createPageDefaultNavButtons(asPageNumber + i)
			}

			return 'ok'
		})

		client.onPromise('pages:reset-page-clear', (pageNumber) => {
			this.logger.silly(`Reset page ${pageNumber}`)

			// Delete the controls, and allow them to redraw
			const controlIds = this.getAllControlIdsOnPage(pageNumber)
			for (const controlId of controlIds) {
				this.controls.deleteControl(controlId)
			}

			// Clear the references on the page
			this.resetPage(pageNumber)

			// Re-add the nav buttons
			this.createPageDefaultNavButtons(pageNumber)

			return 'ok'
		})

		client.onPromise('pages:move-page', (pageId, pageNumber) => {
			this.logger.silly(`Move page ${pageId} to ${pageNumber}`)

			// Bounds checks
			if (this.getPageCount() === 1) return 'fail'
			if (pageNumber < 1 || pageNumber > this.getPageCount()) return 'fail'

			// Find current index of the page
			const currentPageIndex = this.#pageIds.indexOf(pageId)
			if (currentPageIndex === -1) return 'fail'

			// move the page
			this.#pageIds.splice(currentPageIndex, 1)
			this.#pageIds.splice(pageNumber - 1, 0, pageId)

			// Update cache for controls on later pages
			const { changedPageNumbers, changedPageIds } = this.#updateAndRedrawAllPagesAfter(
				Math.min(currentPageIndex + 1, pageNumber),
				Math.max(currentPageIndex + 1, pageNumber)
			)

			// save and report changes
			this.#commitChanges(changedPageNumbers, false)
			this.io.emitToRoom(PagesRoom, 'pages:update', {
				updatedOrder: this.#pageIds,
				added: [],
				changes: [],
			})

			// inform other interested controllers
			this.emit('pageindexchange', changedPageIds)

			return 'ok'
		})

		client.onPromise('pages:reset-page-nav', (pageNumber) => {
			// make magical page buttons!
			this.createPageDefaultNavButtons(pageNumber)

			return 'ok'
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

		if (pageNumber === 1 && this.getPageCount() == 1) throw new Error(`Can't delete last page`)

		const removedControls = this.getAllControlIdsOnPage(pageNumber)

		// Fetch the page and ensure it exists
		const pageInfo = this.getPageInfo(pageNumber)
		if (!pageInfo) return removedControls

		// Delete the info for the page
		delete this.#pagesById[pageInfo.id]
		this.#pageIds.splice(pageNumber - 1, 1)

		// Update cache for controls on later pages
		const { changedPageNumbers, changedPageIds } = this.#updateAndRedrawAllPagesAfter(pageNumber, null)

		// the list is a page shorter, ensure the 'old last' page is reported as undefined
		const missingPageNumber = this.#pageIds.length + 1
		changedPageNumbers.push(missingPageNumber)
		this.graphics.clearAllForPage(missingPageNumber)
		changedPageIds.add(pageInfo.id)

		this.#commitChanges(changedPageNumbers, false)
		this.io.emitToRoom(PagesRoom, 'pages:update', {
			updatedOrder: this.#pageIds,
			added: [],
			changes: [],
		})

		// inform other interested controllers
		this.emit('pagecount', this.getPageCount())
		this.emit('pageindexchange', changedPageIds)

		return removedControls
	}

	/**
	 * Insert a new page, with the given page number
	 * @param {number} asPageNumber
	 * @param {string[]} pageNames
	 */
	insertPages(asPageNumber, pageNames) {
		if (asPageNumber > this.getPageCount() + 1 || asPageNumber <= 0) throw new Error('New page number is out of range')

		/** @type {import('@companion-app/shared/Model/PageModel.js').PageModel[]} */
		const insertedPages = []

		for (const pageName of pageNames) {
			/** @type {import('@companion-app/shared/Model/PageModel.js').PageModel} */
			const newPageInfo = {
				id: nanoid(),
				name: pageName ?? 'PAGE',
				controls: {},
			}

			// store the new page
			this.#pagesById[newPageInfo.id] = newPageInfo
			insertedPages.push(newPageInfo)
		}

		// Early exit if not inserting anything
		if (insertedPages.length === 0) {
			return []
		}

		const insertedPageIds = insertedPages.map((p) => p.id)

		this.#pageIds.splice(asPageNumber - 1, 0, ...insertedPageIds)

		// Update cache for controls on later pages
		const { changedPageNumbers, changedPageIds } = this.#updateAndRedrawAllPagesAfter(asPageNumber, null)

		// the list is a page shorter, ensure the 'old last' page is reported as undefined
		this.#commitChanges(changedPageNumbers, false)

		// inform clients
		this.io.emitToRoom(PagesRoom, 'pages:update', {
			updatedOrder: this.#pageIds,
			added: insertedPages,
			changes: [],
		})

		// inform other interested controllers
		this.emit('pagecount', this.getPageCount())
		this.emit('pageindexchange', changedPageIds)

		return insertedPageIds
	}

	/**
	 * Update page info and all renders for pages between two pages (inclusive)
	 * @param {number} firstPageNumber
	 * @param {number | null} lastPageNumber If null, run to the end
	 * @return {{changedPageNumbers: number[], changedPageIds: Set<string>}}
	 */
	#updateAndRedrawAllPagesAfter(firstPageNumber, lastPageNumber) {
		// Rebuild location cache
		this.#rebuildLocationCache()

		/** @type {number[]} */
		const changedPageNumbers = []
		/** @type {Set<string>} */
		const changedPageIds = new Set()

		if (lastPageNumber) {
			lastPageNumber = Math.min(lastPageNumber, this.#pageIds.length)
		} else {
			lastPageNumber = this.#pageIds.length
		}

		for (let pageNumber = firstPageNumber; pageNumber <= lastPageNumber; pageNumber++) {
			const pageInfo = this.getPageInfo(pageNumber)
			if (!pageInfo) continue

			this.#invalidateAllControlsOnPageNumber(pageNumber, pageInfo)

			changedPageNumbers.push(pageNumber)
			changedPageIds.add(pageInfo.id)
		}

		return { changedPageNumbers, changedPageIds }
	}

	/**
	 * Get the entire page table
	 * @param {boolean} [clone = false] - <code>true</code> if a copy should be returned
	 * @returns {Record<number, import('@companion-app/shared/Model/PageModel.js').PageModel>} the pages
	 * @access public
	 */
	getAll(clone = false) {
		/** @type {Record<number, import('@companion-app/shared/Model/PageModel.js').PageModel>} **/
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
	 * Get the id of the first page in the system
	 * @return {string}
	 */
	getFirstPageId() {
		return this.#pageIds[0]
	}

	/**
	 * Get the index of the given page id
	 * @param {string} pageId
	 * @returns {number | null}
	 */
	getPageNumber(pageId) {
		const index = this.#pageIds.indexOf(pageId)
		return index >= 0 ? index + 1 : null
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
	 * Check whether a page id exists
	 * @param {string} pageId
	 * @returns {boolean}
	 */
	isPageIdValid(pageId) {
		return this.#pagesById[pageId] !== undefined
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
			this.io.emitToRoom(PagesRoom, 'pages:update', {
				updatedOrder: null,
				added: [],
				changes: [
					{
						id: page.id,
						name: null,
						controls: [
							{
								row: location.row,
								column: location.column,
								controlId,
							},
						],
					},
				],
			})

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
	 * @returns {import('@companion-app/shared/Model/PageModel.js').PageModel | undefined} the requested page
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
	 * Get the page id for a page offset from the specified id
	 * @param {string} pageId
	 * @param {number} offset
	 * @returns {string|null}
	 */
	getOffsetPageId(pageId, offset) {
		const index = this.#pageIds.indexOf(pageId)
		if (index === -1) return null

		let newIndex = index + offset
		if (newIndex < 0)
			newIndex = this.#pageIds.length + newIndex // wrap around to the end
		else newIndex = newIndex % this.#pageIds.length // wrap around to the start

		return this.#pageIds[newIndex]
	}

	/**
	 * Reset a page to defaults and empty
	 * Note: Controls will be orphaned if not explicitly deleted by the caller
	 * @param {number} pageNumber - the page id
	 * @param {boolean} [redraw = true] - <code>true</code> if the graphics should invalidate
	 * @returns ControlIds referenced on the page
	 * @access public
	 */
	resetPage(pageNumber, redraw = true) {
		this.logger.silly('Reset page ' + pageNumber)

		const removedControls = this.getAllControlIdsOnPage(pageNumber)

		// Fetch the page and ensure it exists
		const pageInfo = this.getPageInfo(pageNumber)
		if (!pageInfo) return removedControls

		/** @type {import('@companion-app/shared/Model/PageModel.js').PageModelChangesItem['controls']} */
		const controlChanges = []

		// Clear cache for old controls
		for (const [row, rowObj] of Object.entries(pageInfo.controls)) {
			if (!rowObj) continue
			for (const [col, controlId] of Object.entries(rowObj)) {
				this.#locationCache.delete(controlId)
				controlChanges.push({
					row: Number(row),
					column: Number(col),
					controlId,
				})
			}
		}

		// Reset relevant properties, but not the id
		pageInfo.name = 'PAGE'
		pageInfo.controls = {}

		this.#commitChanges([pageNumber], redraw)
		this.io.emitToRoom(PagesRoom, 'pages:update', {
			updatedOrder: null,
			added: [],
			changes: [
				{
					id: pageInfo.id,
					name: pageInfo.name,
					controls: controlChanges,
				},
			],
		})

		return removedControls
	}

	/**
	 * Recreate the default nav buttons on a page
	 * @param {number} pageNumber - the page id
	 * @access public
	 */
	createPageDefaultNavButtons(pageNumber) {
		for (const { type, location } of default_nav_buttons_definitions) {
			const fullLocation = {
				...location,
				pageNumber,
			}
			const oldControlId = this.page.getControlIdAt(fullLocation)
			if (oldControlId) this.controls.deleteControl(oldControlId)

			this.controls.createButtonControl(fullLocation, type)
		}
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
		this.io.emitToRoom(PagesRoom, 'pages:update', {
			updatedOrder: null,
			added: [],
			changes: [
				{
					id: pageInfo.id,
					name: name,
					controls: [],
				},
			],
		})
	}

	/**
	 * Commit changes to a page entry
	 * @param {number[]} pageNumbers
	 * @param {boolean} redraw
	 */
	#commitChanges(pageNumbers, redraw = true) {
		this.db.setKey('page', this.getAll(false))

		for (const pageNumber of pageNumbers) {
			const pageInfo = this.getPageInfo(pageNumber)

			this.emit('name', pageNumber, pageInfo ? (pageInfo.name ?? '') : undefined)

			if (redraw && pageInfo) {
				this.logger.silly('page controls invalidated for page', pageNumber)
				this.#invalidatePageNumberControls(pageNumber, pageInfo)
			}
		}
	}

	/**
	 * Redraw the page number control on the specified page
	 * @param {number} pageNumber
	 * @param {import('@companion-app/shared/Model/PageModel.js').PageModel} pageInfo
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
	 * @param {import('@companion-app/shared/Model/PageModel.js').PageModel} pageInfo
	 */
	#invalidateAllControlsOnPageNumber(pageNumber, pageInfo) {
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
	 * @param {Record<string, import('@companion-app/shared/Model/PageModel.js').PageModel>} rawPageData
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
			/** @type {import('@companion-app/shared/Model/PageModel.js').PageModel} */
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
				this.createPageDefaultNavButtons(1)
			})
		}

		// Setup #locationCache
		this.#rebuildLocationCache()
	}
}

export default PageController

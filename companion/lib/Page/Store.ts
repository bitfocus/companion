import { nanoid } from 'nanoid'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { PageModel } from '@companion-app/shared/Model/PageModel.js'
import { EventEmitter } from 'events'
import type { DataStoreTableView } from '../Data/StoreBase.js'
import { oldBankIndexToXY } from '@companion-app/shared/ControlId.js'

interface PageStoreEvents {
	pagecount: [count: number]
	pageindexchange: [pageIds: Set<string>]

	controlLocationChanged: [controlId: string, location: ControlLocation | undefined]
	pageDataChanged: [pageNumber: number, pageInfo: PageModel | undefined]
}

/**
 * Public API interface for PageStore
 * This defines the contract for data access and basic operations
 */
export interface IPageStore extends EventEmitter<PageStoreEvents> {
	/**
	 * Get the entire page table
	 */
	getAll(): Record<number, PageModel>

	/**
	 * Get all ControlIds on the specified page
	 */
	getAllControlIdsOnPage(pageNumber: number): string[]

	/**
	 * Get all populated locations on the specified page
	 */
	getAllPopulatedLocationsOnPage(pageNumber: number): ControlLocation[]

	/**
	 * Get the id of the first page in the system
	 */
	getFirstPageId(): string

	/**
	 * Get the internal id for a page, return undefined if page doesn't exist
	 * Note that pageNumber is 1-based, as in the return value of `getPageNumber` or arg to `getPageInfo`
	 */
	getPageId(pageNumber: number): string | undefined

	/**
	 * Get the index of the given page id
	 */
	getPageNumber(pageId: string): number | null

	/**
	 * Check whether a page number exists
	 */
	isPageValid(pageNumber: number): boolean

	/**
	 * Check whether a page id exists
	 */
	isPageIdValid(pageId: string): boolean

	/**
	 * Get the location of a controlId
	 */
	getLocationOfControlId(controlId: string): ControlLocation | undefined

	/**
	 * Get the controlId at a specific location
	 */
	getControlIdAt(location: ControlLocation): string | null

	/**
	 * Get the controlId at a specific location using old bank index
	 */
	getControlIdAtOldBankIndex(pageNumber: number, bank: number): string | null

	/**
	 * Get the total number of pages
	 */
	getPageCount(): number

	/**
	 * Get a specific page object
	 * @param pageNumber - the page id
	 * @param [clone = false] - <code>true</code> if a copy should be returned
	 */
	getPageInfo(pageNumber: number, clone?: boolean): PageModel | undefined

	/**
	 * Get the name for a page
	 */
	getPageName(pageNumber: number): string | undefined

	/**
	 * Get the page id for a page offset from the specified id
	 */
	getOffsetPageId(pageId: string, offset: number): string | null

	/**
	 * Get the page ids array (read-only)
	 */
	getPageIds(): readonly string[]

	/**
	 * Get pages by id object (read-only)
	 */
	getPagesById(): Readonly<Record<string, PageModel>>

	// /**
	//  * Set the controlId at a specific location
	//  */
	// setControlIdAt(location: ControlLocation, controlId: string | null): boolean
}

/**
 * The class that manages page data storage and state
 * This class has minimal dependencies and focuses on data management
 *
 * @author Julian Waller <me@julusian.co.uk>
 * @since 3.0.0
 * @copyright 2024 Bitfocus AS
 * @license
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for Companion along with
 * this program.
 */
export class PageStore extends EventEmitter<PageStoreEvents> implements IPageStore {
	readonly #dbTable: DataStoreTableView<Record<string, PageModel>>

	/**
	 * Cache the location of each control
	 */
	readonly #locationCache = new Map<string, ControlLocation>()

	/**
	 * Pages data
	 */
	readonly #pagesById: Record<string, PageModel> = {}

	/**
	 * Page ids by index
	 */
	#pageIds: string[] = []

	constructor(dbTable: DataStoreTableView<Record<string, PageModel>>) {
		super()
		this.setMaxListeners(0)

		this.#dbTable = dbTable

		this.#setupPages(this.#dbTable.all())
	}

	/**
	 * Get the entire page table
	 */
	getAll(): Record<number, PageModel> {
		const savePages: Record<number, PageModel> = {}
		this.#pageIds.map((id, index) => {
			const pageInfo = this.#pagesById[id]
			savePages[index + 1] = pageInfo || {
				id: nanoid(),
				name: 'PAGE',
				controls: {},
			}
		})

		return savePages
	}

	/**
	 * Get all ControlIds on the specified page
	 */
	getAllControlIdsOnPage(pageNumber: number): string[] {
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
	 */
	getAllPopulatedLocationsOnPage(pageNumber: number): ControlLocation[] {
		const page = this.getPageInfo(pageNumber)
		if (page) {
			const locations: ControlLocation[] = []
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
	 */
	getFirstPageId(): string {
		return this.#pageIds[0]
	}

	/**
	 * Get the internal id for a page, return undefined if page doesn't exist
	 * Note that pageNumber is 1-based, as in the return value of `getPageNumber` or arg to `getPageInfo`
	 */
	getPageId(pageNumber: number): string | undefined {
		const id = this.#pageIds[pageNumber - 1]
		return id
	}

	/**
	 * Get the index of the given page id
	 */
	getPageNumber(pageId: string): number | null {
		const index = this.#pageIds.indexOf(pageId)
		return index >= 0 ? index + 1 : null
	}

	/**
	 * Check whether a page number exists
	 */
	isPageValid(pageNumber: number): boolean {
		return !!this.getPageInfo(pageNumber)
	}

	/**
	 * Check whether a page id exists
	 */
	isPageIdValid(pageId: string): boolean {
		return this.#pagesById[pageId] !== undefined
	}

	/**
	 * Get the location of a controlId
	 */
	getLocationOfControlId(controlId: string): ControlLocation | undefined {
		return this.#locationCache.get(controlId)
	}

	/**
	 * Get the controlId at a specific location
	 */
	getControlIdAt(location: ControlLocation): string | null {
		const page = this.getPageInfo(location.pageNumber)
		if (page) {
			return page.controls[location.row]?.[location.column]
		} else {
			return null
		}
	}

	/**
	 * Get the controlId at a specific location using old bank index
	 */
	getControlIdAtOldBankIndex(pageNumber: number, bank: number): string | null {
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
	 */
	getPageCount(): number {
		return this.#pageIds.length
	}

	/**
	 * Get a specific page object
	 * @param pageNumber - the page number (1-based)
	 * @param [clone = false] - <code>true</code> if a copy should be returned
	 */
	getPageInfo(pageNumber: number, clone = false): PageModel | undefined {
		const pageId = this.#pageIds[pageNumber - 1]
		if (!pageId) return undefined

		const pageInfo = this.#pagesById[pageId]
		if (clone) {
			return structuredClone(pageInfo)
		} else {
			return pageInfo
		}
	}

	/**
	 * Get the name for a page
	 */
	getPageName(pageNumber: number): string | undefined {
		const pageInfo = this.getPageInfo(pageNumber)
		if (!pageInfo) return undefined
		return pageInfo.name ?? ''
	}

	/**
	 * Get the page id for a page offset from the specified id
	 */
	getOffsetPageId(pageId: string, offset: number): string | null {
		const index = this.#pageIds.indexOf(pageId)
		if (index === -1) return null

		let newIndex = index + offset
		if (newIndex < 0)
			newIndex = this.#pageIds.length + newIndex // wrap around to the end
		else newIndex = newIndex % this.#pageIds.length // wrap around to the start

		return this.#pageIds[newIndex]
	}

	/**
	 * Get the page ids array (read-only)
	 */
	getPageIds(): readonly string[] {
		return this.#pageIds
	}

	/**
	 * Get pages by id object (read-only)
	 */
	getPagesById(): Readonly<Record<string, PageModel>> {
		return this.#pagesById
	}

	/**
	 * Set the controlId at a specific location
	 */
	setControlIdAt(location: ControlLocation, controlId: string | null): boolean {
		const page = this.getPageInfo(location.pageNumber)
		if (page) {
			if (!page.controls[location.row]) page.controls[location.row] = {}

			// Update the cache
			const oldControlId = page.controls[location.row][location.column]
			if (oldControlId) {
				this.#locationCache.delete(oldControlId)
				this.emit('controlLocationChanged', oldControlId, undefined)
			}

			if (controlId) {
				page.controls[location.row][location.column] = controlId
				this.#locationCache.set(controlId, structuredClone(location))
				this.emit('controlLocationChanged', controlId, structuredClone(location))
			} else {
				delete page.controls[location.row][location.column]
			}

			this.#commitChanges([location.pageNumber])

			return true
		} else {
			return false
		}
	}

	/**
	 * Internal method: Add a new page to the store
	 * Used by PageController for page creation operations
	 */
	_addPages(pageNames: string[], asPageNumber: number): PageModel[] {
		const insertedPages: PageModel[] = []

		for (const pageName of pageNames) {
			const newPageInfo: PageModel = {
				id: nanoid(),
				name: pageName ?? 'PAGE',
				controls: {},
			}

			// store the new page
			this.#pagesById[newPageInfo.id] = newPageInfo
			insertedPages.push(newPageInfo)
		}

		// Insert the new page ids into the array at the requested position
		this.#pageIds.splice(asPageNumber - 1, 0, ...insertedPages.map((p) => p.id))

		// Build an array of all page numbers that changed
		const affectedPageNumbers = new Array(this.#pageIds.length - asPageNumber + 1)
			.fill(0)
			.map((_, i) => i + asPageNumber)

		// Save changes to the pages
		this.#commitChanges(affectedPageNumbers)

		return insertedPages
	}

	/**
	 * Internal method: Remove a page from the store
	 * Used by PageController for page deletion operations
	 */
	_removePage(pageId: string): void {
		// Always remove any stored page data if present
		delete this.#pagesById[pageId]

		// Find the page index, if its not present then nothing more to do
		const index = this.#pageIds.indexOf(pageId)
		if (index < 0) return

		// Remove the page id from the ordered list
		this.#pageIds.splice(index, 1)

		// Build an array of all page numbers that changed
		const affectedPageNumbers = new Array(this.#pageIds.length - index + 1).fill(0).map((_, i) => index + 1 + i)

		// Save changes to the pages
		this.#commitChanges(affectedPageNumbers)
	}

	/**
	 * Internal method: Set page name
	 * Used by PageController for name updates
	 */
	_setPageName(pageNumber: number, name: string): Readonly<PageModel> | undefined {
		const pageInfo = this.getPageInfo(pageNumber)
		if (!pageInfo) return undefined

		pageInfo.name = name
		this.#commitChanges([pageNumber])
		return pageInfo
	}

	/**
	 * Internal method: Reset a page's controls
	 * Used by PageController for page reset operations
	 */
	_resetPageControls(pageNumber: number): string[] {
		const pageInfo = this.getPageInfo(pageNumber)
		if (!pageInfo) return []

		const removedControls = this.getAllControlIdsOnPage(pageNumber)

		// Clear cache for old controls
		for (const [_row, rowObj] of Object.entries(pageInfo.controls)) {
			if (!rowObj) continue
			for (const [_col, controlId] of Object.entries(rowObj)) {
				this.#locationCache.delete(controlId)
				this.emit('controlLocationChanged', controlId, undefined)
			}
		}

		// Reset controls
		pageInfo.controls = {}
		this.#commitChanges([pageNumber])

		return removedControls
	}

	/**
	 * Internal method: Rebuild the location cache
	 * Used by PageController when page order changes
	 */
	_rebuildLocationCache(): void {
		this.#locationCache.clear()

		this.#pageIds.forEach((pageId, pageIndex) => {
			const pageNumber = pageIndex + 1
			const pageInfo = this.#pagesById[pageId]
			if (!pageInfo) return

			for (const [row, rowObj] of Object.entries(pageInfo.controls)) {
				for (const [column, controlId] of Object.entries(rowObj)) {
					const location = {
						pageNumber: Number(pageNumber),
						column: Number(column),
						row: Number(row),
					}
					this.#locationCache.set(controlId, location)
					this.emit('controlLocationChanged', controlId, structuredClone(location))
				}
			}
		})
	}

	/**
	 * Internal method: Move a page in the order
	 * Used by PageController for page reordering
	 */
	_movePageInOrder(fromIndex: number, toIndex: number): void {
		if (fromIndex === toIndex) return
		if (fromIndex < toIndex) toIndex -= 1

		const pageId = this.#pageIds[fromIndex]
		this.#pageIds.splice(fromIndex, 1)
		this.#pageIds.splice(toIndex, 0, pageId)
	}

	/**
	 * Internal method: Commit changes to pages
	 * Used internally to persist changes to the database
	 */
	#commitChanges(pageNumbers: number[]): void {
		for (const pageNumber of pageNumbers) {
			const pageInfo = this.getPageInfo(pageNumber)

			if (pageInfo) {
				this.#dbTable.set(`${pageNumber}`, pageInfo)
			} else {
				this.#dbTable.delete(`${pageNumber}`)
			}

			this.emit('pageDataChanged', pageNumber, pageInfo)
		}
	}

	/**
	 * Load the page table with defaults
	 */
	#setupPages(rawPageData: Record<string, PageModel>): void {
		// Track the ids as they get loaded, to ensure we dont accidentally have a duplicate id
		const loadedPageIds = new Set<string>()

		// Load existing data
		for (let i = 1; ; i++) {
			const pageInfo = rawPageData[i]
			if (!pageInfo) break

			// Ensure each page has an id defined
			if (!pageInfo.id || loadedPageIds.has(pageInfo.id)) {
				pageInfo.id = nanoid()

				// Save the changes
				this.#dbTable.set(`${i}`, pageInfo)
			}

			loadedPageIds.add(pageInfo.id)
			this.#pagesById[pageInfo.id] = pageInfo
			this.#pageIds.push(pageInfo.id)
		}

		// Default values
		if (this.#pageIds.length === 0) {
			const newPageInfo: PageModel = {
				id: nanoid(),
				name: 'PAGE',
				controls: {},
			}

			// Create a single page
			this.#pagesById[newPageInfo.id] = newPageInfo
			this.#pageIds = [newPageInfo.id]

			this.#dbTable.set('1', newPageInfo)
		}

		// Setup #locationCache
		this._rebuildLocationCache()
	}

	/**
	 * Internal method: Check if default page needs to be created and create it
	 * Used by PageController during initialization
	 */
	_ensureDefaultPageExists(): boolean {
		if (this.#pageIds.length === 0) {
			const newPageInfo: PageModel = {
				id: nanoid(),
				name: 'PAGE',
				controls: {},
			}

			// Create a single page
			this.#pagesById[newPageInfo.id] = newPageInfo
			this.#pageIds = [newPageInfo.id]

			this.#dbTable.set('1', newPageInfo)
			return true
		}
		return false
	}
}

import { cloneDeep } from 'lodash-es'
import { oldBankIndexToXY } from '@companion-app/shared/ControlId.js'
import { nanoid } from 'nanoid'
import { default_nav_buttons_definitions } from './Defaults.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type {
	PageModel,
	PageModelChangesInit,
	PageModelChangesItem,
	PageModelChangesUpdate,
} from '@companion-app/shared/Model/PageModel.js'
import type { Registry } from '../Registry.js'
import LogController from '../Log/Controller.js'
import { EventEmitter } from 'events'
import { DataStoreTableView } from '../Data/StoreBase.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'
import z from 'zod'

interface PageControllerEvents {
	pagecount: [count: number]
	pageindexchange: [pageIds: Set<string>]

	name: [pageNumber: number, name: string | undefined]

	clientUpdate: [update: PageModelChangesUpdate]
}

/**
 * The class that manages the user pages
 *
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
 */
export class PageController extends EventEmitter<PageControllerEvents> {
	readonly #logger = LogController.createLogger('Page/Controller')

	readonly #registry: Pick<Registry, 'io' | 'graphics' | 'controls' | 'userconfig'>
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

	constructor(registry: Registry) {
		super()
		this.setMaxListeners(0)

		this.#registry = registry
		this.#dbTable = registry.db.getTableView('pages')

		this.#setupPages(this.#dbTable.all())
	}

	createTrpcRouter() {
		const self = this
		const selfEmitter: EventEmitter<PageControllerEvents> = this

		return router({
			watch: publicProcedure.subscription(async function* ({ signal }) {
				const changes = toIterable(selfEmitter, 'clientUpdate', signal)

				yield { type: 'init', order: self.#pageIds, pages: self.#pagesById } satisfies PageModelChangesInit

				for await (const [change] of changes) {
					yield change
				}
			}),

			setName: publicProcedure
				.input(
					z.object({
						pageNumber: z.number(),
						name: z.string(),
					})
				)
				.mutation(({ input }) => {
					this.#logger.silly(`trpc: pages:setName ${input.pageNumber}: ${input.name}`)

					this.setPageName(input.pageNumber, input.name, true)
				}),

			remove: publicProcedure
				.input(
					z.object({
						pageNumber: z.number(),
					})
				)
				.mutation(({ input }) => {
					this.#logger.silly(`trpc: pages:remove ${input.pageNumber}`)

					if (this.getPageCount() === 1) return 'fail'

					// Delete the controls, and allow them to redraw
					const controlIds = this.getAllControlIdsOnPage(input.pageNumber)
					for (const controlId of controlIds) {
						this.#registry.controls.deleteControl(controlId)
					}

					// Delete the page
					this.deletePage(input.pageNumber)

					return 'ok'
				}),

			insert: publicProcedure
				.input(
					z.object({
						asPageNumber: z.number(),
						pageNames: z.array(z.string()),
					})
				)
				.mutation(({ input }) => {
					this.#logger.silly(`trpc: pages:insert ${input.asPageNumber}`)

					const pageIds = this.insertPages(input.asPageNumber, input.pageNames)
					if (pageIds.length === 0) throw new Error(`Failed to insert pages`)

					// Add nav buttons
					for (let i = 0; i < pageIds.length; i++) {
						this.createPageDefaultNavButtons(input.asPageNumber + i)
					}

					return 'ok'
				}),

			clearPage: publicProcedure
				.input(
					z.object({
						pageNumber: z.number(),
					})
				)
				.mutation(({ input }) => {
					this.#logger.silly(`trpc: pages:clearPage ${input.pageNumber}`)

					// Delete the controls, and allow them to redraw
					const controlIds = this.getAllControlIdsOnPage(input.pageNumber)
					for (const controlId of controlIds) {
						this.#registry.controls.deleteControl(controlId)
					}

					// Clear the references on the page
					this.resetPage(input.pageNumber)

					// Re-add the nav buttons
					this.createPageDefaultNavButtons(input.pageNumber)

					return 'ok'
				}),

			move: publicProcedure
				.input(
					z.object({
						pageId: z.string(),
						pageNumber: z.number(),
					})
				)
				.mutation(({ input }) => {
					this.#logger.silly(`trpc: pages:move ${input.pageId} to ${input.pageNumber}`)

					// Bounds checks
					if (this.getPageCount() === 1) return 'fail'
					if (input.pageNumber < 1 || input.pageNumber > this.getPageCount()) return 'fail'

					// Find current index of the page
					const currentPageIndex = this.#pageIds.indexOf(input.pageId)
					if (currentPageIndex === -1) return 'fail'

					// move the page
					this.#pageIds.splice(currentPageIndex, 1)
					this.#pageIds.splice(input.pageNumber - 1, 0, input.pageId)

					// Update cache for controls on later pages
					const { changedPageNumbers, changedPageIds } = this.#updateAndRedrawAllPagesAfter(
						Math.min(currentPageIndex + 1, input.pageNumber),
						Math.max(currentPageIndex + 1, input.pageNumber)
					)

					// save and report changes
					this.#commitChanges(changedPageNumbers, false)
					this.emit('clientUpdate', {
						type: 'update',
						updatedOrder: this.#pageIds,
						added: [],
						changes: [],
					})

					// inform other interested controllers
					this.emit('pageindexchange', changedPageIds)

					return 'ok'
				}),

			recreateNav: publicProcedure
				.input(
					z.object({
						pageNumber: z.number(),
					})
				)
				.mutation(({ input }) => {
					this.#logger.silly(`trpc: pages:recreateNav ${input.pageNumber}`)

					// make magical page buttons!
					this.createPageDefaultNavButtons(input.pageNumber)

					return 'ok'
				}),
		})
	}

	/**
	 * Deletes a page
	 * Note: Controls will be orphaned if not explicitly deleted by the caller
	 * @param pageNumber - the page id
	 * @returns ControlIds referenced on the page
	 */
	deletePage(pageNumber: number): string[] {
		this.#logger.silly('Delete page ' + pageNumber)

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
		this.#registry.graphics.clearAllForPage(missingPageNumber)
		changedPageIds.add(pageInfo.id)

		this.#commitChanges(changedPageNumbers, false)
		this.emit('clientUpdate', {
			type: 'update',
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
	 */
	insertPages(asPageNumber: number, pageNames: string[]): string[] {
		if (asPageNumber > this.getPageCount() + 1 || asPageNumber <= 0) throw new Error('New page number is out of range')

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
		this.emit('clientUpdate', {
			type: 'update',
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
	 * @param firstPageNumber
	 * @param lastPageNumber If null, run to the end
	 */
	#updateAndRedrawAllPagesAfter(
		firstPageNumber: number,
		lastPageNumber: number | null
	): { changedPageNumbers: number[]; changedPageIds: Set<string> } {
		// Rebuild location cache
		this.#rebuildLocationCache()

		const changedPageNumbers: number[] = []
		const changedPageIds = new Set<string>()

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
	 * @param [clone = false] - <code>true</code> if a copy should be returned
	 */
	getAll(clone = false): Record<number, PageModel> {
		const savePages: Record<number, PageModel> = {}
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
			}

			if (controlId) {
				page.controls[location.row][location.column] = controlId
				this.#locationCache.set(controlId, cloneDeep(location))
			} else {
				delete page.controls[location.row][location.column]
			}

			this.#commitChanges([location.pageNumber], false)
			this.emit('clientUpdate', {
				type: 'update',
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
	 * Get the controlId at a specific location
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
	 * @param pageNumber - the page id
	 * @param [clone = false] - <code>true</code> if a copy should be returned
	 */
	getPageInfo(pageNumber: number, clone = false): PageModel | undefined {
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
	 * Reset a page to defaults and empty
	 * Note: Controls will be orphaned if not explicitly deleted by the caller
	 * @param pageNumber - the page id
	 * @param [redraw = true] - <code>true</code> if the graphics should invalidate
	 * @returns ControlIds referenced on the page
	 */
	resetPage(pageNumber: number, redraw = true): string[] {
		this.#logger.silly('Reset page ' + pageNumber)

		const removedControls = this.getAllControlIdsOnPage(pageNumber)

		// Fetch the page and ensure it exists
		const pageInfo = this.getPageInfo(pageNumber)
		if (!pageInfo) return removedControls

		const controlChanges: PageModelChangesItem['controls'] = []

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
		this.emit('clientUpdate', {
			type: 'update',
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
	 */
	createPageDefaultNavButtons(pageNumber: number): void {
		for (const { type, location } of default_nav_buttons_definitions) {
			const fullLocation = {
				...location,
				pageNumber,
			}
			const oldControlId = this.getControlIdAt(fullLocation)
			if (oldControlId) this.#registry.controls.deleteControl(oldControlId)

			this.#registry.controls.createButtonControl(fullLocation, type)
		}
	}

	/**
	 * Finds all controls that are outside of the valid grid bounds
	 */
	findAllOutOfBoundsControls(): string[] {
		const foundControlIds: string[] = []

		const { minColumn, maxColumn, minRow, maxRow } = this.#registry.userconfig.getKey('gridSize')

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
	 * @param pageNumber - the page id
	 * @param name - the page object containing the name
	 * @param redraw - <code>true</code> if the graphics should invalidate
	 */
	setPageName(pageNumber: number, name: string, redraw = true): void {
		const pageInfo = this.getPageInfo(pageNumber)
		if (!pageInfo) {
			throw new Error('Page must be created before it can be imported to')
		}

		pageInfo.name = name

		this.#logger.silly('Set page ' + pageNumber + ' to ', name)

		this.#commitChanges([pageNumber], redraw)
		this.emit('clientUpdate', {
			type: 'update',
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
	 */
	#commitChanges(pageNumbers: number[], redraw = true): void {
		for (const pageNumber of pageNumbers) {
			const pageInfo = this.getPageInfo(pageNumber)

			if (pageInfo) {
				this.#dbTable.set(`${pageNumber}`, pageInfo)
			} else {
				this.#dbTable.delete(`${pageNumber}`)
			}

			this.emit('name', pageNumber, pageInfo ? (pageInfo.name ?? '') : undefined)

			if (redraw && pageInfo) {
				this.#logger.silly('page controls invalidated for page', pageNumber)
				this.#invalidatePageNumberControls(pageNumber, pageInfo)
			}
		}
	}

	/**
	 * Redraw the page number control on the specified page
	 */
	#invalidatePageNumberControls(pageNumber: number, pageInfo: PageModel): void {
		if (pageInfo?.controls) {
			for (const [row, rowObj] of Object.entries(pageInfo.controls)) {
				for (const [column, controlId] of Object.entries(rowObj)) {
					const control = this.#registry.controls.getControl(controlId)
					if (control && control.type === 'pagenum') {
						this.#registry.graphics.invalidateButton({
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
	 */
	#invalidateAllControlsOnPageNumber(pageNumber: number, pageInfo: PageModel): void {
		if (pageInfo?.controls) {
			this.#registry.graphics.clearAllForPage(pageNumber)

			for (const [row, rowObj] of Object.entries(pageInfo.controls)) {
				for (const [column, controlId] of Object.entries(rowObj)) {
					const control = this.#registry.controls.getControl(controlId)
					if (control) {
						this.#registry.graphics.invalidateButton({
							pageNumber: pageNumber,
							column: Number(column),
							row: Number(row),
						})
					}
				}
			}
		}
	}

	#rebuildLocationCache(): void {
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
	 */
	#setupPages(rawPageData: Record<string, PageModel>): void {
		// Load existing data
		for (let i = 1; ; i++) {
			const pageInfo = rawPageData[i]
			if (!pageInfo) break

			// Ensure each page has an id defined
			if (!pageInfo.id) {
				pageInfo.id = nanoid()

				// Save the changes
				this.#dbTable.set(`${i}`, pageInfo)
			}

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

			setImmediate(() => {
				this.createPageDefaultNavButtons(1)
			})
		}

		// Setup #locationCache
		this.#rebuildLocationCache()
	}
}

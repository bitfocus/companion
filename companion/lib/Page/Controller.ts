import { default_nav_buttons_definitions } from './Defaults.js'
import { PageStore } from './Store.js'
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
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'
import z from 'zod'
import _ from 'lodash'

interface PageControllerEvents {
	controlIdsMoved: [controlIds: string[]]

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
	readonly store: PageStore

	constructor(registry: Registry, store: PageStore) {
		super()
		this.setMaxListeners(0)

		this.#registry = registry
		this.store = store

		// Listen to store events to emit controller events
		this.store.on('controlLocationChanged', (controlId) => {
			this.emit('controlIdsMoved', [controlId])
		})

		// Check if we need to create a default page
		const createdDefault = this.store._ensureDefaultPageExists()
		if (createdDefault) {
			setImmediate(() => {
				this.createPageDefaultNavButtons(1)
			})
		}
	}

	createTrpcRouter() {
		const self = this
		const selfEmitter: EventEmitter<PageControllerEvents> = this

		return router({
			watch: publicProcedure.subscription(async function* ({ signal }) {
				const changes = toIterable(selfEmitter, 'clientUpdate', signal)

				yield {
					type: 'init',
					order: [...self.store.getPageIds()],
					pages: { ...self.store.getPagesById() },
				} satisfies PageModelChangesInit

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

					if (this.store.getPageCount() === 1) return 'fail'

					// Delete the controls, and allow them to redraw
					const controlIds = this.store.getAllControlIdsOnPage(input.pageNumber)
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
					const controlIds = this.store.getAllControlIdsOnPage(input.pageNumber)
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
					if (this.store.getPageCount() === 1) return 'fail'
					if (input.pageNumber < 1 || input.pageNumber > this.store.getPageCount()) return 'fail'

					// Find current index of the page
					const pageIds = [...this.store.getPageIds()]
					const currentPageIndex = pageIds.indexOf(input.pageId)
					if (currentPageIndex === -1) return 'fail'

					// move the page
					this.store._movePageInOrder(currentPageIndex, input.pageNumber - 1)

					// Update cache for controls on later pages
					const { changedPageIds } = this.#updateAndRedrawAllPagesAfter(
						Math.min(currentPageIndex + 1, input.pageNumber),
						Math.max(currentPageIndex + 1, input.pageNumber)
					)

					// save and report changes
					this.emit('clientUpdate', {
						type: 'update',
						updatedOrder: [...this.store.getPageIds()],
						added: [],
						changes: [],
					})

					// inform other interested controllers
					this.store.emit('pageindexchange', changedPageIds)

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

		if (pageNumber === 1 && this.store.getPageCount() == 1) throw new Error(`Can't delete last page`)

		// Fetch the page and ensure it exists
		const pageInfo = this.store.getPageInfo(pageNumber)
		if (!pageInfo) return []

		const removedControls = this.store.getAllControlIdsOnPage(pageNumber)

		// Delete the info for the page
		this.store._removePage(pageInfo.id)

		// Update cache for controls on later pages
		const { changedPageNumbers, changedPageIds } = this.#updateAndRedrawAllPagesAfter(pageNumber, null)

		// the list is a page shorter, ensure the 'old last' page is reported as undefined
		const missingPageNumber = this.store.getPageIds().length + 1
		changedPageNumbers.push(missingPageNumber)
		this.#registry.graphics.clearAllForPage(missingPageNumber)
		changedPageIds.add(pageInfo.id)

		this.emit('clientUpdate', {
			type: 'update',
			updatedOrder: [...this.store.getPageIds()],
			added: [],
			changes: [],
		})

		// inform other interested controllers
		this.store.emit('pagecount', this.store.getPageCount())
		this.store.emit('pageindexchange', changedPageIds)
		this.emit('controlIdsMoved', removedControls)

		return removedControls
	}

	/**
	 * Insert a new page, with the given page number
	 */
	insertPages(asPageNumber: number, pageNames: string[]): string[] {
		if (asPageNumber > this.store.getPageCount() + 1 || asPageNumber <= 0)
			throw new Error('New page number is out of range')

		const insertedPages = this.store._addPages(pageNames, asPageNumber)

		// Early exit if not inserting anything
		if (insertedPages.length === 0) {
			return []
		}

		// Update cache for controls on later pages
		const { changedPageIds } = this.#updateAndRedrawAllPagesAfter(asPageNumber, null)

		// inform clients
		this.emit('clientUpdate', {
			type: 'update',
			updatedOrder: [...this.store.getPageIds()],
			added: insertedPages,
			changes: [],
		})

		// inform other interested controllers
		this.store.emit('pagecount', this.store.getPageCount())
		this.store.emit('pageindexchange', changedPageIds)

		return insertedPages.map((p) => p.id)
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
		this.store._rebuildLocationCache()

		const changedPageNumbers: number[] = []
		const changedPageIds = new Set<string>()

		const pageCount = this.store.getPageCount()
		if (lastPageNumber) {
			lastPageNumber = Math.min(lastPageNumber, pageCount)
		} else {
			lastPageNumber = pageCount
		}

		for (let pageNumber = firstPageNumber; pageNumber <= lastPageNumber; pageNumber++) {
			const pageInfo = this.store.getPageInfo(pageNumber)
			if (!pageInfo) continue

			this.#invalidateAllControlsOnPageNumber(pageNumber, pageInfo)

			changedPageNumbers.push(pageNumber)
			changedPageIds.add(pageInfo.id)
		}

		return { changedPageNumbers, changedPageIds }
	}

	/**
	 * Set the controlId at a specific location
	 */
	setControlIdAt(location: ControlLocation, controlId: string | null): boolean {
		const page = this.store.getPageInfo(location.pageNumber)
		if (!page) return false

		const oldControlId = this.store.getControlIdAt(location)
		const success = this.store.setControlIdAt(location, controlId)

		if (success) {
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

			this.emit('controlIdsMoved', _.compact([oldControlId, controlId]))
		}

		return success
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

		// Fetch the page and ensure it exists
		const pageInfo = this.store.getPageInfo(pageNumber)
		if (!pageInfo) return []

		const removedControls = this.store.getAllControlIdsOnPage(pageNumber)

		const controlChanges: PageModelChangesItem['controls'] = []

		// Clear cache for old controls and track changes
		for (const [row, rowObj] of Object.entries(pageInfo.controls)) {
			if (!rowObj) continue
			for (const [col, controlId] of Object.entries(rowObj)) {
				controlChanges.push({
					row: Number(row),
					column: Number(col),
					controlId,
				})
			}
		}

		// Reset the page controls using the store
		this.store._resetPageControls(pageNumber)

		// Reset page name using the store
		const newPageInfo = this.store._setPageName(pageNumber, 'PAGE')

		if (redraw && newPageInfo) this.#invalidatePageNumberControls(pageNumber, newPageInfo)
		this.emit('clientUpdate', {
			type: 'update',
			updatedOrder: null,
			added: [],
			changes: [
				{
					id: pageInfo.id,
					name: 'PAGE',
					controls: controlChanges,
				},
			],
		})

		this.emit('controlIdsMoved', removedControls)

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
			const oldControlId = this.store.getControlIdAt(fullLocation)
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
		const pagesById = this.store.getPagesById()

		for (const page of Object.values(pagesById)) {
			for (const row of Object.keys(page.controls)) {
				const rowObj = page.controls[Number(row)]
				if (!rowObj) continue

				if (Number(row) < minRow || Number(row) > maxRow) {
					// Row is out of bounds, delete it all
					foundControlIds.push(...Object.values(rowObj))
				} else {
					for (const column of Object.keys(rowObj)) {
						if (Number(column) < minColumn || Number(column) > maxColumn) {
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
		const pageInfo = this.store.getPageInfo(pageNumber)
		if (!pageInfo) {
			throw new Error('Page must be created before it can be imported to')
		}

		const newPageInfo = this.store._setPageName(pageNumber, name)

		this.#logger.silly('Set page ' + pageNumber + ' to ', name)

		if (redraw && newPageInfo) this.#invalidatePageNumberControls(pageNumber, newPageInfo)

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
	 * Redraw the page number control on the specified page
	 */
	#invalidatePageNumberControls(pageNumber: number, pageInfo: PageModel): void {
		if (!pageInfo?.controls) return

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

	/**
	 * Redraw allcontrols on the specified page
	 */
	#invalidateAllControlsOnPageNumber(pageNumber: number, pageInfo: PageModel): void {
		if (!pageInfo?.controls) return
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

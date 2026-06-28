import { EventEmitter } from 'node:events'
import { initTRPC } from '@trpc/server'
import { describe, expect, test, vi } from 'vitest'
import type { PageModel } from '@companion-app/shared/Model/PageModel.js'
import type { ControlCommonEvents } from '../../lib/Controls/ControlDependencies.js'
import { PageController } from '../../lib/Page/Controller.js'
import type { TrpcContext } from '../../lib/UI/TRPC.js'
import { createMockTrpcContext } from '../Util.js'
import { SubscriptionTester } from '../utils/SubscriptionTester.js'
import { createStore, threePages } from './Helpers.js'

const t = initTRPC.context<TrpcContext>().create()
const testCtx: TrpcContext = createMockTrpcContext()

function createFixture(initialPages: PageModel[] | undefined = threePages()) {
	const { db, store } = createStore(initialPages)

	const graphics = {
		clearAllForPage: vi.fn(),
		invalidateButton: vi.fn(),
	}
	// Return a stable stub per controlId so tests can assert which controls were told their location changed
	const controlInstances = new Map<string, { controlId: string; triggerLocationHasChanged: ReturnType<typeof vi.fn> }>()
	const controls = {
		deleteControl: vi.fn(),
		createButtonControl: vi.fn(),
		getControl: vi.fn((controlId: string) => {
			let control = controlInstances.get(controlId)
			if (!control) {
				control = { controlId, triggerLocationHasChanged: vi.fn() }
				controlInstances.set(controlId, control)
			}
			return control
		}),
	}
	const userconfig = {
		getKey: vi.fn(() => ({ minColumn: 0, maxColumn: 7, minRow: 0, maxRow: 3 })),
	}
	const controlEvents = new EventEmitter<ControlCommonEvents>()

	const controller = new PageController(graphics as any, controls as any, userconfig as any, controlEvents, store)
	const caller = t.createCallerFactory(controller.createTrpcRouter())(testCtx)

	return { db, store, graphics, controls, controlInstances, userconfig, controlEvents, controller, caller }
}

describe('PageController', () => {
	describe('construction', () => {
		test('does not create nav buttons when the store already has pages', async () => {
			const { controls } = createFixture()

			await new Promise((resolve) => setImmediate(resolve))
			expect(controls.createButtonControl).not.toHaveBeenCalled()
		})

		test('creates default nav buttons on a fresh installation', async () => {
			// An empty database means the store creates the default page during its own setup
			const { controls, store } = createFixture([])

			expect(store.getPageCount()).toBe(1)

			await new Promise((resolve) => setImmediate(resolve))
			expect(controls.createButtonControl.mock.calls).toEqual([
				[{ pageNumber: 1, column: 0, row: 0 }, 'pageup'],
				[{ pageNumber: 1, column: 0, row: 1 }, 'pagenum'],
				[{ pageNumber: 1, column: 0, row: 2 }, 'pagedown'],
			])
		})
	})

	describe('deletePage', () => {
		test('refuses to delete the last page', () => {
			const { controller } = createFixture([threePages()[0]])

			expect(() => controller.deletePage(1)).toThrow(/last page/)
		})

		test('an unknown page returns an empty list', () => {
			const { controller } = createFixture()

			expect(controller.deletePage(9)).toEqual([])
		})

		test('removes the page, renumbers the rest and reports the changes', () => {
			const { controller, store, graphics, controls, controlInstances } = createFixture()

			const clientUpdate = vi.fn()
			controller.on('clientUpdate', clientUpdate)
			const controlIdsMoved = vi.fn()
			controller.on('controlIdsMoved', controlIdsMoved)
			const pagecount = vi.fn()
			store.on('pagecount', pagecount)
			const pageindexchange = vi.fn()
			store.on('pageindexchange', pageindexchange)

			const removed = controller.deletePage(2)
			expect(removed.sort()).toEqual(['control-b1', 'control-b2'])

			// Deleting the controls is the caller's responsibility
			expect(controls.deleteControl).not.toHaveBeenCalled()

			expect(store.getPageIds()).toEqual(['page-a', 'page-c'])
			// The location cache was rebuilt for the renumbered pages
			expect(store.getLocationOfControlId('control-c1')).toEqual({ pageNumber: 2, row: 0, column: 0 })
			expect(store.getLocationOfControlId('control-b1')).toBe(undefined)

			// The renumbered page was redrawn, and the now-missing last page cleared
			expect(graphics.clearAllForPage).toHaveBeenCalledWith(2)
			expect(graphics.clearAllForPage).toHaveBeenCalledWith(3)
			expect(graphics.invalidateButton).toHaveBeenCalledWith({ pageNumber: 2, row: 0, column: 0 })

			// The renumbered control must recompute its location-dependent state (e.g. this:page)
			expect(controlInstances.get('control-c1')?.triggerLocationHasChanged).toHaveBeenCalledTimes(1)

			expect(clientUpdate).toHaveBeenCalledWith({
				type: 'update',
				updatedOrder: ['page-a', 'page-c'],
				added: [],
				changes: [],
			})
			expect(controlIdsMoved).toHaveBeenCalledWith(removed)
			expect(pagecount).toHaveBeenCalledWith(2)
			expect(pageindexchange).toHaveBeenCalledTimes(1)
			const changedIds: Set<string> = pageindexchange.mock.calls[0][0]
			expect(changedIds.has('page-b')).toBe(true)
			expect(changedIds.has('page-c')).toBe(true)
		})
	})

	describe('insertPages', () => {
		test('rejects out of range positions', () => {
			const { controller } = createFixture()

			expect(() => controller.insertPages(0, ['X'])).toThrow(/out of range/)
			expect(() => controller.insertPages(5, ['X'])).toThrow(/out of range/)
		})

		test('an empty list inserts nothing', () => {
			const { controller, store } = createFixture()

			expect(controller.insertPages(2, [])).toEqual([])
			expect(store.getPageCount()).toBe(3)
		})

		test('inserts pages and renumbers later pages', () => {
			const { controller, store, controlInstances } = createFixture()

			const clientUpdate = vi.fn()
			controller.on('clientUpdate', clientUpdate)
			const pagecount = vi.fn()
			store.on('pagecount', pagecount)

			const newIds = controller.insertPages(2, ['X', 'Y'])
			expect(newIds).toHaveLength(2)

			expect(store.getPageIds()).toEqual(['page-a', newIds[0], newIds[1], 'page-b', 'page-c'])
			expect(store.getPageName(2)).toBe('X')
			expect(store.getPageName(3)).toBe('Y')

			// Controls on later pages moved
			expect(store.getLocationOfControlId('control-b1')).toEqual({ pageNumber: 4, row: 1, column: 2 })

			// Controls on the renumbered pages were told their location changed
			expect(controlInstances.get('control-b1')?.triggerLocationHasChanged).toHaveBeenCalledTimes(1)
			expect(controlInstances.get('control-b2')?.triggerLocationHasChanged).toHaveBeenCalledTimes(1)
			expect(controlInstances.get('control-c1')?.triggerLocationHasChanged).toHaveBeenCalledTimes(1)

			expect(pagecount).toHaveBeenCalledWith(5)
			expect(clientUpdate).toHaveBeenCalledWith(
				expect.objectContaining({
					type: 'update',
					updatedOrder: ['page-a', newIds[0], newIds[1], 'page-b', 'page-c'],
					added: [expect.objectContaining({ name: 'X' }), expect.objectContaining({ name: 'Y' })],
				})
			)
		})
	})

	describe('setControlIdAt', () => {
		test('places a control and informs clients', () => {
			const { controller, store } = createFixture()

			const clientUpdate = vi.fn()
			controller.on('clientUpdate', clientUpdate)
			const controlIdsMoved = vi.fn()
			controller.on('controlIdsMoved', controlIdsMoved)

			const location = { pageNumber: 1, row: 2, column: 4 }
			expect(controller.setControlIdAt(location, 'control-new')).toBe(true)

			expect(store.getControlIdAt(location)).toBe('control-new')
			expect(clientUpdate).toHaveBeenCalledWith({
				type: 'update',
				updatedOrder: null,
				added: [],
				changes: [
					{
						id: 'page-a',
						name: null,
						controls: [{ row: 2, column: 4, controlId: 'control-new' }],
					},
				],
			})
			expect(controlIdsMoved).toHaveBeenCalledWith(['control-new'])
		})

		test('replacing a control reports both old and new ids as moved', () => {
			const { controller } = createFixture()

			const controlIdsMoved = vi.fn()
			controller.on('controlIdsMoved', controlIdsMoved)

			controller.setControlIdAt({ pageNumber: 1, row: 0, column: 0 }, 'control-new')

			expect(controlIdsMoved).toHaveBeenCalledWith(['control-a1', 'control-new'])
		})

		test('an invalid page is rejected without events', () => {
			const { controller } = createFixture()

			const clientUpdate = vi.fn()
			controller.on('clientUpdate', clientUpdate)

			expect(controller.setControlIdAt({ pageNumber: 9, row: 0, column: 0 }, 'control-new')).toBe(false)
			expect(clientUpdate).not.toHaveBeenCalled()
		})

		test('responds to controlPlacedAt and controlRemovedFrom events', () => {
			const { controlEvents, store } = createFixture()

			const location = { pageNumber: 1, row: 3, column: 3 }
			controlEvents.emit('controlPlacedAt', location, 'control-new')
			expect(store.getControlIdAt(location)).toBe('control-new')

			controlEvents.emit('controlRemovedFrom', location)
			expect(store.getControlIdAt(location)).toBe(undefined)
		})
	})

	describe('resetPage', () => {
		test('clears the controls and resets the name', () => {
			const { controller, store } = createFixture()

			const clientUpdate = vi.fn()
			controller.on('clientUpdate', clientUpdate)
			const controlIdsMoved = vi.fn()
			controller.on('controlIdsMoved', controlIdsMoved)

			const removed = controller.resetPage(2)
			expect(removed.sort()).toEqual(['control-b1', 'control-b2'])

			expect(store.getPageName(2)).toBe('PAGE')
			expect(store.getAllControlIdsOnPage(2)).toEqual([])

			// Each populated location is reported as cleared
			expect(clientUpdate).toHaveBeenCalledWith({
				type: 'update',
				updatedOrder: null,
				added: [],
				changes: [
					{
						id: 'page-b',
						name: 'PAGE',
						controls: [
							{ row: 1, column: 2, controlId: null },
							{ row: 1, column: 3, controlId: null },
						],
					},
				],
			})
			expect(controlIdsMoved).toHaveBeenCalledWith(removed)
		})

		test('an unknown page returns an empty list', () => {
			const { controller } = createFixture()

			expect(controller.resetPage(9)).toEqual([])
		})
	})

	describe('setPageName', () => {
		test('renames the page and informs clients', () => {
			const { controller, store } = createFixture()

			const clientUpdate = vi.fn()
			controller.on('clientUpdate', clientUpdate)

			controller.setPageName(2, 'Renamed')

			expect(store.getPageName(2)).toBe('Renamed')
			expect(clientUpdate).toHaveBeenCalledWith({
				type: 'update',
				updatedOrder: null,
				added: [],
				changes: [{ id: 'page-b', name: 'Renamed', controls: [] }],
			})
		})

		test('throws for an unknown page', () => {
			const { controller } = createFixture()

			expect(() => controller.setPageName(9, 'Nope')).toThrow()
		})
	})

	describe('createPageDefaultNavButtons', () => {
		test('replaces any controls at the nav locations', () => {
			const { controller, controls } = createFixture()

			// page-a has a control at 0/0, which is one of the nav locations
			controller.createPageDefaultNavButtons(1)

			expect(controls.deleteControl).toHaveBeenCalledTimes(1)
			expect(controls.deleteControl).toHaveBeenCalledWith('control-a1')
			expect(controls.createButtonControl.mock.calls).toEqual([
				[{ pageNumber: 1, column: 0, row: 0 }, 'pageup'],
				[{ pageNumber: 1, column: 0, row: 1 }, 'pagenum'],
				[{ pageNumber: 1, column: 0, row: 2 }, 'pagedown'],
			])
		})
	})

	describe('findAllOutOfBoundsControls', () => {
		test('finds controls outside the configured grid', () => {
			const { controller, userconfig } = createFixture([
				{
					id: 'page-a',
					name: 'First',
					controls: {
						0: { 0: 'control-in-bounds', 9: 'control-col-out' },
						5: { 0: 'control-row-out-1', 1: 'control-row-out-2' },
					},
				},
			])

			const found = controller.findAllOutOfBoundsControls()
			expect(found.sort()).toEqual(['control-col-out', 'control-row-out-1', 'control-row-out-2'])
			expect(userconfig.getKey).toHaveBeenCalledWith('gridSize')
		})
	})

	describe('trpc', () => {
		test('setName renames a page', async () => {
			const { caller, store } = createFixture()

			await caller.setName({ pageNumber: 2, name: 'Via trpc' })
			expect(store.getPageName(2)).toBe('Via trpc')
		})

		test('remove fails for the last page', async () => {
			const { caller } = createFixture([threePages()[0]])

			await expect(caller.remove({ pageNumber: 1 })).resolves.toBe('fail')
		})

		test('remove deletes the controls and the page', async () => {
			const { caller, store, controls } = createFixture()

			await expect(caller.remove({ pageNumber: 2 })).resolves.toBe('ok')

			expect(controls.deleteControl).toHaveBeenCalledWith('control-b1')
			expect(controls.deleteControl).toHaveBeenCalledWith('control-b2')
			expect(store.getPageIds()).toEqual(['page-a', 'page-c'])
		})

		test('insert adds pages with nav buttons', async () => {
			const { caller, store, controls } = createFixture()

			await expect(caller.insert({ asPageNumber: 2, pageNames: ['X'] })).resolves.toBe('ok')

			expect(store.getPageCount()).toBe(4)
			expect(store.getPageName(2)).toBe('X')
			expect(controls.createButtonControl).toHaveBeenCalledWith({ pageNumber: 2, column: 0, row: 0 }, 'pageup')
			expect(controls.createButtonControl).toHaveBeenCalledWith({ pageNumber: 2, column: 0, row: 1 }, 'pagenum')
			expect(controls.createButtonControl).toHaveBeenCalledWith({ pageNumber: 2, column: 0, row: 2 }, 'pagedown')
		})

		test('clearPage deletes controls, resets the page and recreates nav buttons', async () => {
			const { caller, store, controls } = createFixture()

			await expect(caller.clearPage({ pageNumber: 2 })).resolves.toBe('ok')

			expect(controls.deleteControl).toHaveBeenCalledWith('control-b1')
			expect(controls.deleteControl).toHaveBeenCalledWith('control-b2')
			expect(store.getPageName(2)).toBe('PAGE')
			expect(controls.createButtonControl).toHaveBeenCalledWith({ pageNumber: 2, column: 0, row: 0 }, 'pageup')
		})

		test('move rejects invalid input', async () => {
			const singlePage = createFixture([threePages()[0]])
			await expect(singlePage.caller.move({ pageId: 'page-a', pageNumber: 1 })).resolves.toBe('fail')

			const { caller } = createFixture()
			await expect(caller.move({ pageId: 'page-a', pageNumber: 0 })).resolves.toBe('fail')
			await expect(caller.move({ pageId: 'page-a', pageNumber: 4 })).resolves.toBe('fail')
			await expect(caller.move({ pageId: 'unknown', pageNumber: 2 })).resolves.toBe('fail')
		})

		test('move forwards lands the page at the target page number', async () => {
			const { caller, store, controlInstances } = createFixture()

			await expect(caller.move({ pageId: 'page-a', pageNumber: 3 })).resolves.toBe('ok')

			// page-a was asked to become page 3, so it ends up at that absolute position
			expect(store.getPageIds()).toEqual(['page-b', 'page-c', 'page-a'])
			// the location cache reflects the new order
			expect(store.getLocationOfControlId('control-b1')).toEqual({ pageNumber: 1, row: 1, column: 2 })
			expect(store.getLocationOfControlId('control-a1')).toEqual({ pageNumber: 3, row: 0, column: 0 })

			// Every control on a renumbered page must recompute its location-dependent state, so that
			// pagenum buttons (this:page) and location feedbacks reflect the new page number
			for (const controlId of ['control-a1', 'control-b1', 'control-b2', 'control-c1']) {
				expect(controlInstances.get(controlId)?.triggerLocationHasChanged).toHaveBeenCalledTimes(1)
			}
		})

		test('move backwards', async () => {
			const { caller, store } = createFixture()

			await expect(caller.move({ pageId: 'page-c', pageNumber: 1 })).resolves.toBe('ok')

			expect(store.getPageIds()).toEqual(['page-c', 'page-a', 'page-b'])
		})

		test('recreateNav recreates the nav buttons', async () => {
			const { caller, controls } = createFixture()

			await expect(caller.recreateNav({ pageNumber: 3 })).resolves.toBe('ok')

			expect(controls.createButtonControl).toHaveBeenCalledWith({ pageNumber: 3, column: 0, row: 0 }, 'pageup')
		})

		test('watch yields the current state, then updates', async () => {
			const { caller, controller, store } = createFixture()

			const subscription = new SubscriptionTester(await caller.watch())
			await subscription.expectValue({
				type: 'init',
				order: ['page-a', 'page-b', 'page-c'],
				pages: store.getPagesById(),
			})

			controller.setPageName(1, 'Renamed')
			await subscription.expectValue({
				type: 'update',
				updatedOrder: null,
				added: [],
				changes: [{ id: 'page-a', name: 'Renamed', controls: [] }],
			})

			await subscription.cleanup()
		})
	})
})

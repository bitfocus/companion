import { describe, expect, test, vi } from 'vitest'
import { PageStore } from '../../lib/Page/Store.js'
import { createStore, FakePageTableView, makePage, threePages } from './Helpers.js'

describe('PageStore', () => {
	describe('setup', () => {
		test('creates a default page when the database is empty', () => {
			const { db, store } = createStore()

			expect(store.getPageCount()).toBe(1)
			expect(store.getPageName(1)).toBe('PAGE')

			const pageInfo = store.getPageInfo(1)
			expect(pageInfo).toBeTruthy()
			expect(pageInfo!.id).toBeTruthy()

			// And it was persisted
			expect(db.data['1']).toEqual(pageInfo)

			// And reported, so that the controller can add the default nav buttons
			expect(store.createdDefaultPage).toBe(true)
		})

		test('loads existing pages in order', () => {
			const { store } = createStore(threePages())

			expect(store.getPageCount()).toBe(3)
			expect(store.getPageIds()).toEqual(['page-a', 'page-b', 'page-c'])
			expect(store.getPageName(1)).toBe('First')
			expect(store.getPageName(3)).toBe('Third')
			expect(store.getFirstPageId()).toBe('page-a')
			expect(store.createdDefaultPage).toBe(false)
		})

		test('loading stops at a gap in the page numbers', () => {
			const db = new FakePageTableView()
			db.data['1'] = makePage('page-a', 'First')
			db.data['2'] = makePage('page-b', 'Second')
			db.data['4'] = makePage('page-d', 'Orphan')

			const store = new PageStore(db.asTableView())

			expect(store.getPageCount()).toBe(2)
			expect(store.getPageIds()).toEqual(['page-a', 'page-b'])
		})

		test('assigns an id to pages missing one, and persists it', () => {
			const { db, store } = createStore([{ name: 'No id', controls: {} } as any])

			const pageInfo = store.getPageInfo(1)
			expect(pageInfo!.id).toBeTruthy()
			expect(db.data['1'].id).toBe(pageInfo!.id)
		})

		test('regenerates duplicate page ids', () => {
			const { db, store } = createStore([makePage('dup', 'First'), makePage('dup', 'Second')])

			const ids = store.getPageIds()
			expect(ids[0]).toBe('dup')
			expect(ids[1]).not.toBe('dup')
			expect(db.data['2'].id).toBe(ids[1])
		})

		test('builds the location cache from loaded pages', () => {
			const { store } = createStore(threePages())

			expect(store.getLocationOfControlId('control-a1')).toEqual({ pageNumber: 1, row: 0, column: 0 })
			expect(store.getLocationOfControlId('control-b1')).toEqual({ pageNumber: 2, row: 1, column: 2 })
			expect(store.getLocationOfControlId('unknown')).toBe(undefined)
		})
	})

	describe('lookups', () => {
		test('page id and number lookups', () => {
			const { store } = createStore(threePages())

			expect(store.getPageId(2)).toBe('page-b')
			expect(store.getPageId(4)).toBe(undefined)
			expect(store.getPageNumber('page-c')).toBe(3)
			expect(store.getPageNumber('unknown')).toBe(null)
			expect(store.isPageValid(3)).toBe(true)
			expect(store.isPageValid(0)).toBe(false)
			expect(store.isPageValid(4)).toBe(false)
			expect(store.isPageIdValid('page-a')).toBe(true)
			expect(store.isPageIdValid('unknown')).toBe(false)
		})

		test('getPageInfo clone semantics', () => {
			const { store } = createStore(threePages())

			const live = store.getPageInfo(1)
			expect(store.getPageInfo(1)).toBe(live)

			const cloned = store.getPageInfo(1, true)
			expect(cloned).toEqual(live)
			expect(cloned).not.toBe(live)
		})

		test('getAll returns pages keyed by 1-based number', () => {
			const { store } = createStore(threePages())

			const all = store.getAll()
			expect(Object.keys(all)).toEqual(['1', '2', '3'])
			expect(all[1].id).toBe('page-a')
			expect(all[3].id).toBe('page-c')
		})

		test('control lookups on a page', () => {
			const { store } = createStore(threePages())

			expect(store.getControlIdAt({ pageNumber: 2, row: 1, column: 2 })).toBe('control-b1')
			expect(store.getControlIdAt({ pageNumber: 2, row: 0, column: 0 })).toBe(undefined)
			expect(store.getControlIdAt({ pageNumber: 9, row: 0, column: 0 })).toBe(null)

			expect(store.getAllControlIdsOnPage(2).sort()).toEqual(['control-b1', 'control-b2'])
			expect(store.getAllControlIdsOnPage(9)).toEqual([])

			expect(store.getAllPopulatedLocationsOnPage(2)).toEqual([
				{ pageNumber: 2, row: 1, column: 2 },
				{ pageNumber: 2, row: 1, column: 3 },
			])
			expect(store.getAllPopulatedLocationsOnPage(9)).toEqual([])
		})

		test('getControlIdAtOldBankIndex maps banks to an 8-wide grid', () => {
			const { store } = createStore([makePage('page-a', 'First', { 0: { 0: 'top-left' }, 1: { 1: 'second-row' } })])

			expect(store.getControlIdAtOldBankIndex(1, 1)).toBe('top-left')
			expect(store.getControlIdAtOldBankIndex(1, 10)).toBe('second-row')
			expect(store.getControlIdAtOldBankIndex(1, 33)).toBe(null)
			expect(store.getControlIdAtOldBankIndex(1, 0)).toBe(null)
		})

		test('getOffsetPageId wraps around', () => {
			const { store } = createStore(threePages())

			expect(store.getOffsetPageId('page-a', 1)).toBe('page-b')
			expect(store.getOffsetPageId('page-c', 1)).toBe('page-a')
			expect(store.getOffsetPageId('page-a', -1)).toBe('page-c')
			expect(store.getOffsetPageId('page-b', 3)).toBe('page-b')
			expect(store.getOffsetPageId('unknown', 1)).toBe(null)
		})
	})

	describe('setControlIdAt', () => {
		test('places a control and updates cache, db and events', () => {
			const { db, store } = createStore(threePages())
			const locationListener = vi.fn()
			const dataListener = vi.fn()
			store.on('controlLocationChanged', locationListener)
			store.on('pageDataChanged', dataListener)

			const location = { pageNumber: 1, row: 2, column: 3 }
			expect(store.setControlIdAt(location, 'control-new')).toBe(true)

			expect(store.getControlIdAt(location)).toBe('control-new')
			expect(store.getLocationOfControlId('control-new')).toEqual(location)
			expect(db.data['1'].controls[2][3]).toBe('control-new')

			expect(locationListener).toHaveBeenCalledTimes(1)
			expect(locationListener).toHaveBeenCalledWith('control-new', location)
			expect(dataListener).toHaveBeenCalledWith(1, store.getPageInfo(1))
		})

		test('replacing a control evicts the old one', () => {
			const { store } = createStore(threePages())
			const locationListener = vi.fn()
			store.on('controlLocationChanged', locationListener)

			const location = { pageNumber: 1, row: 0, column: 0 }
			expect(store.setControlIdAt(location, 'control-replacement')).toBe(true)

			expect(store.getControlIdAt(location)).toBe('control-replacement')
			expect(store.getLocationOfControlId('control-a1')).toBe(undefined)
			expect(locationListener).toHaveBeenNthCalledWith(1, 'control-a1', undefined)
			expect(locationListener).toHaveBeenNthCalledWith(2, 'control-replacement', location)
		})

		test('clearing a location with null', () => {
			const { db, store } = createStore(threePages())

			const location = { pageNumber: 1, row: 0, column: 0 }
			expect(store.setControlIdAt(location, null)).toBe(true)

			expect(store.getControlIdAt(location)).toBe(undefined)
			expect(store.getLocationOfControlId('control-a1')).toBe(undefined)
			expect(db.data['1'].controls[0]?.[0]).toBe(undefined)
		})

		test('an invalid page is rejected', () => {
			const { store } = createStore(threePages())

			expect(store.setControlIdAt({ pageNumber: 9, row: 0, column: 0 }, 'control-new')).toBe(false)
		})
	})

	describe('_addPages', () => {
		test('appends pages at the end', () => {
			const { db, store } = createStore(threePages())

			const inserted = store._addPages(['Fourth'], 4)
			expect(inserted).toHaveLength(1)
			expect(inserted[0].name).toBe('Fourth')

			expect(store.getPageCount()).toBe(4)
			expect(store.getPageId(4)).toBe(inserted[0].id)
			expect(db.data['4'].id).toBe(inserted[0].id)
		})

		test('inserts pages in the middle and persists all later pages', () => {
			const { db, store } = createStore(threePages())
			const dataListener = vi.fn()
			store.on('pageDataChanged', dataListener)

			const inserted = store._addPages(['X', 'Y'], 2)
			expect(inserted.map((p) => p.name)).toEqual(['X', 'Y'])

			expect(store.getPageIds()).toEqual(['page-a', inserted[0].id, inserted[1].id, 'page-b', 'page-c'])

			// All pages from the insert position were rewritten in the db
			expect(db.data['2'].id).toBe(inserted[0].id)
			expect(db.data['3'].id).toBe(inserted[1].id)
			expect(db.data['4'].id).toBe('page-b')
			expect(db.data['5'].id).toBe('page-c')
			expect(dataListener.mock.calls.map((call) => call[0])).toEqual([2, 3, 4, 5])
		})

		test('a missing name falls back to PAGE', () => {
			const { store } = createStore(threePages())

			const inserted = store._addPages([undefined as any], 4)
			expect(inserted[0].name).toBe('PAGE')
		})
	})

	describe('_removePage', () => {
		test('removes a page and renumbers the rest', () => {
			const { db, store } = createStore(threePages())

			store._removePage('page-b')

			expect(store.getPageIds()).toEqual(['page-a', 'page-c'])
			expect(db.data['2'].id).toBe('page-c')
			expect(db.data['3']).toBe(undefined)
		})

		test('an unknown page id is a no-op', () => {
			const { store } = createStore(threePages())
			const dataListener = vi.fn()
			store.on('pageDataChanged', dataListener)

			store._removePage('unknown')

			expect(store.getPageCount()).toBe(3)
			expect(dataListener).not.toHaveBeenCalled()
		})

		test('does not update the location cache; _rebuildLocationCache does', () => {
			const { store } = createStore(threePages())

			store._removePage('page-b')

			// The cache is intentionally left stale, the caller must rebuild it
			expect(store.getLocationOfControlId('control-c1')).toEqual({ pageNumber: 3, row: 0, column: 0 })

			store._rebuildLocationCache()
			expect(store.getLocationOfControlId('control-c1')).toEqual({ pageNumber: 2, row: 0, column: 0 })
			expect(store.getLocationOfControlId('control-b1')).toBe(undefined)
		})
	})

	describe('_setPageName', () => {
		test('renames and persists', () => {
			const { db, store } = createStore(threePages())

			const pageInfo = store._setPageName(2, 'Renamed')
			expect(pageInfo!.name).toBe('Renamed')
			expect(store.getPageName(2)).toBe('Renamed')
			expect(db.data['2'].name).toBe('Renamed')
		})

		test('an invalid page returns undefined', () => {
			const { store } = createStore(threePages())

			expect(store._setPageName(9, 'Nope')).toBe(undefined)
		})
	})

	describe('_resetPageControls', () => {
		test('clears all controls and the cache, and reports the removals', () => {
			const { db, store } = createStore(threePages())
			const locationListener = vi.fn()
			store.on('controlLocationChanged', locationListener)

			const removed = store._resetPageControls(2)
			expect(removed.sort()).toEqual(['control-b1', 'control-b2'])

			expect(store.getAllControlIdsOnPage(2)).toEqual([])
			expect(store.getLocationOfControlId('control-b1')).toBe(undefined)
			expect(db.data['2'].controls).toEqual({})

			expect(locationListener).toHaveBeenCalledWith('control-b1', undefined)
			expect(locationListener).toHaveBeenCalledWith('control-b2', undefined)
		})

		test('an invalid page returns an empty list', () => {
			const { store } = createStore(threePages())

			expect(store._resetPageControls(9)).toEqual([])
		})
	})

	describe('_movePageInOrder', () => {
		test('moving forwards lands the page at the target index', () => {
			const { db, store } = createStore(threePages())

			store._movePageInOrder(0, 2)

			// toIndex is an absolute destination (the caller passes pageNumber - 1), so the moved
			// page ends up at exactly that index - consistent with the backwards case below.
			expect(store.getPageIds()).toEqual(['page-b', 'page-c', 'page-a'])
			// Only the affected range is rewritten
			expect(db.data['1'].id).toBe('page-b')
			expect(db.data['2'].id).toBe('page-c')
			expect(db.data['3'].id).toBe('page-a')
		})

		test('moving backwards', () => {
			const { store } = createStore(threePages())

			store._movePageInOrder(2, 0)

			expect(store.getPageIds()).toEqual(['page-c', 'page-a', 'page-b'])
		})

		test('moving to the same index is a no-op', () => {
			const { store } = createStore(threePages())
			const dataListener = vi.fn()
			store.on('pageDataChanged', dataListener)

			store._movePageInOrder(1, 1)

			expect(store.getPageIds()).toEqual(['page-a', 'page-b', 'page-c'])
			expect(dataListener).not.toHaveBeenCalled()
		})
	})

	describe('_rebuildLocationCache', () => {
		test('emits the new location of every control', () => {
			const { store } = createStore(threePages())
			const locationListener = vi.fn()
			store.on('controlLocationChanged', locationListener)

			store._rebuildLocationCache()

			expect(locationListener).toHaveBeenCalledTimes(4)
			expect(locationListener).toHaveBeenCalledWith('control-a1', { pageNumber: 1, row: 0, column: 0 })
			expect(locationListener).toHaveBeenCalledWith('control-b1', { pageNumber: 2, row: 1, column: 2 })
			expect(locationListener).toHaveBeenCalledWith('control-b2', { pageNumber: 2, row: 1, column: 3 })
			expect(locationListener).toHaveBeenCalledWith('control-c1', { pageNumber: 3, row: 0, column: 0 })
		})
	})
})

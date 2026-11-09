import { describe, expect, test, vi } from 'vitest'
import { DisplayedLocations, DisplayedLocationsSet } from '../../lib/Graphics/DisplayedLocations.js'

const location = { pageNumber: 1, row: 0, column: 2 }
const other = { pageNumber: 1, row: 0, column: 3 }
const square = { width: 72, height: 72 }
const wide = { width: 200, height: 100 }

describe('DisplayedLocations', () => {
	test('counts what shows each size, saying when the sizes of a location change', () => {
		const displayed = new DisplayedLocations()
		const changed = vi.fn()
		displayed.on('changed', changed)

		const releaseA = displayed.acquire(location, square)
		const releaseB = displayed.acquire(location, square)
		const releaseWide = displayed.acquire(location, wide)
		expect(displayed.getSizes(location)).toEqual([square, wide])
		expect(displayed.getSizes(other)).toEqual([])
		expect(changed).toHaveBeenCalledTimes(2)

		releaseA()
		releaseA()
		expect(displayed.getSizes(location)).toEqual([square, wide])
		expect(changed).toHaveBeenCalledTimes(2)

		releaseB()
		releaseWide()
		expect(displayed.getSizes(location)).toEqual([])
		expect(changed).toHaveBeenCalledTimes(4)
		expect(changed).toHaveBeenLastCalledWith(location)
	})
})

describe('DisplayedLocations sizes of content alone', () => {
	test('are counted apart from the same size of the whole button', () => {
		const displayed = new DisplayedLocations()
		displayed.acquire(location, square)
		const release = displayed.acquire(location, { ...square, contentOnly: true })
		expect(displayed.getSizes(location)).toEqual([square, { ...square, contentOnly: true }])

		release()
		expect(displayed.getSizes(location)).toEqual([square])
	})
})

describe('DisplayedLocationsSet', () => {
	test('acquires and releases only what changes', () => {
		const displayed = new DisplayedLocations()
		const set = new DisplayedLocationsSet(displayed)
		const changed = vi.fn()
		displayed.on('changed', changed)

		set.replace([
			{ location, size: square },
			{ location, size: square },
			{ location: other, size: wide },
		])
		expect(displayed.getSizes(location)).toEqual([square])
		expect(displayed.getSizes(other)).toEqual([wide])
		expect(changed).toHaveBeenCalledTimes(2)

		changed.mockClear()
		set.replace([{ location, size: square }])
		expect(changed.mock.calls).toEqual([[other]])

		set.clear()
		expect(displayed.getSizes(location)).toEqual([])
	})
})

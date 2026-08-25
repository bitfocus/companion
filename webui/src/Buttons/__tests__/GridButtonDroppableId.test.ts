import { describe, expect, it } from 'vitest'
import { makeGridButtonDroppableId, parseGridButtonDroppableId } from '../GridButtonDroppableId.js'

describe('grid button droppable ids', () => {
	it('round-trips a location', () => {
		const id = makeGridButtonDroppableId(2, 5, 3)

		expect(parseGridButtonDroppableId(id)).toEqual({ pageNumber: 2, column: 5, row: 3 })
	})

	it('keeps column and row the right way round', () => {
		// The maker takes them column-first and the location reads row-first, which is exactly the sort
		// of thing that silently drops buttons in the wrong cell
		expect(parseGridButtonDroppableId(makeGridButtonDroppableId(1, 7, 0))).toEqual({
			pageNumber: 1,
			column: 7,
			row: 0,
		})
	})

	it('round-trips a location at the origin', () => {
		expect(parseGridButtonDroppableId(makeGridButtonDroppableId(1, 0, 0))).toEqual({
			pageNumber: 1,
			column: 0,
			row: 0,
		})
	})

	it('refuses an id belonging to something else', () => {
		// Droppables from elsewhere in the app land in the same drag monitor
		expect(parseGridButtonDroppableId('preset:conn:some-preset')).toBeNull()
		expect(parseGridButtonDroppableId('gridbtn:1:2')).toBeNull()
		expect(parseGridButtonDroppableId('gridbtn:1:2:3:4')).toBeNull()
	})

	it('refuses an id whose parts are not whole numbers', () => {
		expect(parseGridButtonDroppableId('gridbtn:1:x:3')).toBeNull()
		expect(parseGridButtonDroppableId('gridbtn:1:2:3.5')).toBeNull()
		expect(parseGridButtonDroppableId('gridbtn::2:3')).toBeNull()
	})

	it('accepts cells left of and above the origin, since a grid need not start at 0/0', () => {
		expect(parseGridButtonDroppableId(makeGridButtonDroppableId(1, -3, -2))).toEqual({
			pageNumber: 1,
			column: -3,
			row: -2,
		})
	})

	it('refuses anything that is not a string, since dnd-kit ids need not be one', () => {
		expect(parseGridButtonDroppableId(undefined)).toBeNull()
		expect(parseGridButtonDroppableId(null)).toBeNull()
		expect(parseGridButtonDroppableId(42)).toBeNull()
		expect(parseGridButtonDroppableId(Symbol('gridbtn:1:2:3'))).toBeNull()
	})
})

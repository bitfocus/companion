import { describe, expect, it } from 'vitest'
import type { ClientSurfaceLayoutItem, SurfaceSchemaLayoutDefinition } from '@companion-app/shared/Model/Surfaces.js'
import type { UserConfigGridSize } from '@companion-app/shared/Model/UserConfigModel.js'
import { surfaceCellKey } from '@companion-app/shared/SurfaceLayout.js'
import {
	DEFAULT_GRID_VIEW_AS_STATE,
	parseStoredGridViewAs,
	resolveGridViewAs,
	surfaceTypeChoicesFromLayouts,
	type GridViewAsState,
	type KnownSurfacePlacement,
} from '../GridViewAs.js'

const GRID_SIZE: UserConfigGridSize = { minRow: 0, maxRow: 3, minColumn: 0, maxColumn: 7 }

/** A 2x2 of square buttons */
const squareLayout: SurfaceSchemaLayoutDefinition = {
	stylePresets: { default: { bitmap: { w: 72, h: 72 } } },
	controls: {
		'0/0': { row: 0, column: 0 },
		'0/1': { row: 0, column: 1 },
		'1/0': { row: 1, column: 0 },
		'1/1': { row: 1, column: 1 },
	},
}

function layoutItem(id: string, type: string): ClientSurfaceLayoutItem {
	return { id, type, displayName: `${type} (${id})`, isConnected: true, layout: squareLayout }
}

function placement(overrides: Partial<KnownSurfacePlacement> = {}): KnownSurfacePlacement {
	return {
		displayName: 'Stream Deck (abc)',
		offset: { rows: 0, columns: 0 },
		rotation: 0,
		panelGridSize: { rows: 2, columns: 2 },
		...overrides,
	}
}

const layouts = new Map([['abc', layoutItem('abc', 'Stream Deck XL')]])
const placements = new Map([['abc', placement()]])

function viewingSurface(surfaceId: string): GridViewAsState {
	return { enabled: true, selection: { type: 'surface', surfaceId } }
}

function viewingType(surfaceType: string, offset = { rows: 0, columns: 0 }): GridViewAsState {
	return { enabled: true, selection: { type: 'surfaceType', surfaceType, offset } }
}

describe('parseStoredGridViewAs', () => {
	it('reads back what was stored', () => {
		const state = viewingSurface('abc')

		expect(parseStoredGridViewAs(JSON.parse(JSON.stringify(state)))).toEqual(state)
	})

	it('reads back a model selection with its offsets', () => {
		const state = viewingType('Stream Deck XL', { rows: 2, columns: -3 })

		expect(parseStoredGridViewAs(JSON.parse(JSON.stringify(state)))).toEqual(state)
	})

	// Local storage holds whatever some older version of this wrote, or whatever was typed into it, so
	// none of these may leave the page unable to load
	it.each([
		['nothing at all', null],
		['a string', 'yes please'],
		['an object which is not a view', { hello: 'world' }],
		['a selection of an unknown kind', { enabled: true, selection: { type: 'holographic' } }],
		['a surface selection with no surface', { enabled: true, selection: { type: 'surface' } }],
	])('falls back to the view being off for %s', (_name, raw) => {
		expect(parseStoredGridViewAs(raw)).toEqual(DEFAULT_GRID_VIEW_AS_STATE)
	})

	it('repairs offsets which are not numbers', () => {
		const parsed = parseStoredGridViewAs({
			enabled: true,
			selection: { type: 'surfaceType', surfaceType: 'Stream Deck XL', offset: { rows: 'left', columns: null } },
		})

		expect(parsed).toEqual(viewingType('Stream Deck XL'))
	})

	it('holds an offset inside the range the field allows', () => {
		const parsed = parseStoredGridViewAs({
			enabled: true,
			selection: { type: 'surfaceType', surfaceType: 'x', offset: { rows: 1e9, columns: -1e9 } },
		})

		expect(parsed.selection).toEqual({ type: 'surfaceType', surfaceType: 'x', offset: { rows: 999, columns: -999 } })
	})
})

describe('resolveGridViewAs', () => {
	it('is off while the view is turned off', () => {
		expect(resolveGridViewAs({ ...viewingSurface('abc'), enabled: false }, layouts, placements, GRID_SIZE)).toEqual({
			status: 'off',
		})
	})

	it('resolves a surface onto the grid', () => {
		const resolution = resolveGridViewAs(viewingSurface('abc'), layouts, placements, GRID_SIZE)

		expect(resolution.status).toBe('ready')
		if (resolution.status !== 'ready') return

		expect(resolution.displayName).toBe('Stream Deck (abc)')
		expect(resolution.bounds).toEqual({ minRow: 0, maxRow: 1, minColumn: 0, maxColumn: 1 })
		expect(resolution.partlyOffGrid).toBe(false)
	})

	it('places the surface where the surface itself says it is', () => {
		const moved = new Map([['abc', placement({ offset: { rows: 2, columns: 5 } })]])

		const resolution = resolveGridViewAs(viewingSurface('abc'), layouts, moved, GRID_SIZE)

		expect(resolution.status === 'ready' && resolution.bounds).toEqual({
			minRow: 2,
			maxRow: 3,
			minColumn: 5,
			maxColumn: 6,
		})
	})

	it('says so when the surface it was viewing as has been forgotten', () => {
		expect(resolveGridViewAs(viewingSurface('gone'), layouts, placements, GRID_SIZE)).toEqual({
			status: 'unknownSurface',
		})
	})

	it('says so when the surface exists but nothing knows how it is laid out', () => {
		const known = new Map([['xyz', placement({ displayName: 'Old Deck (xyz)' })]])

		expect(resolveGridViewAs(viewingSurface('xyz'), layouts, known, GRID_SIZE)).toEqual({
			status: 'noLayout',
			displayName: 'Old Deck (xyz)',
		})
	})

	describe('viewing as a model rather than a surface', () => {
		it('uses the layout of any surface of that model', () => {
			const resolution = resolveGridViewAs(viewingType('Stream Deck XL'), layouts, placements, GRID_SIZE)

			expect(resolution.status).toBe('ready')
			expect(resolution.status === 'ready' && resolution.displayName).toBe('Stream Deck XL')
		})

		it('puts it where the offsets say, so it can be programmed before it arrives', () => {
			const resolution = resolveGridViewAs(
				viewingType('Stream Deck XL', { rows: 1, columns: 4 }),
				layouts,
				new Map(),
				GRID_SIZE
			)

			expect(resolution.status === 'ready' && resolution.bounds).toEqual({
				minRow: 1,
				maxRow: 2,
				minColumn: 4,
				maxColumn: 5,
			})
		})

		it('says so when no layout is known for that model', () => {
			expect(resolveGridViewAs(viewingType('Stream Deck Studio'), layouts, placements, GRID_SIZE)).toEqual({
				status: 'noLayout',
				displayName: 'Stream Deck Studio',
			})
		})

		it('says so when no model has been chosen yet', () => {
			expect(resolveGridViewAs(viewingType(''), layouts, placements, GRID_SIZE)).toEqual({
				status: 'noLayout',
				displayName: 'Custom',
			})
		})
	})

	describe('a surface which does not fit on the grid', () => {
		it('shows the part which is on the grid, and says the rest is not', () => {
			const resolution = resolveGridViewAs(
				viewingType('Stream Deck XL', { rows: 0, columns: 7 }),
				layouts,
				new Map(),
				GRID_SIZE
			)

			expect(resolution.status).toBe('ready')
			if (resolution.status !== 'ready') return

			expect(resolution.bounds).toEqual({ minRow: 0, maxRow: 1, minColumn: 7, maxColumn: 7 })
			expect(resolution.partlyOffGrid).toBe(true)
		})

		it('says there is nothing to show when none of it is on the grid', () => {
			expect(
				resolveGridViewAs(viewingType('Stream Deck XL', { rows: 0, columns: 20 }), layouts, new Map(), GRID_SIZE)
			).toEqual({ status: 'offGrid', displayName: 'Stream Deck XL' })
		})
	})

	it('reports which cells are controls, so the grid can leave the rest out', () => {
		const resolution = resolveGridViewAs(viewingSurface('abc'), layouts, placements, GRID_SIZE)
		if (resolution.status !== 'ready') throw new Error('expected the view to resolve')

		expect(resolution.view.controlsByCell.has(surfaceCellKey(0, 0))).toBe(true)
		expect(resolution.view.controlsByCell.has(surfaceCellKey(2, 2))).toBe(false)
	})
})

describe('surfaceTypeChoicesFromLayouts', () => {
	it('lists each model once, sorted', () => {
		const many = new Map([
			['a', layoutItem('a', 'Stream Deck XL')],
			['b', layoutItem('b', 'Stream Deck XL')],
			['c', layoutItem('c', 'Stream Deck +')],
		])

		expect(surfaceTypeChoicesFromLayouts(many)).toEqual([
			{ id: 'Stream Deck +', label: 'Stream Deck +' },
			{ id: 'Stream Deck XL', label: 'Stream Deck XL' },
		])
	})

	it('is empty when nothing has ever reported a layout', () => {
		expect(surfaceTypeChoicesFromLayouts(new Map())).toEqual([])
	})
})

import { describe, expect, it } from 'vitest'
import type {
	ClientSurfaceLayoutItem,
	ClientSurfaceModelItem,
	SurfaceSchemaLayoutDefinition,
} from '@companion-app/shared/Model/Surfaces.js'
import type { UserConfigGridSize } from '@companion-app/shared/Model/UserConfigModel.js'
import {
	applySurfaceModelChanges,
	DEFAULT_GRID_VIEW_AS_STATE,
	findSurfaceModelChoice,
	parseStoredGridViewAs,
	resolveGridViewAs,
	surfaceModelChoices,
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

function layoutItem(id: string, type: string, integrationType = 'satellite'): ClientSurfaceLayoutItem {
	return { id, type, integrationType, displayName: `${type} (${id})`, isConnected: true, layout: squareLayout }
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

function modelItem(id: string, name: string, moduleId = 'elgato-streamdeck'): ClientSurfaceModelItem {
	return { id: `${moduleId}:${id}`, moduleId, name, layout: squareLayout, appearance: undefined }
}

const layouts = new Map([['abc', layoutItem('abc', 'Stream Deck XL')]])
const placements = new Map([['abc', placement()]])

/** No plugin has declared anything, so only what has been plugged in is known */
const noModels = new Map<string, ClientSurfaceModelItem>()

function viewingSurface(surfaceId: string): GridViewAsState {
	return { enabled: true, selection: { type: 'surface', surfaceId } }
}

function viewingModel(modelId: string, offset = { rows: 0, columns: 0 }): GridViewAsState {
	return { enabled: true, selection: { type: 'surfaceModel', modelId, offset } }
}

describe('parseStoredGridViewAs', () => {
	it('reads back what was stored', () => {
		const state = viewingSurface('abc')

		expect(parseStoredGridViewAs(JSON.parse(JSON.stringify(state)))).toEqual(state)
	})

	it('reads back a declared model selection with its offsets', () => {
		const state = viewingModel('elgato-streamdeck:xl', { rows: -1, columns: 4 })

		expect(parseStoredGridViewAs(JSON.parse(JSON.stringify(state)))).toEqual(state)
	})

	// Local storage holds whatever some older version of this wrote, or whatever was typed into it, so
	// none of these may leave the page unable to load
	it.each([
		['nothing at all', null],
		['a string', 'yes please'],
		['an object which is not a view', { hello: 'world' }],
	])('falls back to the view being off for %s', (_name, raw) => {
		expect(parseStoredGridViewAs(raw)).toEqual(DEFAULT_GRID_VIEW_AS_STATE)
	})

	// The toggle is still whatever it was; only the part which cannot be understood is dropped
	it.each([
		['an unknown kind', { type: 'holographic' }],
		['a surface with no id', { type: 'surface' }],
		['a model with no id', { type: 'surfaceModel', modelId: '' }],
	])('forgets a selection which is %s, keeping the view otherwise intact', (_name, selection) => {
		expect(parseStoredGridViewAs({ enabled: true, selection })).toEqual({ enabled: true, selection: null })
	})

	it('repairs offsets which are not numbers', () => {
		const parsed = parseStoredGridViewAs({
			enabled: true,
			selection: { type: 'surfaceModel', modelId: 'elgato-streamdeck:xl', offset: { rows: 'left', columns: null } },
		})

		expect(parsed).toEqual(viewingModel('elgato-streamdeck:xl'))
	})

	it('holds an offset inside the range the field allows', () => {
		const parsed = parseStoredGridViewAs({
			enabled: true,
			selection: { type: 'surfaceModel', modelId: 'x', offset: { rows: 1e9, columns: -1e9 } },
		})

		expect(parsed.selection).toEqual({ type: 'surfaceModel', modelId: 'x', offset: { rows: 999, columns: -999 } })
	})
})

describe('resolveGridViewAs', () => {
	it('is off while the view is turned off', () => {
		expect(
			resolveGridViewAs({ ...viewingSurface('abc'), enabled: false }, layouts, noModels, placements, GRID_SIZE)
		).toEqual({
			status: 'off',
		})
	})

	it('resolves a surface onto the grid', () => {
		const resolution = resolveGridViewAs(viewingSurface('abc'), layouts, noModels, placements, GRID_SIZE)

		expect(resolution.status).toBe('ready')
		if (resolution.status !== 'ready') return

		expect(resolution.displayName).toBe('Stream Deck (abc)')
		expect(resolution.bounds).toEqual({ minRow: 0, maxRow: 1, minColumn: 0, maxColumn: 1 })
		expect(resolution.partlyOffGrid).toBe(false)
	})

	it('places the surface where the surface itself says it is', () => {
		const moved = new Map([['abc', placement({ offset: { rows: 2, columns: 5 } })]])

		const resolution = resolveGridViewAs(viewingSurface('abc'), layouts, noModels, moved, GRID_SIZE)

		expect(resolution.status === 'ready' && resolution.bounds).toEqual({
			minRow: 2,
			maxRow: 3,
			minColumn: 5,
			maxColumn: 6,
		})
	})

	it('says so when the surface it was viewing as has been forgotten', () => {
		expect(resolveGridViewAs(viewingSurface('gone'), layouts, noModels, placements, GRID_SIZE)).toEqual({
			status: 'unknownSurface',
		})
	})

	it('says so when the surface exists but nothing knows how it is laid out', () => {
		const known = new Map([['xyz', placement({ displayName: 'Old Deck (xyz)' })]])

		expect(resolveGridViewAs(viewingSurface('xyz'), layouts, noModels, known, GRID_SIZE)).toEqual({
			status: 'noLayout',
			displayName: 'Old Deck (xyz)',
		})
	})

	describe('viewing as a model rather than a surface', () => {
		it('uses a model a plugin declared, with nothing of it plugged in', () => {
			const declared = new Map([['elgato-streamdeck:studio', modelItem('studio', 'Stream Deck Studio')]])

			const resolution = resolveGridViewAs(
				viewingModel('elgato-streamdeck:studio'),
				new Map(),
				declared,
				new Map(),
				GRID_SIZE
			)

			expect(resolution.status).toBe('ready')
			expect(resolution.status === 'ready' && resolution.displayName).toBe('Stream Deck Studio')
		})

		it('puts a declared model where the offsets say', () => {
			const declared = new Map([['elgato-streamdeck:studio', modelItem('studio', 'Stream Deck Studio')]])

			const resolution = resolveGridViewAs(
				viewingModel('elgato-streamdeck:studio', { rows: 2, columns: 3 }),
				new Map(),
				declared,
				new Map(),
				GRID_SIZE
			)

			expect(resolution.status === 'ready' && resolution.bounds).toEqual({
				minRow: 2,
				maxRow: 3,
				minColumn: 3,
				maxColumn: 4,
			})
		})

		it('says so when the plugin which declared the model has gone away', () => {
			expect(
				resolveGridViewAs(viewingModel('elgato-streamdeck:studio'), layouts, noModels, placements, GRID_SIZE)
			).toEqual({ status: 'noLayout', displayName: 'elgato-streamdeck:studio' })
		})

		it('says nothing has been chosen while nothing has been', () => {
			expect(resolveGridViewAs({ enabled: true, selection: null }, layouts, noModels, placements, GRID_SIZE)).toEqual({
				status: 'noSelection',
			})
		})
	})

	describe('a surface which does not fit on the grid', () => {
		const declared = new Map([['elgato-streamdeck:xl', modelItem('xl', 'Stream Deck XL')]])

		it('shows the part which is on the grid, and says the rest is not', () => {
			const resolution = resolveGridViewAs(
				viewingModel('elgato-streamdeck:xl', { rows: 0, columns: 7 }),
				new Map(),
				declared,
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
				resolveGridViewAs(
					viewingModel('elgato-streamdeck:xl', { rows: 0, columns: 20 }),
					new Map(),
					declared,
					new Map(),
					GRID_SIZE
				)
			).toEqual({ status: 'offGrid', displayName: 'Stream Deck XL' })
		})
	})

	it('hands over the surface itself, for the view to draw as the surface rather than as a grid', () => {
		const resolution = resolveGridViewAs(viewingSurface('abc'), layouts, noModels, placements, GRID_SIZE)
		if (resolution.status !== 'ready') throw new Error('expected the view to resolve')

		// Controls with somewhere to be and a size to be drawn at, not a map of which cells are filled
		expect(resolution.view.controls).toHaveLength(4)
		expect(resolution.view.controls[0].bounds.width).toBeGreaterThan(0)
		expect(resolution.view.extent.width).toBeGreaterThan(0)
	})
})

describe('surfaceModelChoices', () => {
	it('offers a model a plugin declares, with nothing plugged in at all', () => {
		const declared = new Map([['elgato-streamdeck:studio', modelItem('studio', 'Stream Deck Studio')]])

		expect(surfaceModelChoices(declared)).toEqual([
			{
				id: 'model:elgato-streamdeck:studio',
				label: 'Stream Deck Studio',
				selector: { type: 'surfaceModel', modelId: 'elgato-streamdeck:studio' },
			},
		])
	})

	it('sorts the declared models by name', () => {
		const declared = new Map([
			['elgato-streamdeck:studio', modelItem('studio', 'Stream Deck Studio')],
			['loupedeck:live', modelItem('live', 'Loupedeck Live', 'loupedeck')],
			['xkeys:xk80', modelItem('xk80', 'X-keys XK-80', 'xkeys')],
		])

		expect(surfaceModelChoices(declared).map((choice) => choice.label)).toEqual([
			'Loupedeck Live',
			'Stream Deck Studio',
			'X-keys XK-80',
		])
	})

	it('is empty when no plugin declares anything', () => {
		expect(surfaceModelChoices(new Map())).toEqual([])
	})
})

describe('findSurfaceModelChoice', () => {
	const declared = new Map([['elgato-streamdeck:xl', modelItem('xl', 'Stream Deck XL')]])
	const choices = surfaceModelChoices(declared)

	it('finds a declared model', () => {
		expect(findSurfaceModelChoice(choices, viewingModel('elgato-streamdeck:xl').selection)?.label).toBe(
			'Stream Deck XL'
		)
	})

	it('finds nothing for a model id which is not among the choices', () => {
		expect(findSurfaceModelChoice(choices, viewingModel('elgato-streamdeck:gone').selection)).toBeNull()
	})

	it('finds nothing for a surface, or for nothing at all', () => {
		expect(findSurfaceModelChoice(choices, viewingSurface('abc').selection)).toBeNull()
		expect(findSurfaceModelChoice(choices, null)).toBeNull()
	})
})

describe('applySurfaceModelChanges', () => {
	const xl = modelItem('xl', 'Stream Deck XL')
	const neo = modelItem('neo', 'Stream Deck Neo')

	it('replaces the lot on init', () => {
		const before = { [neo.id]: neo }
		const after = applySurfaceModelChanges(before, [{ type: 'init', models: { [xl.id]: xl } }])

		expect(after).toEqual({ [xl.id]: xl })
	})

	it('adds and overwrites on replace, and drops on remove', () => {
		let models = applySurfaceModelChanges({}, [{ type: 'replace', itemId: xl.id, info: xl }])
		expect(models).toEqual({ [xl.id]: xl })

		const renamed = { ...xl, name: 'Stream Deck XL v2' }
		models = applySurfaceModelChanges(models, [{ type: 'replace', itemId: xl.id, info: renamed }])
		expect(models[xl.id].name).toBe('Stream Deck XL v2')

		models = applySurfaceModelChanges(models, [{ type: 'remove', itemId: xl.id }])
		expect(models).toEqual({})
	})

	it('returns the same reference when a remove changes nothing, so it does not force a re-render', () => {
		const before = { [xl.id]: xl }
		const after = applySurfaceModelChanges(before, [{ type: 'remove', itemId: 'nope' }])

		expect(after).toBe(before)
	})

	it('applies a batch of ops in order', () => {
		const after = applySurfaceModelChanges({}, [
			{ type: 'init', models: { [xl.id]: xl } },
			{ type: 'replace', itemId: neo.id, info: neo },
			{ type: 'remove', itemId: xl.id },
		])

		expect(after).toEqual({ [neo.id]: neo })
	})
})

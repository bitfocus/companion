import { describe, expect, test } from 'vitest'
import type { SurfaceConfig, SurfaceLayoutDefinition } from '@companion-app/shared/Model/Surfaces.js'
import {
	buildGridSurfaceLayout,
	resolveControlStylePreset,
	surfaceButtonSizesFromLayouts,
	surfaceLayoutsFromConfigs,
	type SurfaceLayoutSource,
} from '../../lib/Surface/LayoutSummary.js'

function makeConfig(partial: Partial<SurfaceConfig>): SurfaceConfig {
	return {
		config: { brightness: 100, rotation: 0, xOffset: 0, yOffset: 0, groupId: null },
		groupConfig: {
			name: '',
			last_page_id: '1',
			startup_page_id: '1',
			use_last_page: true,
			never_lock: false,
		},
		groupId: null,
		type: 'Test Surface',
		integrationType: 'test',
		gridSize: { columns: 2, rows: 1 },
		layout: undefined,
		...partial,
	}
}

/** A surface shaped like a Stream Deck Neo: square keys plus a wide info bar */
const neoLayout: SurfaceLayoutDefinition = {
	stylePresets: {
		default: { bitmap: { w: 96, h: 96 } },
		infoBar: { bitmap: { w: 248, h: 58 } },
	},
	controls: {
		'0/0': { row: 0, column: 0 },
		'0/1': { row: 0, column: 1 },
		'1/0': { row: 1, column: 0, stylePreset: 'infoBar' },
	},
}

const squareLayout: SurfaceLayoutDefinition = {
	stylePresets: { default: { bitmap: { w: 72, h: 72 } } },
	controls: { '0/0': { row: 0, column: 0 } },
}

describe('resolveControlStylePreset', () => {
	test('uses the default preset when the control names none', () => {
		expect(resolveControlStylePreset(neoLayout, { row: 0, column: 0 })).toEqual({ bitmap: { w: 96, h: 96 } })
	})

	test('uses the named preset when the control names one', () => {
		expect(resolveControlStylePreset(neoLayout, { row: 1, column: 0, stylePreset: 'infoBar' })).toEqual({
			bitmap: { w: 248, h: 58 },
		})
	})

	test('falls back to the default preset when the named one is unknown', () => {
		expect(resolveControlStylePreset(neoLayout, { row: 1, column: 0, stylePreset: 'nope' })).toEqual({
			bitmap: { w: 96, h: 96 },
		})
	})
})

describe('surfaceLayoutsFromConfigs', () => {
	test('includes connected and offline surfaces alike', () => {
		const sources: SurfaceLayoutSource[] = [
			{ surfaceId: 'online', config: makeConfig({ layout: squareLayout }), isConnected: true },
			{ surfaceId: 'offline', config: makeConfig({ layout: neoLayout }), isConnected: false },
		]

		const result = surfaceLayoutsFromConfigs(sources)

		expect(Object.keys(result)).toEqual(['online', 'offline'])
		expect(result.online.isConnected).toBe(true)
		expect(result.online.layout).toEqual(squareLayout)
		expect(result.offline.isConnected).toBe(false)
		expect(result.offline.layout).toEqual(neoLayout)
	})

	test('omits surfaces which have no stored layout', () => {
		const result = surfaceLayoutsFromConfigs([
			{ surfaceId: 'noLayout', config: makeConfig({ layout: undefined }), isConnected: true },
			{ surfaceId: 'hasLayout', config: makeConfig({ layout: squareLayout }), isConnected: true },
		])

		expect(Object.keys(result)).toEqual(['hasLayout'])
	})

	test('reports the model name and the display name of the surface', () => {
		const result = surfaceLayoutsFromConfigs([
			{ surfaceId: 'abc', config: makeConfig({ layout: squareLayout, type: 'Stream Deck Neo' }), isConnected: true },
		])

		expect(result.abc.type).toBe('Stream Deck Neo')
		expect(result.abc.displayName).toBe('Stream Deck Neo (abc)')
	})

	test('prefers the user given name for the display name', () => {
		const result = surfaceLayoutsFromConfigs([
			{
				surfaceId: 'abc',
				config: makeConfig({ layout: squareLayout, type: 'Stream Deck Neo', name: 'Desk' }),
				isConnected: true,
			},
		])

		expect(result.abc.type).toBe('Stream Deck Neo')
		expect(result.abc.displayName).toBe('Desk (abc)')
	})

	test('falls back to Unknown for a config with no type', () => {
		const result = surfaceLayoutsFromConfigs([
			{ surfaceId: 'abc', config: makeConfig({ layout: squareLayout, type: undefined }), isConnected: true },
		])

		expect(result.abc.type).toBe('Unknown')
	})

	test('produces nothing for no sources', () => {
		expect(surfaceLayoutsFromConfigs([])).toEqual({})
	})
})

describe('surfaceButtonSizesFromLayouts', () => {
	function sizesFor(layout: SurfaceLayoutDefinition) {
		const layouts = surfaceLayoutsFromConfigs([{ surfaceId: 'abc', config: makeConfig({ layout }), isConnected: true }])
		return surfaceButtonSizesFromLayouts(layouts).abc.bitmapSizes
	}

	test('dedupes the sizes shared by several controls', () => {
		expect(sizesFor(neoLayout)).toEqual([
			{ w: 96, h: 96 },
			{ w: 248, h: 58 },
		])
	})

	test('a control with no bitmap contributes nothing', () => {
		expect(
			sizesFor({
				stylePresets: { default: { bitmap: { w: 72, h: 72 } }, textOnly: { text: true } },
				controls: {
					'0/0': { row: 0, column: 0 },
					'0/1': { row: 0, column: 1, stylePreset: 'textOnly' },
				},
			})
		).toEqual([{ w: 72, h: 72 }])
	})

	test('a surface with no drawn controls has no sizes', () => {
		expect(
			sizesFor({
				stylePresets: { default: { text: true } },
				controls: { '0/0': { row: 0, column: 0 } },
			})
		).toEqual([])
	})

	test('a surface with no controls at all has no sizes', () => {
		expect(sizesFor({ stylePresets: { default: { bitmap: { w: 72, h: 72 } } }, controls: {} })).toEqual([])
	})

	test('carries through the identifying fields of each surface', () => {
		const layouts = surfaceLayoutsFromConfigs([
			{ surfaceId: 'abc', config: makeConfig({ layout: squareLayout, type: 'Emulator' }), isConnected: false },
		])

		expect(surfaceButtonSizesFromLayouts(layouts)).toEqual({
			abc: {
				id: 'abc',
				type: 'Emulator',
				displayName: 'Emulator (abc)',
				isConnected: false,
				bitmapSizes: [{ w: 72, h: 72 }],
			},
		})
	})
})

describe('buildGridSurfaceLayout', () => {
	test('has a control per grid cell, keyed by row and column', () => {
		const layout = buildGridSurfaceLayout({ columns: 3, rows: 2 }, { w: 288, h: 288 })

		expect(Object.keys(layout.controls)).toEqual(['0/0', '0/1', '0/2', '1/0', '1/1', '1/2'])
		expect(layout.controls['1/2']).toEqual({ row: 1, column: 2 })
		expect(layout.stylePresets.default).toEqual({ bitmap: { w: 288, h: 288 } })
	})

	test('an empty grid has no controls', () => {
		expect(buildGridSurfaceLayout({ columns: 0, rows: 0 }, { w: 288, h: 288 }).controls).toEqual({})
	})

	test('reports a single size for the whole grid', () => {
		const layouts = surfaceLayoutsFromConfigs([
			{
				surfaceId: 'emulator:1',
				config: makeConfig({ layout: buildGridSurfaceLayout({ columns: 8, rows: 4 }, { w: 288, h: 288 }) }),
				isConnected: true,
			},
		])

		expect(surfaceButtonSizesFromLayouts(layouts)['emulator:1'].bitmapSizes).toEqual([{ w: 288, h: 288 }])
	})
})

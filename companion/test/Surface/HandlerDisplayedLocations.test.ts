import { EventEmitter } from 'node:events'
import { describe, expect, test, vi } from 'vitest'
import type { SurfaceConfig, SurfaceSchemaLayoutDefinition } from '@companion-app/shared/Model/Surfaces.js'
import { DisplayedLocations } from '../../lib/Graphics/DisplayedLocations.js'
import { SurfaceHandler } from '../../lib/Surface/Handler.js'

/** A panel with a square button, a strip button and a text only control, side by side */
const layout: SurfaceSchemaLayoutDefinition = {
	stylePresets: {
		default: { bitmap: { w: 72, h: 72 } },
		strip: { bitmap: { w: 200, h: 100 } },
		text: { text: true },
	},
	controls: {
		'0/0': { row: 0, column: 0 },
		'0/1': { row: 0, column: 1, stylePreset: 'strip' },
		'0/2': { row: 0, column: 2, stylePreset: 'text' },
	},
}

function createHandler(config: Partial<SurfaceConfig['config']> = {}) {
	const displayedLocations = new DisplayedLocations()
	const graphics = Object.assign(new EventEmitter(), {
		displayedLocations,
		getCachedRenderOrGeneratePlaceholder: vi.fn(() => ({}) as any),
	})
	const panel = Object.assign(new EventEmitter(), {
		info: { surfaceId: 'test', description: 'Test' },
		gridSize: { rows: 1, columns: 3 },
		surfaceLayout: layout,
		draw: vi.fn(),
		setLocked: vi.fn(),
		quit: vi.fn(),
	})
	const surfaceConfig = {
		config: { rotation: 0, xOffset: 0, yOffset: 0, ...config },
		groupId: null,
	} as unknown as SurfaceConfig

	const handler = new SurfaceHandler(
		{ emit: vi.fn() } as any,
		{
			controls: {} as any,
			graphics: graphics as any,
			pageStore: { getFirstPageId: () => 'page1', getPageNumber: () => 1 } as any,
			userconfig: {} as any,
			variables: {} as any,
		},
		new EventEmitter() as any,
		panel as any,
		surfaceConfig
	)
	return { handler, displayedLocations, panel }
}

describe('SurfaceHandler displayed locations', () => {
	test('says which locations it shows, at the size of the control showing each', () => {
		const { handler, displayedLocations } = createHandler()
		handler.triggerRedraw()

		expect(displayedLocations.getSizes({ pageNumber: 1, row: 0, column: 0 })).toEqual([{ width: 72, height: 72 }])
		expect(displayedLocations.getSizes({ pageNumber: 1, row: 0, column: 1 })).toEqual([{ width: 200, height: 100 }])
		// Nothing is drawn for a control without a bitmap
		expect(displayedLocations.getSizes({ pageNumber: 1, row: 0, column: 2 })).toEqual([])

		handler.unload()
	})

	test('follows the surface when it moves, and lets go when it locks or goes', () => {
		const { handler, displayedLocations } = createHandler()
		handler.triggerRedraw()

		handler.setPosition(1, 0)
		expect(displayedLocations.getSizes({ pageNumber: 1, row: 0, column: 0 })).toEqual([])
		expect(displayedLocations.getSizes({ pageNumber: 1, row: 0, column: 1 })).toEqual([{ width: 72, height: 72 }])

		handler.setLocked(true, true)
		expect(displayedLocations.getSizes({ pageNumber: 1, row: 0, column: 1 })).toEqual([])

		handler.setLocked(false)
		handler.triggerRedraw()
		expect(displayedLocations.getSizes({ pageNumber: 1, row: 0, column: 1 })).toEqual([{ width: 72, height: 72 }])

		handler.unload()
		expect(displayedLocations.getSizes({ pageNumber: 1, row: 0, column: 1 })).toEqual([])
	})

	test('a surface turned on its side draws each location turned too', () => {
		const { handler, displayedLocations } = createHandler({ rotation: 'surface90' })
		handler.triggerRedraw()

		// The panel's row of three is a column of three to the grid, with the strip upright
		expect(displayedLocations.getSizes({ pageNumber: 1, row: 1, column: 0 })).toEqual([{ width: 100, height: 200 }])

		handler.unload()
	})
})

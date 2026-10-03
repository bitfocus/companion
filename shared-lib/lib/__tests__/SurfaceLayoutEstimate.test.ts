import { describe, expect, test } from 'vitest'
import type { SurfaceSchemaLayoutDefinition } from '../Model/Surfaces.js'
import {
	resolveSurfaceView,
	type ResolvedSurfaceControl,
	type ResolvedSurfaceView,
	type SurfaceGridPlacement,
} from '../SurfaceLayout.js'

// Through resolveSurfaceView, as a surface which describes no face of its own is how the estimate is reached

function controlAt(view: ResolvedSurfaceView, row: number, column: number): ResolvedSurfaceControl {
	const control = view.controls.find((control) => control.cell.row === row && control.cell.column === column)
	if (!control) throw new Error(`no control drives ${row}/${column}`)

	return control
}

describe('estimating a face from the layout', () => {
	/** Shaped like a Stream Deck Neo: 4x2 keys, then a touch button, an info bar across two columns, a touch button */
	const neoShaped: SurfaceSchemaLayoutDefinition = {
		stylePresets: {
			default: { bitmap: { w: 96, h: 96 } },
			infoBar: { bitmap: { w: 248, h: 58 } },
			touch: { colors: 'hex' },
		},
		controls: {
			...Object.fromEntries(
				[0, 1].flatMap((row) => [0, 1, 2, 3].map((column) => [`${row}/${column}`, { row, column }]))
			),
			'2/0': { row: 2, column: 0, stylePreset: 'touch' },
			'2/1': { row: 2, column: 1, stylePreset: 'infoBar' },
			'2/3': { row: 2, column: 3, stylePreset: 'touch' },
		},
	}
	const neoPlacement: SurfaceGridPlacement = {
		offset: { rows: 0, columns: 0 },
		rotation: 0,
		panelGridSize: { rows: 3, columns: 4 },
	}

	test('lets a wide display spill into the empty cell beside it, rather than widening its own column', () => {
		const view = resolveSurfaceView(neoShaped, null, neoPlacement)!

		// The keys above stay evenly spaced, as they would be if the bar were not there
		const xs = [0, 1, 2, 3].map((column) => controlAt(view, 0, column).bounds.x)
		const steps = xs.slice(1).map((x, i) => x - xs[i])
		expect(steps[1]).toBeCloseTo(steps[0])
		expect(steps[2]).toBeCloseTo(steps[0])

		// The bar sits across the two columns it took, centred under the keys of both
		const bar = controlAt(view, 2, 1).bounds
		const left = controlAt(view, 0, 1).bounds
		const right = controlAt(view, 0, 2).bounds
		expect(bar.x + bar.width / 2).toBeCloseTo((left.x + right.x + right.width) / 2)
	})

	test('fills a cell with a control which has no display, rather than drawing it a fixed square', () => {
		const view = resolveSurfaceView(neoShaped, null, neoPlacement)!

		// As wide as the keys in its column, as tall as the bar in its row
		expect(controlAt(view, 2, 0).bounds.width).toBe(96)
		expect(controlAt(view, 2, 0).bounds.height).toBe(58)
		expect(controlAt(view, 2, 0).bounds.x).toBeCloseTo(controlAt(view, 0, 0).bounds.x)
	})

	test('leaves a cell two displays would both spill into to neither of them', () => {
		const layout: SurfaceSchemaLayoutDefinition = {
			stylePresets: { default: { bitmap: { w: 96, h: 96 } }, wide: { bitmap: { w: 200, h: 60 } } },
			controls: {
				...Object.fromEntries([0, 1, 2].map((column) => [`0/${column}`, { row: 0, column }])),
				'1/0': { row: 1, column: 0, stylePreset: 'wide' },
				'1/2': { row: 1, column: 2, stylePreset: 'wide' },
			},
		}
		const view = resolveSurfaceView(layout, null, {
			offset: { rows: 0, columns: 0 },
			rotation: 0,
			panelGridSize: { rows: 2, columns: 3 },
		})!

		const leftBar = controlAt(view, 1, 0).bounds
		const rightBar = controlAt(view, 1, 2).bounds
		const middle = controlAt(view, 0, 1).bounds

		// Each widened its own column instead, so neither reaches over the middle one
		expect(leftBar.x + leftBar.width).toBeLessThanOrEqual(middle.x)
		expect(rightBar.x).toBeGreaterThanOrEqual(middle.x + middle.width)
	})

	test('lets a tall display spill into the empty cell below it', () => {
		const layout: SurfaceSchemaLayoutDefinition = {
			stylePresets: { default: { bitmap: { w: 96, h: 96 } }, tall: { bitmap: { w: 96, h: 200 } } },
			controls: {
				'0/0': { row: 0, column: 0 },
				'1/0': { row: 1, column: 0 },
				'0/1': { row: 0, column: 1, stylePreset: 'tall' },
			},
		}
		const view = resolveSurfaceView(layout, null, {
			offset: { rows: 0, columns: 0 },
			rotation: 0,
			panelGridSize: { rows: 2, columns: 2 },
		})!

		// The keys down the first column stay a key apart, with the tall one beside the pair of them
		const top = controlAt(view, 0, 0).bounds
		const bottom = controlAt(view, 1, 0).bounds
		expect(bottom.y - (top.y + top.height)).toBeLessThan(top.height / 2)
		const tall = controlAt(view, 0, 1).bounds
		expect(tall.y + tall.height / 2).toBeCloseTo((top.y + bottom.y + bottom.height) / 2)
	})

	test('does not spill past the edge of the surface', () => {
		const layout: SurfaceSchemaLayoutDefinition = {
			stylePresets: { default: { bitmap: { w: 96, h: 96 } }, wide: { bitmap: { w: 248, h: 58 } } },
			controls: {
				'0/0': { row: 0, column: 0 },
				'0/1': { row: 0, column: 1 },
				'1/1': { row: 1, column: 1, stylePreset: 'wide' },
			},
		}
		const view = resolveSurfaceView(layout, null, {
			offset: { rows: 0, columns: 0 },
			rotation: 0,
			panelGridSize: { rows: 2, columns: 2 },
		})!

		// The only room is the cell before it, so it takes that and the surface is no wider than it needs to be
		const bar = controlAt(view, 1, 1).bounds
		expect(bar.x).toBeGreaterThanOrEqual(0)
		expect(bar.x + bar.width).toBeLessThanOrEqual(view.extent.width)
		expect(view.controls.every((control) => control.cell.column <= 1)).toBe(true)
	})

	test('keeps a knob round, rather than filling its cell', () => {
		const layout: SurfaceSchemaLayoutDefinition = {
			stylePresets: {
				default: { bitmap: { w: 200, h: 100 } },
				knob: { leds: { segments: 24, mode: 'full-ring' } },
			},
			controls: { '0/0': { row: 0, column: 0 }, '1/0': { row: 1, column: 0, stylePreset: 'knob' } },
		}
		const view = resolveSurfaceView(layout, null, {
			offset: { rows: 0, columns: 0 },
			rotation: 0,
			panelGridSize: { rows: 2, columns: 1 },
		})!

		const knob = controlAt(view, 1, 0).bounds
		expect(knob.width).toBe(knob.height)
	})

	test('draws every control a nominal key on a surface with no displays to go on', () => {
		const layout: SurfaceSchemaLayoutDefinition = {
			stylePresets: { default: {} },
			controls: { '0/0': { row: 0, column: 0 }, '0/1': { row: 0, column: 1 } },
		}
		const view = resolveSurfaceView(layout, null, {
			offset: { rows: 0, columns: 0 },
			rotation: 0,
			panelGridSize: { rows: 1, columns: 2 },
		})!

		expect(view.controls.map((control) => [control.bounds.width, control.bounds.height])).toEqual([
			[72, 72],
			[72, 72],
		])
	})
})

import { describe, expect, test } from 'vitest'
import type { SurfaceSchemaLayoutDefinition } from '../Model/Surfaces.js'
import {
	chooseViewAspectRatio,
	resolveControlStylePreset,
	resolveSurfaceGridView,
	surfaceCellKey,
	surfaceRenderScale,
	type SurfaceGridPlacement,
} from '../SurfaceLayout.js'

/** A surface shaped like a Stream Deck Neo: square keys plus a wide info bar */
const neoLayout: SurfaceSchemaLayoutDefinition = {
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

/** A plain 2x2 of square buttons */
const squareLayout: SurfaceSchemaLayoutDefinition = {
	stylePresets: { default: { bitmap: { w: 72, h: 72 } } },
	controls: {
		'0/0': { row: 0, column: 0 },
		'0/1': { row: 0, column: 1 },
		'1/0': { row: 1, column: 0 },
		'1/1': { row: 1, column: 1 },
	},
}

/**
 * Shaped like a Stream Deck +: 8 square buttons over 4 segments of a 2:1 touch strip. The strip loses the vote,
 * which is the case letterboxing exists for.
 */
const plusLayout: SurfaceSchemaLayoutDefinition = {
	stylePresets: {
		default: { bitmap: { w: 120, h: 120 } },
		strip: { bitmap: { w: 200, h: 100 } },
	},
	controls: Object.fromEntries([
		...[0, 1, 2, 3].flatMap((column) => [
			[`0/${column}`, { row: 0, column }],
			[`1/${column}`, { row: 1, column }],
		]),
		...[0, 1, 2, 3].map((column) => [`2/${column}`, { row: 2, column, stylePreset: 'strip' }]),
	]),
}

/**
 * Shaped like a Stream Deck Studio: non-square buttons, plus encoders which declare only leds and so are drawn at
 * no shape of their own. The sparse encoder row is the case cropping to the bounding box has to keep holes in.
 */
const studioLayout: SurfaceSchemaLayoutDefinition = {
	stylePresets: {
		default: { bitmap: { w: 200, h: 156 } },
		encoder: { leds: { segments: 24, mode: 'full-ring' } },
	},
	controls: {
		...Object.fromEntries([0, 1, 2, 3, 4, 5, 6, 7].map((column) => [`0/${column}`, { row: 0, column }])),
		'1/0': { row: 1, column: 0, stylePreset: 'encoder' },
		'1/7': { row: 1, column: 7, stylePreset: 'encoder' },
	},
}

const NO_ROTATION: SurfaceGridPlacement = {
	offset: { rows: 0, columns: 0 },
	rotation: 0,
	panelGridSize: { rows: 2, columns: 2 },
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

describe('chooseViewAspectRatio', () => {
	test('groups by shape rather than by size, so the same shape does not split the vote', () => {
		const chosen = chooseViewAspectRatio(
			[
				{ w: 1, h: 1 },
				{ w: 1, h: 1 },
				{ w: 2, h: 1 },
			],
			{ w: 1, h: 1 }
		)

		expect(chosen).toEqual({ w: 1, h: 1 })
	})

	test('counts controls rather than presets', () => {
		const chosen = chooseViewAspectRatio([{ w: 2, h: 1 }, ...Array.from({ length: 5 }, () => ({ w: 1, h: 1 }))], {
			w: 2,
			h: 1,
		})

		expect(chosen).toEqual({ w: 1, h: 1 })
	})

	test('ignores controls with no shape of their own', () => {
		expect(chooseViewAspectRatio([{ w: 9, h: 7 }, null, null], { w: 9, h: 7 })).toEqual({ w: 9, h: 7 })
	})

	test('breaks a tie with the default preset', () => {
		expect(
			chooseViewAspectRatio(
				[
					{ w: 2, h: 1 },
					{ w: 1, h: 1 },
				],
				{ w: 2, h: 1 }
			)
		).toEqual({ w: 2, h: 1 })
	})

	test('breaks a tie the default is not part of by sorting, so it does not depend on iteration order', () => {
		const forwards = chooseViewAspectRatio(
			[
				{ w: 2, h: 1 },
				{ w: 1, h: 2 },
			],
			null
		)
		const backwards = chooseViewAspectRatio(
			[
				{ w: 1, h: 2 },
				{ w: 2, h: 1 },
			],
			null
		)

		expect(forwards).toEqual(backwards)
		expect(forwards).toEqual({ w: 1, h: 2 })
	})

	test('falls back to the default when nothing has a shape', () => {
		expect(chooseViewAspectRatio([null, null], { w: 9, h: 7 })).toEqual({ w: 9, h: 7 })
	})

	test('falls back to square when there is no default either', () => {
		expect(chooseViewAspectRatio([null], null)).toEqual({ w: 1, h: 1 })
	})
})

describe('surfaceRenderScale', () => {
	test('scales the least detailed control up to a normal preview, keeping the others in proportion', () => {
		// A Stream Deck +XL: the strip is twice as wide as a button, and stays twice as wide
		expect(
			surfaceRenderScale([
				{ w: 120, h: 120 },
				{ w: 200, h: 100 },
			])
		).toBeCloseTo(288 / 120)
	})

	test('does not scale a surface which already draws larger than a preview', () => {
		expect(surfaceRenderScale([{ w: 400, h: 400 }])).toBe(1)
	})

	test('caps the scale so a large display does not become an enormous render', () => {
		// Scaling the 96px buttons up 3x would ask for a 3072px render of the display
		const scale = surfaceRenderScale([
			{ w: 96, h: 96 },
			{ w: 1024, h: 600 },
		])

		expect(1024 * scale).toBeLessThanOrEqual(2048)
	})

	test('is 1 when nothing has a bitmap', () => {
		expect(surfaceRenderScale([])).toBe(1)
	})
})

describe('resolveSurfaceGridView', () => {
	test('places every control, cropped to their bounding box', () => {
		const view = resolveSurfaceGridView(squareLayout, NO_ROTATION)!

		expect(view.type).toBe('grid')
		expect(view.bounds).toEqual({ minRow: 0, maxRow: 1, minColumn: 0, maxColumn: 1 })
		expect(view.controls).toHaveLength(4)
		expect(view.aspectRatio).toEqual({ w: 1, h: 1 })
		expect(view.hasMixedAspectRatios).toBe(false)
	})

	test('offsets the controls onto the grid', () => {
		const view = resolveSurfaceGridView(squareLayout, {
			...NO_ROTATION,
			offset: { rows: 3, columns: 5 },
		})!

		expect(view.bounds).toEqual({ minRow: 3, maxRow: 4, minColumn: 5, maxColumn: 6 })
		expect(view.controlsByCell.get(surfaceCellKey(3, 5))?.id).toBe('0/0')
	})

	test('returns null for a layout which describes no controls', () => {
		expect(
			resolveSurfaceGridView({ stylePresets: { default: { bitmap: { w: 72, h: 72 } } }, controls: {} }, NO_ROTATION)
		).toBeNull()
	})

	describe('a Stream Deck + shaped surface', () => {
		const placement: SurfaceGridPlacement = {
			offset: { rows: 0, columns: 0 },
			rotation: 0,
			panelGridSize: { rows: 3, columns: 4 },
		}

		test('draws the whole view at the shape the buttons have, which outnumber the strip', () => {
			const view = resolveSurfaceGridView(plusLayout, placement)!

			expect(view.aspectRatio).toEqual({ w: 1, h: 1 })
			expect(view.hasMixedAspectRatios).toBe(true)
		})

		test('keeps the strip at its own shape, to be letterboxed into its cell', () => {
			const view = resolveSurfaceGridView(plusLayout, placement)!

			expect(view.controlsByCell.get(surfaceCellKey(2, 0))?.aspectRatio).toEqual({ w: 2, h: 1 })
			expect(view.controlsByCell.get(surfaceCellKey(0, 0))?.aspectRatio).toEqual({ w: 1, h: 1 })
		})

		test('draws the strip larger than a button, in the proportion the surface itself uses', () => {
			const view = resolveSurfaceGridView(plusLayout, placement)!

			const button = view.controlsByCell.get(surfaceCellKey(0, 0))!.renderSize
			const strip = view.controlsByCell.get(surfaceCellKey(2, 0))!.renderSize

			// The buttons are the least detailed control, so they set the scale at 288/120
			expect(button).toEqual({ width: 288, height: 288 })
			expect(strip).toEqual({ width: 480, height: 240 })
			expect(strip.width / button.width).toBeCloseTo(200 / 120)
		})
	})

	describe('a Stream Deck Studio shaped surface', () => {
		const placement: SurfaceGridPlacement = {
			offset: { rows: 0, columns: 0 },
			rotation: 0,
			panelGridSize: { rows: 2, columns: 8 },
		}

		test('draws the view at the non-square shape of its buttons', () => {
			const view = resolveSurfaceGridView(studioLayout, placement)!

			expect(view.aspectRatio).toEqual({ w: 50, h: 39 })
			expect(view.hasMixedAspectRatios).toBe(false)
		})

		test('keeps the encoders as cells with no shape of their own', () => {
			const view = resolveSurfaceGridView(studioLayout, placement)!

			expect(view.controlsByCell.get(surfaceCellKey(1, 0))?.aspectRatio).toBeNull()
		})

		test('leaves the gaps between the encoders absent, rather than filling the bounding box', () => {
			const view = resolveSurfaceGridView(studioLayout, placement)!

			expect(view.bounds).toEqual({ minRow: 0, maxRow: 1, minColumn: 0, maxColumn: 7 })
			expect(view.controlsByCell.has(surfaceCellKey(1, 0))).toBe(true)
			expect(view.controlsByCell.has(surfaceCellKey(1, 7))).toBe(true)
			for (const column of [1, 2, 3, 4, 5, 6]) {
				expect(view.controlsByCell.has(surfaceCellKey(1, column))).toBe(false)
			}
		})
	})

	describe('rotation', () => {
		// A 1x3 strip of buttons, so which way it lies says which way it was turned
		const stripLayout: SurfaceSchemaLayoutDefinition = {
			stylePresets: { default: { bitmap: { w: 72, h: 72 } } },
			controls: {
				a: { row: 0, column: 0 },
				b: { row: 0, column: 1 },
				c: { row: 0, column: 2 },
			},
		}
		const panelGridSize = { rows: 1, columns: 3 }

		test('lays an unrotated surface out as the layout describes it', () => {
			const view = resolveSurfaceGridView(stripLayout, { offset: { rows: 0, columns: 0 }, rotation: 0, panelGridSize })!

			expect(view.bounds).toEqual({ minRow: 0, maxRow: 0, minColumn: 0, maxColumn: 2 })
		})

		test('turns a quarter-turned surface onto its side, as the surface handler does', () => {
			const view = resolveSurfaceGridView(stripLayout, {
				offset: { rows: 0, columns: 0 },
				rotation: 'surface90',
				panelGridSize,
			})!

			expect(view.bounds).toEqual({ minRow: 0, maxRow: 2, minColumn: 0, maxColumn: 0 })
			expect(view.controlsByCell.get(surfaceCellKey(0, 0))?.id).toBe('a')
			expect(view.controlsByCell.get(surfaceCellKey(2, 0))?.id).toBe('c')
		})

		test('reverses a surface turned upside down', () => {
			const view = resolveSurfaceGridView(stripLayout, {
				offset: { rows: 0, columns: 0 },
				rotation: 'surface180',
				panelGridSize,
			})!

			expect(view.bounds).toEqual({ minRow: 0, maxRow: 0, minColumn: 0, maxColumn: 2 })
			expect(view.controlsByCell.get(surfaceCellKey(0, 0))?.id).toBe('c')
			expect(view.controlsByCell.get(surfaceCellKey(0, 2))?.id).toBe('a')
		})
	})
})

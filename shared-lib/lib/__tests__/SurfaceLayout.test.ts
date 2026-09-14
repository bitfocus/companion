import { describe, expect, test } from 'vitest'
import type { SurfaceSchemaLayoutDefinition } from '../Model/Surfaces.js'
import {
	resolveControlStylePreset,
	resolveSurfaceView,
	surfaceRenderScale,
	type ResolvedSurfaceControl,
	type ResolvedSurfaceView,
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
 * Shaped like a Stream Deck +: 8 square keys over 4 segments of a 2:1 touch strip. The strip is the case the old
 * uniform-cell drawing could not tell the truth about.
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
 * Shaped like a Stream Deck Studio: non-square keys, plus encoders which declare only leds and so have no bitmap
 * of their own, spaced out along a row rather than filling it.
 */
const studioLayout: SurfaceSchemaLayoutDefinition = {
	stylePresets: {
		default: { bitmap: { w: 200, h: 156 } },
		encoder: { leds: { segments: 24, mode: 'full-ring' } },
	},
	controls: {
		...Object.fromEntries([0, 1, 2, 3].map((column) => [`0/${column}`, { row: 0, column }])),
		'1/0': { row: 1, column: 0, stylePreset: 'encoder' },
		'1/3': { row: 1, column: 3, stylePreset: 'encoder' },
	},
}

const UNROTATED: SurfaceGridPlacement = {
	offset: { rows: 0, columns: 0 },
	rotation: 0,
	panelGridSize: { rows: 2, columns: 2 },
}

function controlAt(view: ResolvedSurfaceView, row: number, column: number): ResolvedSurfaceControl {
	const control = view.controls.find((control) => control.cell.row === row && control.cell.column === column)
	if (!control) throw new Error(`no control drives ${row}/${column}`)

	return control
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

describe('surfaceRenderScale', () => {
	test('scales the least detailed control up to a normal preview, keeping the others in proportion', () => {
		// A Stream Deck +XL: the strip is drawn wider than a key, and stays wider
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

describe('resolveSurfaceView', () => {
	test('returns null for a layout which describes no controls', () => {
		expect(
			resolveSurfaceView({ stylePresets: { default: { bitmap: { w: 72, h: 72 } } }, controls: {} }, UNROTATED)
		).toBeNull()
	})

	test('places every control, and says which button each drives', () => {
		const view = resolveSurfaceView(squareLayout, UNROTATED)!

		expect(view.controls).toHaveLength(4)
		expect(controlAt(view, 0, 0).bounds).toEqual({ x: 0, y: 0, width: 72, height: 72 })
		expect(view.gridBounds).toEqual({ minRow: 0, maxRow: 1, minColumn: 0, maxColumn: 1 })
	})

	test('lays the controls out at the size the surface draws them', () => {
		const view = resolveSurfaceView(squareLayout, UNROTATED)!

		// A gap between them, and the face is exactly as big as what is on it
		const gap = controlAt(view, 0, 1).bounds.x - 72
		expect(gap).toBeGreaterThan(0)
		expect(view.extent).toEqual({ width: 72 * 2 + gap, height: 72 * 2 + gap })
	})

	test('offsets the buttons it drives onto the grid, without moving the face', () => {
		const view = resolveSurfaceView(squareLayout, { ...UNROTATED, offset: { rows: 3, columns: 5 } })!

		expect(view.gridBounds).toEqual({ minRow: 3, maxRow: 4, minColumn: 5, maxColumn: 6 })
		// Where the surface sits on the grid says nothing about where its controls are on its own face
		expect(controlAt(view, 3, 5).bounds).toEqual({ x: 0, y: 0, width: 72, height: 72 })
	})

	describe('a Stream Deck + shaped surface', () => {
		const placement: SurfaceGridPlacement = {
			offset: { rows: 0, columns: 0 },
			rotation: 0,
			panelGridSize: { rows: 3, columns: 4 },
		}

		test('draws the touch strip at its own shape rather than squeezing it into a key', () => {
			const view = resolveSurfaceView(plusLayout, placement)!

			expect(controlAt(view, 2, 0).bounds.width).toBe(200)
			expect(controlAt(view, 2, 0).bounds.height).toBe(100)
		})

		test('gives the strip row its own height, so the keys above it keep theirs', () => {
			const view = resolveSurfaceView(plusLayout, placement)!

			expect(controlAt(view, 0, 0).bounds.height).toBe(120)
			expect(controlAt(view, 2, 0).bounds.height).toBe(100)
		})

		test('makes the columns wide enough for the widest thing in them', () => {
			const view = resolveSurfaceView(plusLayout, placement)!

			// The strip is wider than a key, so the keys sit in the middle of the room it needs
			const key = controlAt(view, 0, 0)
			const strip = controlAt(view, 2, 0)
			expect(key.bounds.x).toBeCloseTo(strip.bounds.x + (200 - 120) / 2)
		})

		/*
		 * How big a control is taken to be comes from its bitmap, which assumes every control on a surface is
		 * drawn at the same pixel density. A real Stream Deck + is not: its keys are 120x120 across about 20mm
		 * and a strip segment 200x100 across about 25x12mm, so the strip is denser than the keys and comes out
		 * larger here, relative to a key, than it is on the desk.
		 *
		 * Pinned rather than hidden. The shapes and the ordering are right, which is what the view is for; when
		 * a layout can state a size per control this is the test that should change.
		 */
		test('takes a control to be as big as its bitmap, density differences and all', () => {
			const view = resolveSurfaceView(plusLayout, placement)!

			const key = controlAt(view, 0, 0).bounds
			const strip = controlAt(view, 2, 0).bounds

			expect(strip.width / key.width).toBeCloseTo(200 / 120)
			// On the device itself it is nearer 25/20, and shorter than this rather than taller
			expect(strip.height / key.height).toBeCloseTo(100 / 120)
		})

		test('draws the strip with more pixels than a key, in the proportion the surface uses', () => {
			const view = resolveSurfaceView(plusLayout, placement)!

			expect(controlAt(view, 0, 0).renderSize).toEqual({ width: 288, height: 288 })
			expect(controlAt(view, 2, 0).renderSize).toEqual({ width: 480, height: 240 })
		})
	})

	describe('a Stream Deck Studio shaped surface', () => {
		const placement: SurfaceGridPlacement = {
			offset: { rows: 0, columns: 0 },
			rotation: 0,
			panelGridSize: { rows: 2, columns: 4 },
		}

		test('draws the non-square keys at their own shape', () => {
			const view = resolveSurfaceView(studioLayout, placement)!

			expect(controlAt(view, 0, 0).bounds.width).toBe(200)
			expect(controlAt(view, 0, 0).bounds.height).toBe(156)
		})

		test('gives a control with no bitmap a size to be drawn at anyway', () => {
			const view = resolveSurfaceView(studioLayout, placement)!
			const encoder = controlAt(view, 1, 0)

			expect(encoder.aspectRatio).toBeNull()
			expect(encoder.bounds.width).toBeGreaterThan(0)
			expect(encoder.bounds.height).toBeGreaterThan(0)
		})

		test('has nothing at all where the surface has no control', () => {
			const view = resolveSurfaceView(studioLayout, placement)!

			// The gaps between the encoders are not controls, and are not anything else either
			expect(view.controls).toHaveLength(6)
			expect(view.controls.filter((control) => control.cell.row === 1)).toHaveLength(2)
		})

		test('keeps the room the surface leaves between spaced-out controls', () => {
			const view = resolveSurfaceView(studioLayout, placement)!

			// The two encoders are at either end of the row, so they are as far apart as the keys above them
			const left = controlAt(view, 1, 0)
			const right = controlAt(view, 1, 3)
			expect(right.bounds.x - left.bounds.x).toBeCloseTo(
				controlAt(view, 0, 3).bounds.x - controlAt(view, 0, 0).bounds.x
			)
		})
	})

	describe('rotation', () => {
		// A 1x3 strip of keys, so which way it lies says which way it was turned
		const stripLayout: SurfaceSchemaLayoutDefinition = {
			stylePresets: { default: { bitmap: { w: 72, h: 36 } } },
			controls: {
				a: { row: 0, column: 0 },
				b: { row: 0, column: 1 },
				c: { row: 0, column: 2 },
			},
		}
		const panelGridSize = { rows: 1, columns: 3 }

		test('lays an unrotated surface out as the layout describes it', () => {
			const view = resolveSurfaceView(stripLayout, { offset: { rows: 0, columns: 0 }, rotation: 0, panelGridSize })!

			expect(view.gridBounds).toEqual({ minRow: 0, maxRow: 0, minColumn: 0, maxColumn: 2 })
			expect(view.extent.width).toBeGreaterThan(view.extent.height)
		})

		test('turns a quarter-turned surface onto its side, controls and all', () => {
			const view = resolveSurfaceView(stripLayout, {
				offset: { rows: 0, columns: 0 },
				rotation: 'surface90',
				panelGridSize,
			})!

			expect(view.gridBounds).toEqual({ minRow: 0, maxRow: 2, minColumn: 0, maxColumn: 0 })
			// The face is now taller than it is wide, and so is every control on it
			expect(view.extent.height).toBeGreaterThan(view.extent.width)
			expect(controlAt(view, 0, 0).bounds).toMatchObject({ width: 36, height: 72 })
		})

		test('drives the buttons the surface handler would', () => {
			const view = resolveSurfaceView(stripLayout, {
				offset: { rows: 0, columns: 0 },
				rotation: 'surface90',
				panelGridSize,
			})!

			expect(controlAt(view, 0, 0).id).toBe('a')
			expect(controlAt(view, 2, 0).id).toBe('c')
		})

		test('reverses a surface turned upside down', () => {
			const view = resolveSurfaceView(stripLayout, {
				offset: { rows: 0, columns: 0 },
				rotation: 'surface180',
				panelGridSize,
			})!

			expect(controlAt(view, 0, 0).id).toBe('c')
			expect(controlAt(view, 0, 2).id).toBe('a')
		})
	})
})

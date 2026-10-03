import { describe, expect, it } from 'vitest'
import type { ResolvedSurfaceControl, ResolvedSurfaceView } from '@companion-app/shared/SurfaceLayout.js'
import {
	controlAtPoint,
	controlCanvasBox,
	controlsInBox,
	placeSurfaceControls,
	stepToNearestControl,
	surfaceUnitScale,
} from '../surfaceGeometry.js'

function control(id: string, x: number, y: number, width: number, height: number): ResolvedSurfaceControl {
	return {
		id,
		cell: { row: 0, column: 0 },
		bounds: { x, y, width, height },
		shape: { type: 'rect', cornerRadiusRatio: 0.12 },
		feedback: 'bitmap',
		leds: null,
		aspectRatio: null,
		renderSize: { width: 288, height: 288 },
	}
}

function view(...controls: ResolvedSurfaceControl[]): ResolvedSurfaceView {
	return {
		controls,
		extent: { width: 1000, height: 1000 },
		gridBounds: { minRow: 0, maxRow: 0, minColumn: 0, maxColumn: 0 },
		body: null,
	}
}

describe('surfaceUnitScale', () => {
	it('draws the smallest control at about the size of a grid cell', () => {
		const scale = surfaceUnitScale(view(control('a', 0, 0, 120, 120), control('b', 0, 0, 200, 100)), 1)

		expect(120 * scale).toBeCloseTo(72)
	})

	it('scales with the zoom level', () => {
		const single = view(control('a', 0, 0, 120, 120))

		expect(surfaceUnitScale(single, 2)).toBeCloseTo(surfaceUnitScale(single, 1) * 2)
	})

	it('keeps a large control large, in the proportion the surface uses', () => {
		const scale = surfaceUnitScale(view(control('a', 0, 0, 120, 120), control('b', 0, 0, 200, 100)), 1)

		// The strip is drawn wider than a key, as the device draws it
		expect(200 * scale).toBeCloseTo(120)
	})

	it('sizes by the keys, not a small control which shows no bitmap', () => {
		// A key, and a thin touch strip which only lights up
		const strip = { ...control('strip', 0, 0, 96, 16), feedback: 'color' as const }
		const scale = surfaceUnitScale(view(control('key', 0, 0, 96, 96), strip), 1)

		expect(96 * scale).toBeCloseTo(72)
	})

	it('draws the narrowest control a cell across when nothing shows a bitmap', () => {
		// A pedal: tall treads, the side ones narrower than the middle
		const tread = (id: string, width: number) => ({ ...control(id, 0, 0, width, 272), feedback: 'none' as const })
		const scale = surfaceUnitScale(view(tread('left', 83), tread('middle', 280), tread('right', 83)), 1)

		expect(83 * scale).toBeCloseTo(72)
	})
})

describe('controlAtPoint', () => {
	// Two controls of different sizes, side by side, as a surface with a strip under a key would be
	const surface = view(control('key', 0, 0, 100, 100), control('strip', 120, 20, 200, 60))

	it('finds the control a point is inside', () => {
		expect(controlAtPoint(placeSurfaceControls(surface, 1), 50, 50)?.id).toBe('key')
		expect(controlAtPoint(placeSurfaceControls(surface, 1), 200, 40)?.id).toBe('strip')
	})

	it('finds nothing on the bare face between the controls', () => {
		// Between them horizontally, and above the strip
		expect(controlAtPoint(placeSurfaceControls(surface, 1), 110, 50)).toBeNull()
		expect(controlAtPoint(placeSurfaceControls(surface, 1), 200, 5)).toBeNull()
	})

	it('measures in canvas pixels, so it follows the zoom', () => {
		expect(controlAtPoint(placeSurfaceControls(surface, 2), 100, 100)?.id).toBe('key')
		expect(controlAtPoint(placeSurfaceControls(surface, 2), 100, 300)).toBeNull()
	})
})

describe('placeSurfaceControls', () => {
	function placedById(surface: ResolvedSurfaceView, unitScale: number) {
		return new Map(placeSurfaceControls(surface, unitScale).map((entry) => [entry.control.id, entry]))
	}

	it('picks a control large enough to hit by exactly what it draws', () => {
		const placed = placedById(view(control('key', 100, 100, 72, 72)), 1)

		expect(placed.get('key')?.hit).toEqual(placed.get('key')?.box)
	})

	it('grows a thin control to something which can be hit, around its middle', () => {
		// A Neo touch strip: as wide as a key, but only a few pixels tall
		const placed = placedById(view(control('strip', 100, 100, 96, 10)), 1)

		expect(placed.get('strip')?.box).toEqual({ left: 100, top: 100, width: 96, height: 10 })
		expect(placed.get('strip')?.hit).toEqual({ left: 100, top: 89, width: 96, height: 32 })
	})

	it('grows in canvas pixels, so it needs less help zoomed in', () => {
		const placed = placedById(view(control('strip', 100, 100, 96, 10)), 4)

		expect(placed.get('strip')?.hit).toEqual(placed.get('strip')?.box)
	})

	it('shares the gap with a neighbour rather than reaching into it', () => {
		// A strip just under a key, closer than the strip would like to grow
		const placed = placedById(view(control('key', 0, 0, 96, 96), control('strip', 0, 100, 96, 10)), 1)

		expect(placed.get('key')?.hit).toEqual(placed.get('key')?.box)
		expect(placed.get('strip')?.hit).toEqual({ left: 0, top: 98, width: 96, height: 23 })
	})

	it('never lets two thin controls overlap, however close they are', () => {
		const surface = view(control('a', 0, 100, 96, 10), control('b', 0, 114, 96, 10))
		const placed = placedById(surface, 1)
		const a = placed.get('a')!.hit
		const b = placed.get('b')!.hit

		expect(a.top + a.height).toBe(112)
		expect(b.top).toBe(112)
	})

	it('divides along the axis the controls are furthest apart on, when they sit diagonally', () => {
		const surface = view(control('a', 0, 0, 10, 10), control('b', 30, 14, 10, 10))
		const placed = placedById(surface, 1)

		expect(placed.get('a')!.hit.left + placed.get('a')!.hit.width).toBe(20)
		expect(placed.get('b')!.hit.left).toBe(20)
	})

	it('keeps a hit area on the canvas', () => {
		const surface = { ...view(control('strip', 0, 0, 96, 10)), extent: { width: 96, height: 10 } }

		expect(placedById(surface, 1).get('strip')?.hit).toEqual({ left: 0, top: 0, width: 96, height: 10 })
	})

	it('picks a thin control from just beside it', () => {
		const placed = placeSurfaceControls(view(control('strip', 100, 100, 96, 10)), 1)

		expect(controlAtPoint(placed, 140, 92)?.id).toBe('strip')
		expect(controlAtPoint(placed, 140, 80)).toBeNull()
	})

	it('selects by what is drawn when dragging out a box, not by the hit area', () => {
		const placed = placeSurfaceControls(view(control('strip', 100, 100, 96, 10)), 1)

		expect(controlsInBox(placed, { left: 90, top: 90, width: 50, height: 5 })).toEqual([])
	})
})

describe('controlsInBox', () => {
	const surface = view(control('a', 0, 0, 100, 100), control('b', 120, 0, 100, 100), control('c', 0, 120, 100, 100))

	it('takes everything the box touches, not only what it encloses', () => {
		// Clips the right-hand edge of a and the left of b
		const touched = controlsInBox(placeSurfaceControls(surface, 1), { left: 90, top: 10, width: 40, height: 20 })

		expect(touched.map((control) => control.id)).toEqual(['a', 'b'])
	})

	it('takes nothing when the box is on the bare face', () => {
		expect(controlsInBox(placeSurfaceControls(surface, 1), { left: 105, top: 105, width: 10, height: 10 })).toEqual([])
	})

	it('is not a rectangle of cells - a box down one side takes only that side', () => {
		const touched = controlsInBox(placeSurfaceControls(surface, 1), { left: 0, top: 0, width: 100, height: 300 })

		expect(touched.map((control) => control.id)).toEqual(['a', 'c'])
	})
})

describe('stepToNearestControl', () => {
	it('steps to the control that way, however far away it is', () => {
		// Two encoders at either end of a row, with nothing in between - there is no next column to step to
		const surface = view(control('left', 0, 0, 60, 60), control('right', 600, 0, 60, 60))

		expect(stepToNearestControl(surface, surface.controls[0], 0, 1)?.id).toBe('right')
	})

	it('goes nowhere when there is nothing that way', () => {
		const surface = view(control('left', 0, 0, 60, 60), control('right', 600, 0, 60, 60))

		expect(stepToNearestControl(surface, surface.controls[1], 0, 1)).toBeNull()
	})

	it('prefers what is straight ahead over what is nearer but off to one side', () => {
		const surface = view(
			control('from', 0, 0, 60, 60),
			control('ahead', 200, 0, 60, 60),
			control('askew', 100, 300, 60, 60)
		)

		expect(stepToNearestControl(surface, surface.controls[0], 0, 1)?.id).toBe('ahead')
	})

	it('steps down to a control of a different size, as a key does onto a strip', () => {
		const surface = view(control('key', 0, 0, 120, 120), control('strip', 0, 140, 240, 60))

		expect(stepToNearestControl(surface, surface.controls[0], 1, 0)?.id).toBe('strip')
	})
})

describe('controlCanvasBox', () => {
	it('places and sizes a control in canvas pixels', () => {
		expect(controlCanvasBox(control('a', 10, 20, 100, 50), 2)).toEqual({
			left: 20,
			top: 40,
			width: 200,
			height: 100,
		})
	})
})

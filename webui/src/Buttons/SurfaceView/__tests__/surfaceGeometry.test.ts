import { describe, expect, it } from 'vitest'
import type { ResolvedSurfaceControl, ResolvedSurfaceView } from '@companion-app/shared/SurfaceLayout.js'
import {
	controlAtPoint,
	controlCanvasBox,
	controlsInBox,
	stepToNearestControl,
	surfaceUnitScale,
} from '../surfaceGeometry.js'

function control(id: string, x: number, y: number, width: number, height: number): ResolvedSurfaceControl {
	return {
		id,
		cell: { row: 0, column: 0 },
		bounds: { x, y, width, height },
		shape: { type: 'rect', cornerRadiusRatio: 0.12 },
		aspectRatio: null,
		renderSize: { width: 288, height: 288 },
	}
}

function view(...controls: ResolvedSurfaceControl[]): ResolvedSurfaceView {
	return {
		controls,
		extent: { width: 1000, height: 1000 },
		gridBounds: { minRow: 0, maxRow: 0, minColumn: 0, maxColumn: 0 },
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
})

describe('controlAtPoint', () => {
	// Two controls of different sizes, side by side, as a surface with a strip under a key would be
	const surface = view(control('key', 0, 0, 100, 100), control('strip', 120, 20, 200, 60))

	it('finds the control a point is inside', () => {
		expect(controlAtPoint(surface, 1, 50, 50)?.id).toBe('key')
		expect(controlAtPoint(surface, 1, 200, 40)?.id).toBe('strip')
	})

	it('finds nothing on the bare face between the controls', () => {
		// Between them horizontally, and above the strip
		expect(controlAtPoint(surface, 1, 110, 50)).toBeNull()
		expect(controlAtPoint(surface, 1, 200, 5)).toBeNull()
	})

	it('measures in canvas pixels, so it follows the zoom', () => {
		expect(controlAtPoint(surface, 2, 100, 100)?.id).toBe('key')
		expect(controlAtPoint(surface, 2, 100, 300)).toBeNull()
	})
})

describe('controlsInBox', () => {
	const surface = view(control('a', 0, 0, 100, 100), control('b', 120, 0, 100, 100), control('c', 0, 120, 100, 100))

	it('takes everything the box touches, not only what it encloses', () => {
		// Clips the right-hand edge of a and the left of b
		const touched = controlsInBox(surface, 1, { left: 90, top: 10, width: 40, height: 20 })

		expect(touched.map((control) => control.id)).toEqual(['a', 'b'])
	})

	it('takes nothing when the box is on the bare face', () => {
		expect(controlsInBox(surface, 1, { left: 105, top: 105, width: 10, height: 10 })).toEqual([])
	})

	it('is not a rectangle of cells - a box down one side takes only that side', () => {
		const touched = controlsInBox(surface, 1, { left: 0, top: 0, width: 100, height: 300 })

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

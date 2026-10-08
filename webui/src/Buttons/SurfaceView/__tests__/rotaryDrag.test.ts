import { describe, expect, it } from 'vitest'
import { continueRotaryDrag, ROTARY_STEP_DEGREES, startRotaryDrag, type Point, type RotaryDrag } from '../rotaryDrag.js'

const centre: Point = { x: 100, y: 100 }

/** A point on a circle round the centre, at an angle clockwise from pointing right */
function at(degrees: number, radius = 50): Point {
	const radians = (degrees * Math.PI) / 180
	return { x: centre.x + Math.cos(radians) * radius, y: centre.y + Math.sin(radians) * radius }
}

/** Drag through each angle in turn, adding up the steps */
function dragThrough(drag: RotaryDrag, angles: number[]): { drag: RotaryDrag; steps: number } {
	let steps = 0
	for (const angle of angles) {
		const result = continueRotaryDrag(drag, at(angle))
		drag = result.drag
		steps += result.steps
	}
	return { drag, steps }
}

describe('rotary drag', () => {
	it('turns right for a drag going clockwise', () => {
		const { steps } = dragThrough(startRotaryDrag(centre, at(0)), [ROTARY_STEP_DEGREES * 2 + 1])

		expect(steps).toBe(2)
	})

	it('turns left for a drag going anticlockwise', () => {
		const { steps } = dragThrough(startRotaryDrag(centre, at(0)), [-ROTARY_STEP_DEGREES * 3 - 1])

		expect(steps).toBe(-3)
	})

	it('adds up slow turning until it makes a whole step', () => {
		const third = ROTARY_STEP_DEGREES / 3
		const start = startRotaryDrag(centre, at(0))

		expect(continueRotaryDrag(start, at(third)).steps).toBe(0)
		// A touch past the step, so rounding in the angles cannot leave it just short
		expect(dragThrough(start, [third, third * 2, third * 3 + 0.1]).steps).toBe(1)
	})

	it('goes the short way round where the angle wraps', () => {
		// From just short of pointing left, past it, clockwise
		const { steps } = dragThrough(startRotaryDrag(centre, at(170)), [190])

		expect(steps).toBe(1)
	})

	it('counts a whole turn as a whole turn', () => {
		// A touch past a whole turn, so rounding in the angles cannot leave it just short
		const angles = [...Array.from({ length: 36 }, (_, index) => (index + 1) * 10), 361]
		const { steps } = dragThrough(startRotaryDrag(centre, at(0)), angles)

		expect(steps).toBe(360 / ROTARY_STEP_DEGREES)
	})

	it('ignores passing over the middle, where which way it points means nothing', () => {
		const start = startRotaryDrag(centre, at(0))
		const overMiddle = continueRotaryDrag(start, { x: centre.x + 1, y: centre.y + 1 })

		expect(overMiddle.steps).toBe(0)
		// Coming out of the middle on the far side is a fresh start, not half a turn
		expect(continueRotaryDrag(overMiddle.drag, at(180)).steps).toBe(0)
	})
})

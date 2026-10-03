import { describe, expect, it } from 'vitest'
import type { LedGaugeDescription } from '@companion-app/shared/Graphics/GaugeLeds.js'
import { layoutLeds, type LedLayout } from '../ledLayout.js'

/** A gauge lighting all of its track in one colour */
function solid(color: number, isRing: boolean): LedGaugeDescription {
	return { isRing, startAngle: 0, endAngle: 360, reverse: false, arcs: [{ start: 0, end: 100, color }] }
}

function ring(layout: LedLayout) {
	if (layout.type !== 'ring') throw new Error('not a ring')
	return layout
}

/** Where an arc path starts, as [x, y] */
function arcStart(path: string): [number, number] {
	const [, x, y] = path.split(' ')
	return [Number(x), Number(y)]
}

describe('layoutLeds', () => {
	describe('a full ring', () => {
		it('goes around the outside of the control, not over it', () => {
			const layout = ring(layoutLeds({ segments: 24, mode: 'full-ring' }, null))

			// The control is 0-100, so its edge is at 50 from the centre
			expect(layout.radius - layout.width / 2).toBeGreaterThan(50)
		})

		it('starts at six o’clock and runs clockwise, as the panel numbers its leds', () => {
			const { segments } = ring(layoutLeds({ segments: 4, mode: 'full-ring' }, null))

			// The first arc starts a little clockwise of the bottom-right diagonal, heading for the bottom-left
			const [firstX, firstY] = arcStart(segments[0].path)
			expect(firstX).toBeGreaterThan(50)
			expect(firstY).toBeGreaterThan(50)

			// The second is on the left
			const [secondX] = arcStart(segments[1].path)
			expect(secondX).toBeLessThan(50)
		})

		it('lights each led the colour the surface would be sent', () => {
			const { segments } = ring(layoutLeds({ segments: 24, mode: 'full-ring' }, solid(0xff0000, true)))

			expect(segments).toHaveLength(24)
			expect(segments.every((segment) => segment.color === 'rgb(255, 0, 0)')).toBe(true)
		})

		it('leaves every led off when the button drives none', () => {
			const { segments } = ring(layoutLeds({ segments: 24, mode: 'full-ring' }, null))

			expect(segments.every((segment) => segment.color === null)).toBe(true)
		})

		it('treats a black led as off', () => {
			const { segments } = ring(layoutLeds({ segments: 8, mode: 'full-ring' }, solid(0x000000, true)))

			expect(segments.every((segment) => segment.color === null)).toBe(true)
		})
	})

	describe('a simple strip', () => {
		it('runs the leds left to right, nearly touching', () => {
			const layout = layoutLeds({ segments: 4, mode: 'simple' }, solid(0x00ff00, false))
			if (layout.type !== 'strip') throw new Error('not a strip')

			expect(layout.segments.map((segment) => segment.x)).toEqual([0.5, 25.5, 50.5, 75.5])
			expect(layout.segments[0].width).toBe(24)
			expect(layout.segments.every((segment) => segment.color === 'rgb(0, 255, 0)')).toBe(true)
		})
	})
})

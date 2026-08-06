import { describe, expect, test } from 'vitest'
import { fitCanvasSize, parseAspectRatio } from '../canvasSize.js'

// The canvas adds 10px of padding on each side, so a container loses 20px per axis
const PAD = 20

describe('parseAspectRatio', () => {
	test('parses a "w:h" pair into a ratio', () => {
		expect(parseAspectRatio('2:1')).toBe(2)
		expect(parseAspectRatio('9:7')).toBeCloseTo(9 / 7)
		expect(parseAspectRatio('1:1')).toBe(1)
	})

	test('falls back to square for anything malformed', () => {
		for (const input of ['', 'abc', '1', '1:0', '0:1', '-2:1', '1:x']) {
			expect(parseAspectRatio(input)).toBe(1)
		}
	})
})

describe('fitCanvasSize', () => {
	test('fills the limiting axis when the container is wider than the ratio needs', () => {
		// 1:1 in a 500x200 box is height-limited
		expect(fitCanvasSize('1:1', 500, 200 + PAD)).toEqual({ width: 200, height: 200 })
	})

	test('fills the limiting axis when the container is taller than the ratio needs', () => {
		// 1:1 in a 150x500 box is width-limited
		expect(fitCanvasSize('1:1', 150 + PAD, 500)).toEqual({ width: 150, height: 150 })
	})

	test('honours a non-square ratio', () => {
		const { width, height } = fitCanvasSize('2:1', 300 + PAD, 500)

		expect(width / height).toBeCloseTo(2)
		expect(width).toBe(300)
	})

	test('never exceeds either container axis', () => {
		for (const ratio of ['1:1', '2:1', '9:7']) {
			const { width, height } = fitCanvasSize(ratio, 300, 180)

			expect(width + PAD).toBeLessThanOrEqual(300)
			expect(height + PAD).toBeLessThanOrEqual(180)
		}
	})

	test('falls back to a usable size before the container has been measured', () => {
		const { width, height } = fitCanvasSize('1:1', 0, 0)

		expect(width).toBeGreaterThan(0)
		expect(height).toBeGreaterThan(0)
	})

	test('does not grow without bound on a very large container', () => {
		const { width, height } = fitCanvasSize('1:1', 5000, 5000)

		expect(Math.max(width, height)).toBeLessThanOrEqual(360)
	})

	test('keeps the aspect ratio when capped by the maximum size', () => {
		const { width, height } = fitCanvasSize('2:1', 5000, 5000)

		expect(width / height).toBeCloseTo(2)
	})
})

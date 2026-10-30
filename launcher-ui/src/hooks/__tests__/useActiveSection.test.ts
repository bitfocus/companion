import { describe, expect, test } from 'vitest'
import { pickActiveSection, scrollWouldMove } from '../useActiveSection.js'

const SECTIONS = [
	{ id: 'general', top: -400 },
	{ id: 'syslog', top: -50 },
	{ id: 'developer', top: 300 },
	{ id: 'dangerous', top: 700 },
]

describe('pickActiveSection', () => {
	test('is the last section whose top has passed the offset', () => {
		expect(pickActiveSection(SECTIONS, 96, false)).toBe('syslog')
	})

	test('counts a section that has just reached the offset', () => {
		expect(
			pickActiveSection(
				[
					{ id: 'general', top: -400 },
					{ id: 'syslog', top: 96 },
				],
				96,
				false
			)
		).toBe('syslog')
	})

	test('is the first section before any has scrolled up', () => {
		expect(
			pickActiveSection(
				SECTIONS.map((s, i) => ({ ...s, top: 200 + i * 300 })),
				96,
				false
			)
		).toBe('general')
	})

	test('is the last section once scrolled to the bottom, even if it never reaches the top', () => {
		expect(pickActiveSection(SECTIONS, 96, true)).toBe('dangerous')
	})

	test('is nothing when there are no sections', () => {
		expect(pickActiveSection([], 96, false)).toBeNull()
	})
})

describe('scrollWouldMove', () => {
	test('moves to a section further down', () => {
		expect(scrollWouldMove(0, 400, 1000)).toBe(true)
	})

	test('does not move for a section already at its scroll position', () => {
		expect(scrollWouldMove(300, 0, 1000)).toBe(false)
		expect(scrollWouldMove(300, 0.4, 1000)).toBe(false)
	})

	test('does not move once the page cannot scroll any further down', () => {
		expect(scrollWouldMove(540, 200, 540)).toBe(false)
	})

	test('does not move once the page cannot scroll any further up', () => {
		expect(scrollWouldMove(0, -50, 540)).toBe(false)
	})

	test('moves as far as it can towards a section below the end of the page', () => {
		expect(scrollWouldMove(400, 300, 540)).toBe(true)
	})

	test('does not move when the page does not scroll at all', () => {
		expect(scrollWouldMove(0, 300, -200)).toBe(false)
	})
})

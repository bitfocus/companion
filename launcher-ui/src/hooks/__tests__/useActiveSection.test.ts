import { describe, expect, test } from 'vitest'
import { pickActiveSection } from '../useActiveSection.js'

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

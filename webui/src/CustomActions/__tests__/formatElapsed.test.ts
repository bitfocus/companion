import { describe, expect, test } from 'vitest'
import { formatElapsed } from '../formatElapsed.js'

describe('formatElapsed', () => {
	test.each([
		[0, '0s'],
		[999, '0s'],
		[45_000, '45s'],
		[185_000, '3m 05s'],
		[3_720_000, '1h 02m'],
		[-5, '0s'],
	])('%d ms is %s', (ms, expected) => {
		expect(formatElapsed(ms)).toBe(expected)
	})
})

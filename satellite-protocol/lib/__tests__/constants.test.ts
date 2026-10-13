import { describe, expect, test } from 'vitest'
import {
	API_VERSION,
	MAX_KEYS_PER_ROW,
	MAX_KEYS_TOTAL,
	MAX_LINE_LENGTH,
	SATELLITE_BITMAP_FORMATS,
} from '../constants.js'
import { parseApiVersion } from '../versions.js'

describe('constants', () => {
	test('API_VERSION is a valid version', () => {
		expect(parseApiVersion(API_VERSION)).not.toBeNull()
	})

	test('rgb is always a bitmap format, as the fallback for surfaces without a decoder', () => {
		expect(SATELLITE_BITMAP_FORMATS).toContain('rgb')
		expect(new Set(SATELLITE_BITMAP_FORMATS).size).toBe(SATELLITE_BITMAP_FORMATS.length)
	})

	test('the limits are consistent', () => {
		expect(MAX_KEYS_PER_ROW).toBeLessThanOrEqual(MAX_KEYS_TOTAL)
		expect(MAX_LINE_LENGTH).toBeGreaterThan(0)
	})
})

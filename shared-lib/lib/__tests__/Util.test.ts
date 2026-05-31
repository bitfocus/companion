import { describe, expect, test } from 'vitest'
import { pad } from '../Util.js'

// ── pad ───────────────────────────────────────────────────────────────────────

describe('pad', () => {
	test('pads a single-digit number with leading character', () => {
		expect(pad(5, '0', 2)).toBe('05')
	})

	test('pads a string shorter than the target length', () => {
		expect(pad('7', '0', 3)).toBe('007')
	})

	test('returns value unchanged when already at target length', () => {
		expect(pad(42, '0', 2)).toBe('42')
	})

	test('returns value unchanged when longer than target length', () => {
		expect(pad(1234, '0', 2)).toBe('1234')
	})

	test('pads with a non-zero character', () => {
		expect(pad('hi', ' ', 5)).toBe('   hi')
	})
})

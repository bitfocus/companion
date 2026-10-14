import { describe, expect, test } from 'vitest'
import { parseThemePreference, resolveTheme } from '../resolveTheme.js'

describe('parseThemePreference', () => {
	test.each([
		['light', 'light'],
		['dark', 'dark'],
		['system', 'system'],
		[null, 'system'],
		['purple', 'system'],
	] as const)('%s reads as %s', (raw, preference) => {
		expect(parseThemePreference(raw)).toBe(preference)
	})
})

describe('resolveTheme', () => {
	test('an explicit choice wins over the system', () => {
		expect(resolveTheme('light', true)).toBe('light')
		expect(resolveTheme('dark', false)).toBe('dark')
	})

	test('system follows the system', () => {
		expect(resolveTheme('system', true)).toBe('dark')
		expect(resolveTheme('system', false)).toBe('light')
	})
})

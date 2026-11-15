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
		expect(resolveTheme('light', true, null)).toBe('light')
		expect(resolveTheme('dark', false, null)).toBe('dark')
	})

	test('system follows the system', () => {
		expect(resolveTheme('system', true, null)).toBe('dark')
		expect(resolveTheme('system', false, null)).toBe('light')
	})

	test('a forced theme wins over everything', () => {
		expect(resolveTheme('light', false, 'dark')).toBe('dark')
		expect(resolveTheme('system', false, 'dark')).toBe('dark')
		expect(resolveTheme('dark', true, 'light')).toBe('light')
	})
})

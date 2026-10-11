import { describe, expect, test } from 'vitest'
import { stringifyLogValue } from '../../lib/Log/Controller.js'

describe('stringifyLogValue', () => {
	test('strings are unchanged', () => {
		expect(stringifyLogValue('abc')).toBe('abc')
	})

	test('undefined and null', () => {
		expect(stringifyLogValue(undefined)).toBe('')
		expect(stringifyLogValue(null)).toBe('')
	})

	test('numbers and objects', () => {
		expect(stringifyLogValue(42)).toBe('42')
		expect(stringifyLogValue({ a: 1 })).toBe('{"a":1}')
	})

	test('unserializable objects', () => {
		const cyclic: Record<string, unknown> = {}
		cyclic.self = cyclic
		expect(stringifyLogValue(cyclic)).toBe('[object Object]')
		expect(stringifyLogValue(10n)).toBe('10')
	})
})

import { describe, expect, test } from 'vitest'
import { isLabelValid, makeLabelSafe } from '../Label.js'

describe('isLabelValid', () => {
	test('accepts simple labels', () => {
		expect(isLabelValid('atem')).toBe(true)
		expect(isLabelValid('my-label_2')).toBe(true)
	})

	test('rejects empty and unsafe labels', () => {
		expect(isLabelValid('')).toBe(false)
		expect(isLabelValid('my label')).toBe(false)
		expect(isLabelValid('a:b')).toBe(false)
	})

	test('rejects reserved words, in any case', () => {
		for (const word of ['internal', 'this', 'local', 'companion', 'image', 'custom', 'expression', 'page', 'options']) {
			expect(isLabelValid(word), word).toBe(false)
			expect(isLabelValid(word.toUpperCase()), word).toBe(false)
		}
	})
})

describe('makeLabelSafe', () => {
	test('replaces unsafe characters', () => {
		expect(makeLabelSafe(' my label:1 ')).toBe('my_label_1')
	})
})

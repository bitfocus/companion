import { describe, expect, it } from 'vitest'
import {
	isDropdownChoiceId,
	optionValueAsChoiceId,
	optionValueAsChoiceIds,
	optionValueAsColor,
	optionValueAsNumber,
	optionValueAsString,
	optionValueAsStringOrNull,
	optionValueAsStrings,
} from '../OptionFieldValues.js'

describe('OptionFieldValues', () => {
	it('shows any value as a string, and nothing as empty', () => {
		expect(optionValueAsString('abc')).toBe('abc')
		expect(optionValueAsString(5)).toBe('5')
		expect(optionValueAsString(true)).toBe('true')
		expect(optionValueAsString(undefined)).toBe('')
		expect(optionValueAsString(null)).toBe('')
	})

	it('keeps only a string where one is needed or nothing', () => {
		expect(optionValueAsStringOrNull('12:00')).toBe('12:00')
		expect(optionValueAsStringOrNull(1200)).toBeNull()
		expect(optionValueAsStringOrNull(undefined)).toBeNull()
	})

	it('keeps the strings of a list', () => {
		expect(optionValueAsStrings(['bold', 5, 'italic', null])).toEqual(['bold', 'italic'])
		expect(optionValueAsStrings('bold')).toEqual([])
		expect(optionValueAsStrings(undefined)).toEqual([])
	})

	it('treats strings and numbers as choice ids', () => {
		expect(isDropdownChoiceId('a')).toBe(true)
		expect(isDropdownChoiceId(1)).toBe(true)
		expect(isDropdownChoiceId(true)).toBe(false)
		expect(isDropdownChoiceId(null)).toBe(false)
		expect(isDropdownChoiceId(['a'])).toBe(false)
	})

	it('shows a choice id, or no choice', () => {
		expect(optionValueAsChoiceId('a')).toBe('a')
		expect(optionValueAsChoiceId(2)).toBe(2)
		expect(optionValueAsChoiceId({ a: 1 })).toBe('')
		expect(optionValueAsChoiceId(undefined)).toBe('')
	})

	it('keeps the choice ids of a list', () => {
		expect(optionValueAsChoiceIds(['a', 2, false, { b: 1 }])).toEqual(['a', 2])
		expect(optionValueAsChoiceIds('a')).toEqual([])
	})

	it('keeps a number, or no number', () => {
		expect(optionValueAsNumber(3)).toBe(3)
		expect(optionValueAsNumber('3')).toBeNull()
		expect(optionValueAsNumber(undefined)).toBeNull()
	})

	it('keeps a colour as a number or a string, else black', () => {
		expect(optionValueAsColor(0xff0000)).toBe(0xff0000)
		expect(optionValueAsColor('#ff0000')).toBe('#ff0000')
		expect(optionValueAsColor(undefined)).toBe(0)
		expect(optionValueAsColor(true)).toBe(0)
	})
})

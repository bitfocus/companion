import { describe, expect, it } from 'vitest'
import { fuzzyMatch } from '../fuzzyMatch.js'

describe('fuzzyMatch', () => {
	it('matches everything for an empty query', () => {
		expect(fuzzyMatch('', 'abc')).toBe(true)
		expect(fuzzyMatch('')).toBe(true)
	})

	it('matches nothing without targets', () => {
		expect(fuzzyMatch('abc')).toBe(false)
		expect(fuzzyMatch('abc', undefined, '', [])).toBe(false)
	})

	it('matches a string target', () => {
		expect(fuzzyMatch('program', 'Set Program Input')).toBe(true)
		expect(fuzzyMatch('PROGRAM', 'Set Program Input')).toBe(true)
		expect(fuzzyMatch('zzz', 'Set Program Input')).toBe(false)
	})

	it('matches any of several targets', () => {
		expect(fuzzyMatch('mixer', 'Cut', undefined, 'video mixer')).toBe(true)
		expect(fuzzyMatch('mixer', 'Cut', undefined, 'switcher')).toBe(false)
	})

	it('matches any item of an array target', () => {
		expect(fuzzyMatch('tally', ['camera', 'tally light'])).toBe(true)
		expect(fuzzyMatch('tally', ['camera', 'lights'])).toBe(false)
	})

	it('rejects weak matches', () => {
		// scattered letters score below the threshold
		expect(fuzzyMatch('stpin', 'Set Program Input')).toBe(false)
		expect(fuzzyMatch('setprog', 'Set Program Input')).toBe(true)
	})

	it('ignores diacritics', () => {
		expect(fuzzyMatch('cafe', 'Café')).toBe(true)
	})
})

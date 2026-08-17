import { describe, expect, test } from 'vitest'
import {
	findColorsInLine,
	formatColorPresentations,
	stringSpansFromLineTokens,
	type LineTokensLike,
	type TextSpan,
} from '../Expression.colors.js'

const OTHER = 0
const COMMENT = 1
const STRING = 2

/** Build a fake Monaco `LineTokens` from `[text, standardTokenType]` pairs */
function makeLineTokens(parts: Array<[string, number]>): LineTokensLike {
	const offsets: TextSpan[] = []
	let offset = 0
	for (const [text] of parts) {
		offsets.push({ start: offset, end: offset + text.length })
		offset += text.length
	}

	return {
		getCount: () => parts.length,
		getStandardTokenType: (i) => parts[i][1],
		getStartOffset: (i) => offsets[i].start,
		getEndOffset: (i) => offsets[i].end,
	}
}

/** Tokenize `line` as the monarch grammar would for the purposes of these tests */
function spansForLine(parts: Array<[string, number]>): TextSpan[] {
	return stringSpansFromLineTokens(makeLineTokens(parts))
}

describe('stringSpansFromLineTokens', () => {
	test('no strings', () => {
		expect(spansForLine([['1 + 2', OTHER]])).toEqual([])
	})

	test('single string', () => {
		expect(
			spansForLine([
				['a + ', OTHER],
				[`'#ff0000'`, STRING],
			])
		).toEqual([{ start: 4, end: 13 }])
	})

	test('touching string tokens are merged', () => {
		expect(
			spansForLine([
				[`'a`, STRING],
				['\\n', STRING], // string.escape is also a string token
				[`#fff'`, STRING],
			])
		).toEqual([{ start: 0, end: 9 }])
	})

	test('separate strings are not merged', () => {
		expect(
			spansForLine([
				[`'a'`, STRING],
				[' + ', OTHER],
				[`'b'`, STRING],
			])
		).toEqual([
			{ start: 0, end: 3 },
			{ start: 6, end: 9 },
		])
	})

	test('comments are not strings', () => {
		expect(spansForLine([['// #ff0000', COMMENT]])).toEqual([])
	})
})

describe('findColorsInLine', () => {
	test('no strings on the line', () => {
		expect(findColorsInLine('#ff0000', [])).toEqual([])
	})

	test('hex inside a string', () => {
		const line = `'#ff0000'`
		const colors = findColorsInLine(line, [{ start: 0, end: line.length }])

		expect(colors).toHaveLength(1)
		expect(line.substring(colors[0].start, colors[0].end)).toBe('#ff0000')
		expect(colors[0].color).toEqual({ red: 1, green: 0, blue: 0, alpha: 1 })
	})

	test('hex outside a string is ignored', () => {
		// eg a comment, which is never rewritable without breaking the expression
		const line = `'red' // #ff0000`
		expect(findColorsInLine(line, [{ start: 0, end: 5 }])).toEqual([])
	})

	test('a colour must be wholly inside the string', () => {
		// A string which ends part way through something colour shaped
		const line = `'#ff' + '0000'`
		expect(findColorsInLine(line, [{ start: 0, end: 5 }])).toEqual([])
	})

	test('function call outside a string is ignored', () => {
		const line = `'' + rgb(255, 0, 0)`
		expect(findColorsInLine(line, [{ start: 0, end: 2 }])).toEqual([])
	})

	test('css function inside a string', () => {
		const line = `'rgb(255, 0, 0)'`
		const colors = findColorsInLine(line, [{ start: 0, end: line.length }])

		expect(colors).toHaveLength(1)
		expect(line.substring(colors[0].start, colors[0].end)).toBe('rgb(255, 0, 0)')
		expect(colors[0].color).toEqual({ red: 1, green: 0, blue: 0, alpha: 1 })
	})

	test('multiple colours in multiple strings', () => {
		const line = `'#fff' + '#000'`
		const colors = findColorsInLine(line, [
			{ start: 0, end: 6 },
			{ start: 9, end: 15 },
		])

		expect(colors.map((c) => line.substring(c.start, c.end))).toEqual(['#fff', '#000'])
	})

	test('shorthand hex', () => {
		const line = `'#0f0'`
		const colors = findColorsInLine(line, [{ start: 0, end: line.length }])

		expect(colors).toHaveLength(1)
		expect(colors[0].color).toEqual({ red: 0, green: 1, blue: 0, alpha: 1 })
	})

	test('hex with alpha', () => {
		const line = `'#ff000080'`
		const colors = findColorsInLine(line, [{ start: 0, end: line.length }])

		expect(colors).toHaveLength(1)
		expect(line.substring(colors[0].start, colors[0].end)).toBe('#ff000080')
		expect(colors[0].color.alpha).toBeCloseTo(0.5, 1)
	})

	test('too many hex digits is not a colour', () => {
		const line = `'#ff00001'`
		expect(findColorsInLine(line, [{ start: 0, end: line.length }])).toEqual([])
	})

	test('identifier ending in rgb is not a colour', () => {
		const line = `'myrgb(255, 0, 0)'`
		expect(findColorsInLine(line, [{ start: 0, end: line.length }])).toEqual([])
	})

	test('unparsable candidate is ignored', () => {
		const line = `'rgb(300, 0)'`
		expect(findColorsInLine(line, [{ start: 0, end: line.length }])).toEqual([])
	})
})

describe('formatColorPresentations', () => {
	test('hex is offered first', () => {
		expect(formatColorPresentations({ red: 1, green: 0, blue: 0, alpha: 1 })).toEqual([
			'#ff0000',
			'rgb(255, 0, 0)',
			'hsl(0, 100%, 50%)',
		])
	})

	test('alpha is preserved', () => {
		const [hex] = formatColorPresentations({ red: 1, green: 0, blue: 0, alpha: 0.5 })
		expect(hex).toBe('#ff000080')
	})

	test('round trips through findColorsInLine', () => {
		const line = `'#12ab34'`
		const [color] = findColorsInLine(line, [{ start: 0, end: line.length }])

		expect(formatColorPresentations(color.color)[0]).toBe('#12ab34')
	})
})

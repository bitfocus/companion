import { describe, expect, test, vi } from 'vitest'
import type { CompanionImageContext2D } from '../../Graphics/ImageBase.js'
import {
	computeTextLayout,
	findBestFontSize,
	resolveFontSizeBounds,
	segmentTextToUnicodeChars,
	type TextLayoutResult,
} from '../../Graphics/TextParser.js'

// Mock context that simulates measuring text with roughly 10px per character for simplicity
function createMockContext(charWidth: number = 10, lineHeight: number = 14): CompanionImageContext2D {
	return {
		font: '',
		measureText: vi.fn((text: string) => ({
			width: text.length * charWidth,
			fontBoundingBoxAscent: lineHeight * 0.8,
			fontBoundingBoxDescent: lineHeight * 0.2,
		})),
	} as unknown as CompanionImageContext2D
}

describe('segmentTextToUnicodeChars', () => {
	test('segments simple ASCII text', () => {
		const result = segmentTextToUnicodeChars('hello', 100)
		expect(result.displayTextChars).toEqual(['h', 'e', 'l', 'l', 'o'])
		expect(result.wasTruncated).toBe(false)
	})

	test('handles empty text', () => {
		const result = segmentTextToUnicodeChars('', 100)
		expect(result.displayTextChars).toEqual([])
		expect(result.wasTruncated).toBe(false)
	})

	test('truncates when hitting maxAllowedChars limit', () => {
		const result = segmentTextToUnicodeChars('hello world', 5)
		expect(result.displayTextChars).toEqual(['h', 'e', 'l', 'l', 'o'])
		expect(result.wasTruncated).toBe(true)
	})

	test('does not truncate when exactly at limit', () => {
		const result = segmentTextToUnicodeChars('hello', 5)
		expect(result.displayTextChars).toEqual(['h', 'e', 'l', 'l', 'o'])
		expect(result.wasTruncated).toBe(false)
	})

	test('handles multi-codepoint emoji as single character', () => {
		// 👨‍👩‍👧‍👦 is a family emoji made of multiple codepoints joined with zero-width joiners
		const result = segmentTextToUnicodeChars('👨‍👩‍👧‍👦', 10)
		expect(result.displayTextChars).toHaveLength(1)
		expect(result.displayTextChars[0]).toBe('👨‍👩‍👧‍👦')
		expect(result.wasTruncated).toBe(false)
	})

	test('handles simple emoji', () => {
		const result = segmentTextToUnicodeChars('😀😁😂', 10)
		expect(result.displayTextChars).toEqual(['😀', '😁', '😂'])
		expect(result.wasTruncated).toBe(false)
	})

	test('handles mixed text and emoji', () => {
		const result = segmentTextToUnicodeChars('hi🎉bye', 10)
		expect(result.displayTextChars).toEqual(['h', 'i', '🎉', 'b', 'y', 'e'])
		expect(result.wasTruncated).toBe(false)
	})

	test('handles unicode combining characters', () => {
		// é can be represented as e + combining acute accent
		const result = segmentTextToUnicodeChars('café', 10)
		expect(result.displayTextChars).toHaveLength(4)
		expect(result.displayTextChars.join('')).toBe('café')
		expect(result.wasTruncated).toBe(false)
	})

	test('handles zero-width joiners correctly', () => {
		// Flag emojis like 🇺🇸 are made of two regional indicator symbols
		const result = segmentTextToUnicodeChars('🇺🇸', 10)
		expect(result.displayTextChars).toHaveLength(1)
		expect(result.displayTextChars[0]).toBe('🇺🇸')
		expect(result.wasTruncated).toBe(false)
	})

	test('truncates in middle of emoji sequence', () => {
		const result = segmentTextToUnicodeChars('😀😁😂😃', 2)
		expect(result.displayTextChars).toEqual(['😀', '😁'])
		expect(result.wasTruncated).toBe(true)
	})

	test('handles very long text efficiently', () => {
		const longText = 'a'.repeat(10000)
		const result = segmentTextToUnicodeChars(longText, 100)
		expect(result.displayTextChars).toHaveLength(100)
		expect(result.wasTruncated).toBe(true)
	})

	test('handles newlines', () => {
		const result = segmentTextToUnicodeChars('hello\nworld', 20)
		expect(result.displayTextChars).toEqual(['h', 'e', 'l', 'l', 'o', '\n', 'w', 'o', 'r', 'l', 'd'])
		expect(result.wasTruncated).toBe(false)
	})

	test('handles tabs and spaces', () => {
		const result = segmentTextToUnicodeChars('a\tb c', 10)
		expect(result.displayTextChars).toEqual(['a', '\t', 'b', ' ', 'c'])
		expect(result.wasTruncated).toBe(false)
	})

	test('handles Gurmukhi script', () => {
		// Gurmukhi text (one of the fonts supported in the system)
		// Note: combining vowel signs are treated as part of the base character
		const result = segmentTextToUnicodeChars('ਸਤਿ', 10)
		expect(result.displayTextChars).toHaveLength(2)
		expect(result.displayTextChars.join('')).toBe('ਸਤਿ')
		expect(result.wasTruncated).toBe(false)
	})

	test('handles Chinese characters', () => {
		const result = segmentTextToUnicodeChars('你好世界', 10)
		expect(result.displayTextChars).toEqual(['你', '好', '世', '界'])
		expect(result.wasTruncated).toBe(false)
	})

	test('handles Korean characters', () => {
		const result = segmentTextToUnicodeChars('안녕하세요', 10)
		expect(result.displayTextChars).toEqual(['안', '녕', '하', '세', '요'])
		expect(result.wasTruncated).toBe(false)
	})

	test('maxAllowedChars of 0 returns empty array', () => {
		const result = segmentTextToUnicodeChars('hello', 0)
		expect(result.displayTextChars).toEqual([])
		expect(result.wasTruncated).toBe(true)
	})

	test('maxAllowedChars of 1 returns first character only', () => {
		const result = segmentTextToUnicodeChars('hello', 1)
		expect(result.displayTextChars).toEqual(['h'])
		expect(result.wasTruncated).toBe(true)
	})
})

describe('resolveFontSizeBounds', () => {
	describe('allowShrink=false (fixed size)', () => {
		test('collapses to the requested size', () => {
			expect(resolveFontSizeBounds(72, 14, false)).toEqual({ min: 14, max: 14 })
			expect(resolveFontSizeBounds(72, 24, false)).toEqual({ min: 24, max: 24 })
			expect(resolveFontSizeBounds(72, 7, false)).toEqual({ min: 7, max: 7 })
		})

		test('clamps minimum font size to round(h/24)', () => {
			expect(resolveFontSizeBounds(72, 1, false)).toEqual({ min: 3, max: 3 })
			expect(resolveFontSizeBounds(72, 0, false)).toEqual({ min: 3, max: 3 })
			expect(resolveFontSizeBounds(72, -5, false)).toEqual({ min: 3, max: 3 })
		})

		test('clamps maximum font size to height', () => {
			expect(resolveFontSizeBounds(72, 150, false)).toEqual({ min: 72, max: 72 })
			expect(resolveFontSizeBounds(123, 200, false)).toEqual({ min: 123, max: 123 })
		})

		test('passes through edge values', () => {
			expect(resolveFontSizeBounds(72, 3, false)).toEqual({ min: 3, max: 3 })
			expect(resolveFontSizeBounds(72, 71, false)).toEqual({ min: 71, max: 71 })
		})
	})

	describe('allowShrink=true (shrink to fit)', () => {
		test('spans from the min auto size (10% of h) up to the configured size', () => {
			// floor = MIN_FONT_SIZE_FRACTION * 72 = 7.2
			expect(resolveFontSizeBounds(72, 60, true)).toEqual({ min: 7.2, max: 60 })
			expect(resolveFontSizeBounds(72, 30, true)).toEqual({ min: 7.2, max: 30 })
		})

		test('max clamps to the height (the "auto" / no-cap signal is fontsize === h)', () => {
			expect(resolveFontSizeBounds(72, 72, true)).toEqual({ min: 7.2, max: 72 })
			expect(resolveFontSizeBounds(72, 200, true)).toEqual({ min: 7.2, max: 72 })
		})

		test('the floor never exceeds the configured cap', () => {
			// fontsize=5 is below the 7.2 floor, so both bounds collapse to it
			expect(resolveFontSizeBounds(72, 5, true)).toEqual({ min: 5, max: 5 })
			// fontsize=0 clamps up to round(72/24)=3, still below the floor
			expect(resolveFontSizeBounds(72, 0, true)).toEqual({ min: 3, max: 3 })
		})

		test('bounds scale with the reference height', () => {
			// floor = 0.1 * 144 = 14.4
			expect(resolveFontSizeBounds(144, 144, true)).toEqual({ min: 14.4, max: 144 })
		})
	})
})

describe('findBestFontSize', () => {
	const GRID = 0.25
	// A monotonic fit oracle: every size up to (and including) `boundary` fits, larger ones don't
	const fitsUpTo = (boundary: number) => (size: number) => size <= boundary

	test('returns max when the text already fits at the largest size', () => {
		expect(findBestFontSize({ min: 7.2, max: 72 }, GRID, fitsUpTo(100))).toBe(72)
	})

	test('returns min when nothing above the floor fits (rendered as overflow by the caller)', () => {
		expect(findBestFontSize({ min: 7.2, max: 72 }, GRID, fitsUpTo(3))).toBe(7.2)
	})

	test('collapses to the single size when the range is empty (min === max)', () => {
		const fits = vi.fn(() => false)
		expect(findBestFontSize({ min: 20, max: 20 }, GRID, fits)).toBe(20)
		// No searching needed for a fixed size
		expect(fits).not.toHaveBeenCalled()
	})

	test.each([{ boundary: 42.37 }, { boundary: 12.9 }, { boundary: 55.05 }, { boundary: 30.0 }, { boundary: 68.8 }])(
		'converges on an arbitrary boundary ($boundary) to within one grid step',
		({ boundary }) => {
			const result = findBestFontSize({ min: 7.2, max: 72 }, GRID, fitsUpTo(boundary))
			// The chosen size must fit and be no more than one grid step below the true boundary —
			// i.e. any size is reachable, not just a handful of fixed steps.
			expect(result).toBeLessThanOrEqual(boundary)
			expect(boundary - result).toBeLessThanOrEqual(GRID)
		}
	)

	test('produces finely-spaced sizes across neighbouring boundaries (smooth, not stepped)', () => {
		// Sweeping the fit boundary in small increments must yield correspondingly small changes in the
		// chosen size — the property the old fixed-step list could not provide.
		const sizes = []
		for (let boundary = 20; boundary <= 40; boundary += 1) {
			sizes.push(findBestFontSize({ min: 7.2, max: 72 }, GRID, fitsUpTo(boundary)))
		}
		const distinct = new Set(sizes)
		// 21 distinct boundaries should map to many distinct sizes (not a few discrete steps)
		expect(distinct.size).toBeGreaterThan(15)
		// And every step between neighbours stays small
		for (let i = 1; i < sizes.length; i++) {
			expect(sizes[i] - sizes[i - 1]).toBeLessThanOrEqual(1 + GRID)
		}
	})

	test('never probes outside the bounds', () => {
		const probed: number[] = []
		findBestFontSize({ min: 7.2, max: 72 }, GRID, (size) => {
			probed.push(size)
			return size <= 33
		})
		for (const size of probed) {
			expect(size).toBeGreaterThanOrEqual(7.2)
			expect(size).toBeLessThanOrEqual(72)
		}
	})
})

const expAscent = (em: number) => em * 0.8
const expDescent = (em: number) => em * 0.2
const expLineHeight = (em: number) => em

describe('computeTextLayout', () => {
	describe('with w:72 h:72 (standard button)', () => {
		const w = 72
		const h = 72
		const fontDef = '14px TestFont'

		test('empty text produces no lines', () => {
			const context = createMockContext(10, 14)
			const result = computeTextLayout(context, w, h, [], fontDef)

			expect(result).toEqual({
				fontDefinition: fontDef,
				lines: [],
				measuredLineHeight: expect.closeTo(expLineHeight(14), 5),
				measuredAscent: expect.closeTo(expAscent(14), 5),
				fits: false,
				totalHeight: 0,
			} satisfies TextLayoutResult)
		})

		test('short text that fits on one line', () => {
			const context = createMockContext(10, 14)
			// 'Hello' = 5 chars * 10px = 50px, fits in 72px width
			const result = computeTextLayout(context, w, h, [...'Hello'], fontDef)

			expect(result).toEqual({
				fontDefinition: fontDef,
				lines: [
					{
						text: 'Hello',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
				],
				measuredLineHeight: expect.closeTo(expLineHeight(14), 5),
				measuredAscent: expect.closeTo(expAscent(14), 5),
				totalHeight: expect.closeTo(expLineHeight(14) * 1, 5),
				fits: true,
			} satisfies TextLayoutResult)
		})

		test('text that needs line wrapping', () => {
			const context = createMockContext(10, 14)
			// 'Hello World' = 11 chars * 10px = 110px, needs wrapping at 72px
			const result = computeTextLayout(context, w, h, [...'Hello World'], fontDef)

			expect(result).toEqual({
				fontDefinition: fontDef,
				lines: [
					{
						text: 'Hello',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
					{
						text: 'World',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
				],
				measuredLineHeight: expect.closeTo(expLineHeight(14), 5),
				measuredAscent: expect.closeTo(expAscent(14), 5),
				totalHeight: expect.closeTo(expLineHeight(14) * 2, 5),
				fits: true,
			} satisfies TextLayoutResult)
		})

		test('text with explicit newlines', () => {
			const context = createMockContext(10, 14)
			const result = computeTextLayout(context, w, h, [...'Line1\nLine2'], fontDef)

			expect(result).toEqual({
				fontDefinition: fontDef,
				lines: [
					{
						text: 'Line1',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
					{
						text: 'Line2',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
				],
				measuredLineHeight: expect.closeTo(expLineHeight(14), 5),
				measuredAscent: expect.closeTo(expAscent(14), 5),
				totalHeight: expect.closeTo(expLineHeight(14) * 2, 5),
				fits: true,
			} satisfies TextLayoutResult)
		})

		test('text with multiple explicit newlines', () => {
			const context = createMockContext(10, 14)
			const result = computeTextLayout(context, w, h, [...'A\nB\nC'], fontDef)

			expect(result).toEqual({
				fontDefinition: fontDef,
				lines: [
					{
						text: 'A',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
					{
						text: 'B',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
					{
						text: 'C',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
				],
				measuredLineHeight: expect.closeTo(expLineHeight(14), 5),
				measuredAscent: expect.closeTo(expAscent(14), 5),
				totalHeight: expect.closeTo(expLineHeight(14) * 3, 5),
				fits: true,
			} satisfies TextLayoutResult)
		})

		test('text breaks at word boundaries', () => {
			const context = createMockContext(10, 14)
			// 'AB CD EF' = 8 chars * 10px = 80px, needs wrapping at 72px
			// Should break at spaces: 'AB CD' = 5 chars = 50px (fits), then 'EF'
			const result = computeTextLayout(context, w, h, [...'AB CD EF'], fontDef)

			expect(result).toEqual({
				fontDefinition: fontDef,
				lines: [
					{
						text: 'AB CD',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
					{
						text: 'EF',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
				],
				measuredLineHeight: expect.closeTo(expLineHeight(14), 5),
				measuredAscent: expect.closeTo(expAscent(14), 5),
				totalHeight: expect.closeTo(expLineHeight(14) * 2, 5),
				fits: true,
			} satisfies TextLayoutResult)
		})

		test('text breaks at special characters', () => {
			const context = createMockContext(10, 14)

			// Test breaking at hyphen - 'ABCD-EFGH-IJKL' = 14 chars at 10px = 140px, width 72px fits 7 chars, breaks after special char: 'ABCD-', 'EFGH-', 'IJKL'
			const hyphenResult = computeTextLayout(context, w, h, [...'ABCD-EFGH-IJKL'], fontDef)
			expect(hyphenResult).toEqual({
				fontDefinition: fontDef,
				lines: [
					{
						text: 'ABCD-',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
					{
						text: 'EFGH-',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
					{
						text: 'IJKL',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
				],
				measuredLineHeight: expect.closeTo(expLineHeight(14), 5),
				measuredAscent: expect.closeTo(expAscent(14), 5),
				totalHeight: expect.closeTo(expLineHeight(14) * 3, 5),
				fits: true,
			} satisfies TextLayoutResult)

			// Test breaking at underscore
			const underscoreResult = computeTextLayout(context, w, h, [...'ABCD_EFGH_IJKL'], fontDef)
			expect(underscoreResult).toEqual({
				fontDefinition: fontDef,
				lines: [
					{
						text: 'ABCD_',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
					{
						text: 'EFGH_',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
					{
						text: 'IJKL',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
				],
				measuredLineHeight: expect.closeTo(expLineHeight(14), 5),
				measuredAscent: expect.closeTo(expAscent(14), 5),
				totalHeight: expect.closeTo(expLineHeight(14) * 3, 5),
				fits: true,
			} satisfies TextLayoutResult)

			// Test breaking at colon
			const colonResult = computeTextLayout(context, w, h, [...'ABCD:EFGH:IJKL'], fontDef)
			expect(colonResult).toEqual({
				fontDefinition: fontDef,
				lines: [
					{
						text: 'ABCD:',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
					{
						text: 'EFGH:',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
					{
						text: 'IJKL',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
				],
				measuredLineHeight: expect.closeTo(expLineHeight(14), 5),
				measuredAscent: expect.closeTo(expAscent(14), 5),
				totalHeight: expect.closeTo(expLineHeight(14) * 3, 5),
				fits: true,
			} satisfies TextLayoutResult)

			// Test breaking at tilde
			const tildeResult = computeTextLayout(context, w, h, [...'ABCD~EFGH~IJKL'], fontDef)
			expect(tildeResult).toEqual({
				fontDefinition: fontDef,
				lines: [
					{
						text: 'ABCD~',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
					{
						text: 'EFGH~',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
					{
						text: 'IJKL',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
				],
				measuredLineHeight: expect.closeTo(expLineHeight(14), 5),
				measuredAscent: expect.closeTo(expAscent(14), 5),
				totalHeight: expect.closeTo(expLineHeight(14) * 3, 5),
				fits: true,
			} satisfies TextLayoutResult)
		})

		test('text too tall to fit returns fits=false', () => {
			const context = createMockContext(10, 20) // 20px line height
			// With h=72, fits 4 lines (4 * 20 = 80px > 72px). 5 lines requested (A-E), stops at 4, fits=false
			const result = computeTextLayout(context, w, h, [...'A\nB\nC\nD\nE'], fontDef)

			expect(result.fits).toBe(false)
			expect(result.totalHeight).toBeGreaterThan(h)
		})

		test('single line taller than the box is still drawn (draw & clip, not vanish)', () => {
			// Regression for #4305: a fixed-size glyph taller than the draw area must produce one line
			// (drawn and allowed to overflow/clip) rather than an empty layout that renders nothing.
			const context = createMockContext(10, 80) // line height 80 > box height 54
			const result = computeTextLayout(context, 54, 54, [...'⏵'], fontDef)

			expect(result).toEqual({
				fontDefinition: fontDef,
				lines: [
					{
						text: '⏵',
						ascent: expect.closeTo(expAscent(80), 5),
						descent: expect.closeTo(expDescent(80), 5),
					},
				],
				measuredLineHeight: expect.closeTo(expLineHeight(80), 5),
				measuredAscent: expect.closeTo(expAscent(80), 5),
				totalHeight: expect.closeTo(expLineHeight(80) * 1, 5),
				fits: false,
			} satisfies TextLayoutResult)
		})

		test('leading space is stripped', () => {
			const context = createMockContext(10, 14)
			const result = computeTextLayout(context, w, h, [...' Hello'], fontDef)

			expect(result).toEqual({
				fontDefinition: fontDef,
				lines: [
					{
						text: 'Hello',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
				],
				measuredLineHeight: expect.closeTo(expLineHeight(14), 5),
				measuredAscent: expect.closeTo(expAscent(14), 5),
				totalHeight: expect.closeTo(expLineHeight(14) * 1, 5),
				fits: true,
			} satisfies TextLayoutResult)
		})

		test('preserves multiple leading spaces after the first', () => {
			const context = createMockContext(10, 14)
			// Only the first space should be stripped per line
			const result = computeTextLayout(context, w, h, [...'  Hi'], fontDef)

			expect(result).toEqual({
				fontDefinition: fontDef,
				lines: [
					{
						text: ' Hi',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
				],
				measuredLineHeight: expect.closeTo(expLineHeight(14), 5),
				measuredAscent: expect.closeTo(expAscent(14), 5),
				totalHeight: expect.closeTo(expLineHeight(14) * 1, 5),
				fits: true,
			} satisfies TextLayoutResult)
		})

		test('sets font on context', () => {
			const context = createMockContext()
			const result = computeTextLayout(context, w, h, [...'Test'], fontDef)

			expect(context.font).toBe(fontDef)
			expect(result).toEqual({
				fontDefinition: fontDef,
				lines: [
					{
						text: 'Test',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
				],
				measuredLineHeight: expect.closeTo(expLineHeight(14), 5),
				measuredAscent: expect.closeTo(expAscent(14), 5),
				totalHeight: expect.closeTo(expLineHeight(14) * 1, 5),
				fits: true,
			} satisfies TextLayoutResult)
		})
	})

	describe('with w:144 h:144 (double-size button)', () => {
		const w = 144
		const h = 144
		const fontDef = '14px TestFont'

		test('more text fits on each line', () => {
			const context = createMockContext(10, 14)
			// 'Hello World!' = 12 chars * 10px = 120px, fits in 144px
			const result = computeTextLayout(context, w, h, [...'Hello World!'], fontDef)

			expect(result).toEqual({
				fontDefinition: fontDef,
				lines: [
					{
						text: 'Hello World!',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
				],
				measuredLineHeight: expect.closeTo(expLineHeight(14), 5),
				measuredAscent: expect.closeTo(expAscent(14), 5),
				totalHeight: expect.closeTo(expLineHeight(14) * 1, 5),
				fits: true,
			} satisfies TextLayoutResult)
		})

		test('more lines fit vertically', () => {
			const context = createMockContext(10, 14)
			// 144/14 = 10.28, so up to 10 lines should fit
			const result = computeTextLayout(context, w, h, [...'A\nB\nC\nD\nE\nF\nG\nH\nI\nJ'], fontDef)

			expect(result).toEqual({
				fontDefinition: fontDef,
				lines: [
					{
						text: 'A',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
					{
						text: 'B',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
					{
						text: 'C',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
					{
						text: 'D',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
					{
						text: 'E',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
					{
						text: 'F',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
					{
						text: 'G',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
					{
						text: 'H',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
					{
						text: 'I',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
					{
						text: 'J',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
				],
				measuredLineHeight: expect.closeTo(expLineHeight(14), 5),
				measuredAscent: expect.closeTo(expAscent(14), 5),
				totalHeight: expect.closeTo(expLineHeight(14) * 10, 5),
				fits: true,
			} satisfies TextLayoutResult)
		})
	})

	describe('with w:360 h:360 (large display)', () => {
		const w = 360
		const h = 360
		const fontDef = '14px TestFont'

		test('handles long text efficiently', () => {
			const context = createMockContext(10, 14)
			const longText = 'This is a longer text that should wrap across multiple lines on a larger display'
			// 82 chars at 10px = 820px, width 360px = ~2.3 lines worth, but with word breaks will be ~3 lines
			const result = computeTextLayout(context, w, h, [...longText], fontDef)

			expect(result).toEqual({
				fontDefinition: fontDef,
				lines: [
					{
						text: 'This is a longer text that should',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
					{
						text: 'wrap across multiple lines on a',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
					{
						text: 'larger display',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
				],
				measuredLineHeight: expect.closeTo(expLineHeight(14), 5),
				measuredAscent: expect.closeTo(expAscent(14), 5),
				totalHeight: expect.closeTo(expLineHeight(14) * 3, 5),
				fits: true,
			} satisfies TextLayoutResult)
		})
	})

	describe('edge cases', () => {
		test('single character', () => {
			const context = createMockContext(10, 14)
			const fontDef = '14px TestFont'
			const result = computeTextLayout(context, 72, 72, ['A'], fontDef)

			expect(result).toEqual({
				fontDefinition: fontDef,
				lines: [
					{
						text: 'A',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
				],
				measuredLineHeight: expect.closeTo(expLineHeight(14), 5),
				measuredAscent: expect.closeTo(expAscent(14), 5),
				totalHeight: expect.closeTo(expLineHeight(14) * 1, 5),
				fits: true,
			} satisfies TextLayoutResult)
		})

		test('single wide character that exceeds width', () => {
			const context = createMockContext(100, 14) // Each char is 100px wide
			const fontDef = '14px TestFont'
			const result = computeTextLayout(context, 72, 72, ['W'], fontDef)

			expect(result).toEqual({
				fontDefinition: fontDef,
				lines: [
					{
						text: 'W',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
				],
				measuredLineHeight: expect.closeTo(expLineHeight(14), 5),
				measuredAscent: expect.closeTo(expAscent(14), 5),
				totalHeight: expect.closeTo(expLineHeight(14) * 1, 5),
				fits: true,
			} satisfies TextLayoutResult)
		})

		test('all spaces', () => {
			const context = createMockContext(10, 14)
			const fontDef = '14px TestFont'
			// 5 spaces: first is stripped, remaining 4 spaces form one line
			const result = computeTextLayout(context, 72, 72, [...'     '], fontDef)

			expect(result).toEqual({
				fontDefinition: fontDef,
				lines: [
					{
						text: '    ',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
				],
				measuredLineHeight: expect.closeTo(expLineHeight(14), 5),
				measuredAscent: expect.closeTo(expAscent(14), 5),
				totalHeight: expect.closeTo(expLineHeight(14) * 1, 5),
				fits: true,
			} satisfies TextLayoutResult)
		})

		test('very long word without break points', () => {
			const context = createMockContext(10, 14)
			const longWord = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
			const fontDef = '14px TestFont'
			const result = computeTextLayout(context, 72, 72, [...longWord], fontDef)

			expect(result).toEqual({
				fontDefinition: fontDef,
				lines: [
					{
						text: 'ABCDEFG',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
					{
						text: 'HIJKLMN',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
					{
						text: 'OPQRSTU',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
					{
						text: 'VWXYZ',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
				],
				measuredLineHeight: expect.closeTo(expLineHeight(14), 5),
				measuredAscent: expect.closeTo(expAscent(14), 5),
				totalHeight: expect.closeTo(expLineHeight(14) * 4, 5),
				fits: false,
			} satisfies TextLayoutResult)
		})

		test('newline only', () => {
			const context = createMockContext(10, 14)
			const fontDef = '14px TestFont'
			const result = computeTextLayout(context, 72, 72, ['\n'], fontDef)

			expect(result).toEqual({
				fontDefinition: fontDef,
				lines: [
					{ text: '', ascent: expect.closeTo(expAscent(14), 5), descent: expect.closeTo(expDescent(14), 5) },
					{ text: '', ascent: expect.closeTo(expAscent(14), 5), descent: expect.closeTo(expDescent(14), 5) },
				],
				measuredLineHeight: expect.closeTo(expLineHeight(14), 5),
				measuredAscent: expect.closeTo(expAscent(14), 5),
				totalHeight: expect.closeTo(expLineHeight(14) * 2, 5),
				fits: true,
			} satisfies TextLayoutResult)
		})

		test('multiple consecutive newlines', () => {
			const context = createMockContext(10, 14)
			const fontDef = '14px TestFont'
			const result = computeTextLayout(context, 72, 72, [...'A\n\n\nB'], fontDef)

			expect(result).toEqual({
				fontDefinition: fontDef,
				lines: [
					{
						text: 'A',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
					{ text: '', ascent: expect.closeTo(expAscent(14), 5), descent: expect.closeTo(expDescent(14), 5) },
					{ text: '', ascent: expect.closeTo(expAscent(14), 5), descent: expect.closeTo(expDescent(14), 5) },
					{
						text: 'B',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
				],
				measuredLineHeight: expect.closeTo(expLineHeight(14), 5),
				measuredAscent: expect.closeTo(expAscent(14), 5),
				totalHeight: expect.closeTo(expLineHeight(14) * 4, 5),
				fits: true,
			} satisfies TextLayoutResult)
		})

		test('unicode characters', () => {
			const context = createMockContext(10, 14)
			const fontDef = '14px TestFont'
			const result = computeTextLayout(context, 72, 72, [...'Héllo'], fontDef)

			expect(result).toEqual({
				fontDefinition: fontDef,
				lines: [
					{
						text: 'Héllo',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
				],
				measuredLineHeight: expect.closeTo(expLineHeight(14), 5),
				measuredAscent: expect.closeTo(expAscent(14), 5),
				totalHeight: expect.closeTo(expLineHeight(14) * 1, 5),
				fits: true,
			} satisfies TextLayoutResult)
		})

		test('emoji characters (multi-codepoint)', () => {
			const context = createMockContext(10, 14)
			// Emoji should be treated as single characters when spread
			const emoji = '😀'
			const fontDef = '14px TestFont'
			const result = computeTextLayout(context, 72, 72, [...emoji], fontDef)

			expect(result).toEqual({
				fontDefinition: fontDef,
				lines: [{ text: emoji, ascent: expect.closeTo(expAscent(14), 5), descent: expect.closeTo(expDescent(14), 5) }],
				measuredLineHeight: expect.closeTo(expLineHeight(14), 5),
				measuredAscent: expect.closeTo(expAscent(14), 5),
				totalHeight: expect.closeTo(expLineHeight(14) * 1, 5),
				fits: true,
			} satisfies TextLayoutResult)
		})

		test('mixed emoji and text', () => {
			const context = createMockContext(10, 14)
			const fontDef = '14px TestFont'
			const result = computeTextLayout(context, 72, 72, [...'Hi 😀!'], fontDef)

			expect(result).toEqual({
				fontDefinition: fontDef,
				lines: [
					{
						text: 'Hi 😀!',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
				],
				measuredLineHeight: expect.closeTo(expLineHeight(14), 5),
				measuredAscent: expect.closeTo(expAscent(14), 5),
				totalHeight: expect.closeTo(expLineHeight(14) * 1, 5),
				fits: true,
			} satisfies TextLayoutResult)
		})

		test('keeps multi-codepoint glyphs intact when a width break falls inside them', () => {
			// #143db: a break must land between glyphs, never inside a multi-codepoint one. Flags (🇺🇸) are
			// two code points each; the old code split lines via text.split('') and could cut a glyph in half.
			// Feed several as atomic array elements (as segmentTextToUnicodeChars would) and force a width wrap.
			const context = createMockContext(10, 14)
			const flag = '🇺🇸'
			const chars = new Array(6).fill(flag) as string[]
			const result = computeTextLayout(context, 100, 72, chars, '14px TestFont')

			// it must actually wrap to more than one line
			expect(result.lines.length).toBeGreaterThan(1)
			// every line is whole flags only: length is a multiple of one flag's length (no partial glyph),
			// and each grapheme is the complete flag
			for (const line of result.lines) {
				expect(line.text.length % flag.length).toBe(0)
				for (const { segment } of new Intl.Segmenter().segment(line.text)) {
					expect(segment).toBe(flag)
				}
			}
			// and nothing is lost across the breaks
			expect(result.lines.map((l) => l.text).join('')).toBe(chars.join(''))
		})
	})

	describe('long text handling', () => {
		test('very long text abborts adding lines when height exceeded and it should exit early', () => {
			const context = createMockContext(10, 14)
			// With h=72 and 14px line height, fits 7 lines. Each line fits 'A A A' (5 chars * 10px = 50px < 72px)
			const veryLongText = 'A '.repeat(90)
			const fontDef = '14px TestFont'
			const result = computeTextLayout(context, 72, 72, [...veryLongText], fontDef, true)

			expect(result.lines.length).toEqual(7) // number when check is aborted
			expect(result.fits).toBe(false)
			expect(result.totalHeight).greaterThan(72)
		})

		test('unbreakable overflowing word reports not-fitting during a shrink probe (no blank layout)', () => {
			const context = createMockContext(10, 14)
			// No break points, so every size must break mid-word. With exitEarly set (the shrink loop probing
			// a size), the result must be fits:false so a smaller size is tried - not an empty fits:true layout
			// that would render a blank button.
			const result = computeTextLayout(context, 72, 72, [...'ABCDEFGHIJKLMNOP'], '14px TestFont', true)
			expect(result.fits).toBe(false)
		})

		test('extremely long text does not hang', () => {
			const context = createMockContext(10, 14)
			const extremelyLongText = 'X'.repeat(10_000)
			const fontDef = '14px TestFont'

			const startTime = Date.now()
			const result = computeTextLayout(context, 72, 72, [...extremelyLongText], fontDef)
			const elapsed = Date.now() - startTime

			// Should complete in reasonable time (less than 1 second)
			expect(elapsed).toBeLessThan(1000)
			expect(result.lines.length).toEqual(1429)
			expect(result.totalHeight).toBeGreaterThanOrEqual(expLineHeight(14) * 1239 - 5)
		})

		test('paragraph text wraps correctly', () => {
			const context = createMockContext(8, 12) // 8px per char, 12px line height
			// With w=72, fits 9 chars (72/8=9). Words wrap individually: 'The' (3 chars), 'quick' (5 chars), etc.
			const paragraph = 'The quick brown fox jumps over the lazy dog.'
			const fontDef = '12px TestFont'
			const result = computeTextLayout(context, 72, 72, [...paragraph], fontDef)

			expect(result).toEqual({
				fontDefinition: fontDef,
				lines: [
					{
						text: 'The',
						ascent: expect.closeTo(expAscent(12), 5),
						descent: expect.closeTo(expDescent(12), 5),
					},
					{
						text: 'quick',
						ascent: expect.closeTo(expAscent(12), 5),
						descent: expect.closeTo(expDescent(12), 5),
					},
					{
						text: 'brown',
						ascent: expect.closeTo(expAscent(12), 5),
						descent: expect.closeTo(expDescent(12), 5),
					},
					{
						text: 'fox',
						ascent: expect.closeTo(expAscent(12), 5),
						descent: expect.closeTo(expDescent(12), 5),
					},
					{
						text: 'jumps',
						ascent: expect.closeTo(expAscent(12), 5),
						descent: expect.closeTo(expDescent(12), 5),
					},
					{
						text: 'over the',
						ascent: expect.closeTo(expAscent(12), 5),
						descent: expect.closeTo(expDescent(12), 5),
					},
					{
						text: 'lazy dog.',
						ascent: expect.closeTo(expAscent(12), 5),
						descent: expect.closeTo(expDescent(12), 5),
					},
				],
				measuredLineHeight: expect.closeTo(expLineHeight(12), 5),
				measuredAscent: expect.closeTo(expAscent(12), 5),
				totalHeight: expect.closeTo(expLineHeight(12) * 7, 5),
				fits: false, // 7 lines * 12px = 84px exceeds the 72px height
			} satisfies TextLayoutResult)
		})
	})

	describe('dimension edge cases', () => {
		test('very narrow width', () => {
			const context = createMockContext(10, 14)
			const fontDef = '14px TestFont'
			const result = computeTextLayout(context, 20, 72, [...'AB'], fontDef)

			expect(result).toEqual({
				fontDefinition: fontDef,
				lines: [
					{
						text: 'AB',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
				],
				measuredLineHeight: expect.closeTo(expLineHeight(14), 5),
				measuredAscent: expect.closeTo(expAscent(14), 5),
				totalHeight: expect.closeTo(expLineHeight(14) * 1, 5),
				fits: true,
			} satisfies TextLayoutResult)
		})

		test('very short height still draws one line (draw & clip)', () => {
			// #4305: a line taller than the box must still be drawn (and clip), not vanish.
			const context = createMockContext(10, 14)
			const fontDef = '14px TestFont'
			const result = computeTextLayout(context, 72, 10, [...'Hello'], fontDef)

			expect(result).toEqual({
				fontDefinition: fontDef,
				lines: [
					{
						text: 'Hello',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
				],
				measuredLineHeight: expect.closeTo(expLineHeight(14), 5),
				measuredAscent: expect.closeTo(expAscent(14), 5),
				totalHeight: expect.closeTo(expLineHeight(14) * 1, 5),
				fits: false,
			} satisfies TextLayoutResult)
		})

		test('height fits exactly one line', () => {
			// Note: Due to floating point precision, we test with slightly more height than line height
			// In practice, exact equality is unreliable (14.000000000000002 vs 14)
			const context = createMockContext(10, 14)
			const fontDef = '14px TestFont'
			const result = computeTextLayout(context, 72, 15, [...'Hi'], fontDef)

			expect(result).toEqual({
				fontDefinition: fontDef,
				lines: [
					{
						text: 'Hi',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
				],
				measuredLineHeight: expect.closeTo(expLineHeight(14), 5),
				measuredAscent: expect.closeTo(expAscent(14), 5),
				totalHeight: expect.closeTo(expLineHeight(14) * 1, 5),
				fits: true,
			} satisfies TextLayoutResult)
		})

		test('height too short for one line still draws it (draw & clip)', () => {
			// #4305: even when a single line does not fit vertically, draw it rather than nothing.
			const context = createMockContext(10, 14)
			const fontDef = '14px TestFont'
			const result = computeTextLayout(context, 72, 10, [...'Hi'], fontDef)

			expect(result).toEqual({
				fontDefinition: fontDef,
				lines: [
					{
						text: 'Hi',
						ascent: expect.closeTo(expAscent(14), 5),
						descent: expect.closeTo(expDescent(14), 5),
					},
				],
				measuredLineHeight: expect.closeTo(expLineHeight(14), 5),
				measuredAscent: expect.closeTo(expAscent(14), 5),
				totalHeight: expect.closeTo(expLineHeight(14) * 1, 5),
				fits: false,
			} satisfies TextLayoutResult)
		})
	})

	// A width-based break landing immediately before a hard newline used to leave that newline as
	// the first character of the next chunk, which the newline handling then turned into a blank
	// line. This only surfaced in the browser preview: its measureText measures *past* a '\n' (so a
	// value like "Sonos:\n-17.46" is judged too wide and hits the width-wrap path), whereas
	// @napi-rs/canvas stops measuring at the '\n' and never reached the buggy branch. The
	// createMockContext here measures past the '\n' (width = length * charWidth), matching browsers.
	describe('hard newline adjacent to a width break', () => {
		const fontDef = '14px TestFont'

		test('width break exactly before a newline does not insert a blank line', () => {
			const context = createMockContext(10, 14)
			// 'ABCDEF' is exactly 60px wide (fills w=60) and is immediately followed by '\n'.
			const result = computeTextLayout(context, 60, 72, [...'ABCDEF\nGHIJKL'], fontDef)
			expect(result.lines.map((l) => l.text)).toEqual(['ABCDEF', 'GHIJKL'])
		})

		test('real-world "Sonos:\\n-17.46" renders as two lines, not three', () => {
			const context = createMockContext(10, 14)
			const result = computeTextLayout(context, 60, 72, [...'Sonos:\n-17.46'], fontDef)
			expect(result.lines.map((l) => l.text)).toEqual(['Sonos:', '-17.46'])
		})

		test('a deliberate blank line is still preserved through the width-wrap path', () => {
			const context = createMockContext(10, 14)
			// Two newlines: the width break consumes the first (its break already happened), the
			// second remains as the user's intended blank line.
			const result = computeTextLayout(context, 60, 72, [...'ABCDEF\n\nGHIJKL'], fontDef)
			expect(result.lines.map((l) => l.text)).toEqual(['ABCDEF', '', 'GHIJKL'])
		})
	})
})

import { describe, expect, test, vi } from 'vitest'
import type { CompanionImageContext2D } from '../../Graphics/ImageBase.js'
import {
	computeTextLayout,
	resolveFontSizes,
	segmentTextToUnicodeChars,
	type TextLayoutResult,
} from '../../Graphics/TextParser.js'

// Round each element of a number array to 3 decimal places.
// Keeps test expectations stable across V8 float-rounding changes.
const r3 = (nums: number[]): number[] => nums.map((n) => Math.round(n * 1000) / 1000)

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

describe('resolveFontSizes', () => {
	describe('allowShrink=false (fixed size)', () => {
		test('returns single element array with requested size', () => {
			expect(resolveFontSizes(72, 72, 14, false, 10)).toEqual([14])
			expect(resolveFontSizes(72, 72, 24, false, 10)).toEqual([24])
			expect(resolveFontSizes(72, 72, 7, false, 10)).toEqual([7])
		})

		test('clamps minimum font size to 3', () => {
			expect(resolveFontSizes(72, 72, 1, false, 10)).toEqual([3])
			expect(resolveFontSizes(72, 72, 2, false, 10)).toEqual([3])
			expect(resolveFontSizes(72, 72, 0, false, 10)).toEqual([3])
			expect(resolveFontSizes(72, 72, -5, false, 10)).toEqual([3])
		})

		test('clamps maximum font size to height', () => {
			expect(resolveFontSizes(72, 72, 150, false, 10)).toEqual([72])
			expect(resolveFontSizes(72, 123, 200, false, 10)).toEqual([123])
			expect(resolveFontSizes(72, 72, 120, false, 10)).toEqual([72])
		})

		test('passes through edge values', () => {
			expect(resolveFontSizes(72, 72, 3, false, 10)).toEqual([3])
			expect(resolveFontSizes(72, 72, 71, false, 10)).toEqual([71])
		})
	})

	describe('allowShrink=true (shrink to fit)', () => {
		describe('w:72 h:72 (standard button)', () => {
			const w = 72
			const h = 72

			test('configured size appears first, then heuristic sizes below it', () => {
				// fontsize=60 is above the 0.83*72=59.76 threshold
				const result = resolveFontSizes(w, h, 60, true, 3)
				expect(r3(result)).toEqual([
					60, 59.76, 51.12, 43.92, 30.96, 23.76, 20.16, 17.28, 15.12, 12.24, 10.08, 9.36, 7.92, 7.2,
				])
			})

			test('configured size caps the heuristic candidates for short text', () => {
				// fontsize=30.96 (≈ 0.43*72) — only heuristic sizes below it are included
				const result = resolveFontSizes(w, h, 30.96, true, 3)
				expect(r3(result)).toEqual([30.96, 23.76, 20.16, 17.28, 15.12, 12.24, 10.08, 9.36, 7.92, 7.2])
			})

			test('very short text: FONTSIZE_SHRINK_DEFAULT equivalent gives full heuristic list', () => {
				// FONTSIZE_SHRINK_DEFAULT=100 → pixel size = 100*72/100/1.2 = 60
				// Equivalent to old 'auto' for very short text (charCount < 7*area)
				const result = resolveFontSizes(w, h, 60, true, 3)
				expect(r3(result)).toEqual([
					60, 59.76, 51.12, 43.92, 30.96, 23.76, 20.16, 17.28, 15.12, 12.24, 10.08, 9.36, 7.92, 7.2,
				])
			})

			test('short text (charCount < 30*area)', () => {
				const result = resolveFontSizes(w, h, 60, true, 15)
				expect(r3(result)).toEqual([60, 30.96, 23.76, 20.16, 17.28, 15.12, 12.24, 10.08, 9.36, 7.92, 7.2])
			})

			test('medium text (charCount < 40*area)', () => {
				const result = resolveFontSizes(w, h, 60, true, 35)
				expect(r3(result)).toEqual([60, 23.76, 20.16, 17.28, 15.12, 12.24, 10.08, 9.36, 7.92, 7.2])
			})

			test('longer text (charCount < 50*area)', () => {
				const result = resolveFontSizes(w, h, 60, true, 45)
				expect(r3(result)).toEqual([60, 17.28, 15.12, 12.24, 10.08, 9.36, 7.92, 7.2])
			})

			test('very long text (charCount >= 50*area)', () => {
				const result = resolveFontSizes(w, h, 60, true, 60)
				expect(r3(result)).toEqual([60, 15.12, 12.24, 10.08, 9.36, 7.92, 7.2])
			})

			test('configured size below all heuristic candidates returns only that size', () => {
				// fontsize=5 < MIN_FONT_SIZE_FRACTION*72=7.2, so nothing from heuristic qualifies
				const result = resolveFontSizes(w, h, 5, true, 3)
				expect(r3(result)).toEqual([5])
			})

			test('clamps min/max like fixed mode', () => {
				expect(resolveFontSizes(w, h, 0, true, 3)).toEqual([3])
				expect(resolveFontSizes(w, h, 200, true, 3)[0]).toEqual(72)
			})
		})

		describe('w:144 h:144 (double-size button)', () => {
			const w = 144
			const h = 144

			test('thresholds are resolution-independent, sizes scale with h', () => {
				// relativeWidth = 1.0 for square — same thresholds as 72x72; charCount < 30 * 1 = 30
				expect(r3(resolveFontSizes(w, h, h, true, 20))).toEqual([
					61.92, 47.52, 40.32, 34.56, 30.24, 24.48, 20.16, 18.72, 15.84, 14.4,
				])

				// charCount >= 50 * 1 = 50
				expect(r3(resolveFontSizes(w, h, h, true, 50))).toEqual([30.24, 24.48, 20.16, 18.72, 15.84, 14.4])
			})
		})
	})

	// The candidate size range must depend only on the element's aspect ratio (w/h), not its
	// absolute pixel size. The bug this tests: old formula `(w*h)/5000` was calibrated for a
	// ~72px button, so a *small* subregion (e.g. 36×36) produces area ≈ 0.26 and falls into a
	// smaller size range than a proportionally-equivalent large subregion (e.g. 100×100, area=2).
	// The fix normalises to w/h so the same range is always selected for the same aspect ratio.
	describe('resolution independence — same candidate fractions for any subregion size', () => {
		// Normalise returned sizes to fractions-of-h so different absolute sizes are comparable
		const fractions = (w: number, h: number, chars: number) =>
			resolveFontSizes(w, h, h, true, chars).map((s) => r3([s / h])[0])

		// Square subregion (1:1): critical case is short text in a small element.
		// Old formula: 36×36 → area=0.26, 2 chars → Range 2 [0.43…]
		//              100×100 → area=2.0,  2 chars → Range 1 [0.83…]  ← different!
		// New formula: both → relativeWidth=1, 2 < 7 → Range 1 [0.83…] ← same
		test.each([
			{ chars: 2, desc: '2 chars' },
			{ chars: 4, desc: '4 chars' },
			{ chars: 6, desc: '6 chars' },
		])('square subregion: $desc — same fractions at 36px, 72px, and 100px', ({ chars }) => {
			const atSmall = fractions(36, 36, chars) // small subregion: old formula diverges here
			expect(fractions(72, 72, chars)).toEqual(atSmall)
			expect(fractions(100, 100, chars)).toEqual(atSmall)
		})

		// Wide subregion (2:1): same principle across different absolute widths
		test.each([{ chars: 2 }, { chars: 5 }])(
			'2:1 subregion: $chars chars — same fractions at 36×18, 72×36, and 100×50',
			({ chars }) => {
				const atSmall = fractions(36, 18, chars)
				expect(fractions(72, 36, chars)).toEqual(atSmall)
				expect(fractions(100, 50, chars)).toEqual(atSmall)
			}
		)

		// Narrow-height element (~35% of canvas height, full width): the specific case
		// the user observed — a single line of text in a short text region.
		// Old formula: w=72, h=25 → area=0.36, 3 chars ≥ 7×0.36=2.52 → Range 2 [0.43…]
		//              w=200, h=70 → area=2.8,  3 chars < 7×2.8=19.6  → Range 1 [0.83…]  ← different!
		// New formula: relativeWidth=72/25=2.88 or 200/70=2.857, both → 3 < 7×2.857=20 → Range 1
		test.each([
			{ chars: 3, desc: '3 chars (single short word)' },
			{ chars: 5, desc: '5 chars (single medium word)' },
		])('full-width 35% height element: $desc — same fractions at 72×25, 144×50, and 200×70', ({ chars }) => {
			const atSmall = fractions(72, 25, chars)
			expect(fractions(144, 50, chars)).toEqual(atSmall)
			expect(fractions(200, 70, chars)).toEqual(atSmall)
		})

		// Same for ~40% height
		test.each([{ chars: 3 }, { chars: 5 }])(
			'full-width 40% height element: $chars chars — same fractions at 72×29, 144×58, and 200×80',
			({ chars }) => {
				const atSmall = fractions(72, 29, chars)
				expect(fractions(144, 58, chars)).toEqual(atSmall)
				expect(fractions(200, 80, chars)).toEqual(atSmall)
			}
		)
	})
})

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
				measuredLineHeight: expect.closeTo(14, 5),
				measuredAscent: expect.closeTo(14 * 0.8, 5),
				fits: false,
			} satisfies TextLayoutResult)
		})

		test('short text that fits on one line', () => {
			const context = createMockContext(10, 14)
			// 'Hello' = 5 chars * 10px = 50px, fits in 72px width
			const result = computeTextLayout(context, w, h, [...'Hello'], fontDef)

			expect(result).toEqual({
				fontDefinition: fontDef,
				lines: [{ text: 'Hello', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) }],
				measuredLineHeight: expect.closeTo(14, 5),
				measuredAscent: expect.closeTo(14 * 0.8, 5),
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
					{ text: 'Hello', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) },
					{ text: 'World', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) },
				],
				measuredLineHeight: expect.closeTo(14, 5),
				measuredAscent: expect.closeTo(14 * 0.8, 5),
				fits: true,
			} satisfies TextLayoutResult)
		})

		test('text with explicit newlines', () => {
			const context = createMockContext(10, 14)
			const result = computeTextLayout(context, w, h, [...'Line1\nLine2'], fontDef)

			expect(result).toEqual({
				fontDefinition: fontDef,
				lines: [
					{ text: 'Line1', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) },
					{ text: 'Line2', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) },
				],
				measuredLineHeight: expect.closeTo(14, 5),
				measuredAscent: expect.closeTo(14 * 0.8, 5),
				fits: true,
			} satisfies TextLayoutResult)
		})

		test('text with multiple explicit newlines', () => {
			const context = createMockContext(10, 14)
			const result = computeTextLayout(context, w, h, [...'A\nB\nC'], fontDef)

			expect(result).toEqual({
				fontDefinition: fontDef,
				lines: [
					{ text: 'A', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) },
					{ text: 'B', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) },
					{ text: 'C', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) },
				],
				measuredLineHeight: expect.closeTo(14, 5),
				measuredAscent: expect.closeTo(14 * 0.8, 5),
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
					{ text: 'AB CD', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) },
					{ text: 'EF', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) },
				],
				measuredLineHeight: expect.closeTo(14, 5),
				measuredAscent: expect.closeTo(14 * 0.8, 5),
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
					{ text: 'ABCD-', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) },
					{ text: 'EFGH-', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) },
					{ text: 'IJKL', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) },
				],
				measuredLineHeight: expect.closeTo(14, 5),
				measuredAscent: expect.closeTo(14 * 0.8, 5),
				fits: true,
			} satisfies TextLayoutResult)

			// Test breaking at underscore
			const underscoreResult = computeTextLayout(context, w, h, [...'ABCD_EFGH_IJKL'], fontDef)
			expect(underscoreResult).toEqual({
				fontDefinition: fontDef,
				lines: [
					{ text: 'ABCD_', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) },
					{ text: 'EFGH_', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) },
					{ text: 'IJKL', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) },
				],
				measuredLineHeight: expect.closeTo(14, 5),
				measuredAscent: expect.closeTo(14 * 0.8, 5),
				fits: true,
			} satisfies TextLayoutResult)

			// Test breaking at colon
			const colonResult = computeTextLayout(context, w, h, [...'ABCD:EFGH:IJKL'], fontDef)
			expect(colonResult).toEqual({
				fontDefinition: fontDef,
				lines: [
					{ text: 'ABCD:', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) },
					{ text: 'EFGH:', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) },
					{ text: 'IJKL', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) },
				],
				measuredLineHeight: expect.closeTo(14, 5),
				measuredAscent: expect.closeTo(14 * 0.8, 5),
				fits: true,
			} satisfies TextLayoutResult)

			// Test breaking at tilde
			const tildeResult = computeTextLayout(context, w, h, [...'ABCD~EFGH~IJKL'], fontDef)
			expect(tildeResult).toEqual({
				fontDefinition: fontDef,
				lines: [
					{ text: 'ABCD~', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) },
					{ text: 'EFGH~', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) },
					{ text: 'IJKL', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) },
				],
				measuredLineHeight: expect.closeTo(14, 5),
				measuredAscent: expect.closeTo(14 * 0.8, 5),
				fits: true,
			} satisfies TextLayoutResult)
		})

		test('text too tall to fit returns fits=false', () => {
			const context = createMockContext(10, 20) // 20px line height
			// With h=72, fits 4 lines (4 * 20 = 80px > 72px). 5 lines requested (A-E), stops at 4, fits=false
			const result = computeTextLayout(context, w, h, [...'A\nB\nC\nD\nE'], fontDef)

			expect(result).toEqual({
				fontDefinition: fontDef,
				lines: [
					{ text: 'A', ascent: expect.closeTo(20 * 0.8, 5), descent: expect.closeTo(20 * 0.2, 5) },
					{ text: 'B', ascent: expect.closeTo(20 * 0.8, 5), descent: expect.closeTo(20 * 0.2, 5) },
					{ text: 'C', ascent: expect.closeTo(20 * 0.8, 5), descent: expect.closeTo(20 * 0.2, 5) },
					{ text: 'D', ascent: expect.closeTo(20 * 0.8, 5), descent: expect.closeTo(20 * 0.2, 5) },
				],
				measuredLineHeight: expect.closeTo(20, 5),
				measuredAscent: expect.closeTo(20 * 0.8, 5),
				fits: false,
			} satisfies TextLayoutResult)
		})

		test('single line taller than the box is still drawn (draw & clip, not vanish)', () => {
			// Regression for #4305: a fixed-size glyph taller than the draw area must produce one line
			// (drawn and allowed to overflow/clip) rather than an empty layout that renders nothing.
			const context = createMockContext(10, 80) // line height 80 > box height 54
			const result = computeTextLayout(context, 54, 54, [...'⏵'], fontDef)

			expect(result).toEqual({
				fontDefinition: fontDef,
				lines: [{ text: '⏵', ascent: expect.closeTo(80 * 0.8, 5), descent: expect.closeTo(80 * 0.2, 5) }],
				measuredLineHeight: expect.closeTo(80, 5),
				measuredAscent: expect.closeTo(80 * 0.8, 5),
				fits: false,
			} satisfies TextLayoutResult)
		})

		test('leading space is stripped', () => {
			const context = createMockContext(10, 14)
			const result = computeTextLayout(context, w, h, [...' Hello'], fontDef)

			expect(result).toEqual({
				fontDefinition: fontDef,
				lines: [{ text: 'Hello', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) }],
				measuredLineHeight: expect.closeTo(14, 5),
				measuredAscent: expect.closeTo(14 * 0.8, 5),
				fits: true,
			} satisfies TextLayoutResult)
		})

		test('preserves multiple leading spaces after the first', () => {
			const context = createMockContext(10, 14)
			// Only the first space should be stripped per line
			const result = computeTextLayout(context, w, h, [...'  Hi'], fontDef)

			expect(result).toEqual({
				fontDefinition: fontDef,
				lines: [{ text: ' Hi', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) }],
				measuredLineHeight: expect.closeTo(14, 5),
				measuredAscent: expect.closeTo(14 * 0.8, 5),
				fits: true,
			} satisfies TextLayoutResult)
		})

		test('returns correct measuredLineHeight and measuredAscent', () => {
			const lineHeight = 18
			const context = createMockContext(10, lineHeight)
			const result = computeTextLayout(context, w, h, [...'Test'], fontDef)

			expect(result).toEqual({
				fontDefinition: fontDef,
				lines: [{ text: 'Test', ascent: lineHeight * 0.8, descent: lineHeight * 0.2 }],
				measuredLineHeight: lineHeight,
				measuredAscent: lineHeight * 0.8,
				fits: true,
			} satisfies TextLayoutResult)
		})

		test('sets font on context', () => {
			const context = createMockContext()
			const result = computeTextLayout(context, w, h, [...'Test'], fontDef)

			expect(context.font).toBe(fontDef)
			expect(result).toEqual({
				fontDefinition: fontDef,
				lines: [{ text: 'Test', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) }],
				measuredLineHeight: expect.closeTo(14, 5),
				measuredAscent: expect.closeTo(14 * 0.8, 5),
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
				lines: [{ text: 'Hello World!', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) }],
				measuredLineHeight: expect.closeTo(14, 5),
				measuredAscent: expect.closeTo(14 * 0.8, 5),
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
					{ text: 'A', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) },
					{ text: 'B', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) },
					{ text: 'C', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) },
					{ text: 'D', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) },
					{ text: 'E', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) },
					{ text: 'F', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) },
					{ text: 'G', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) },
					{ text: 'H', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) },
					{ text: 'I', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) },
					{ text: 'J', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) },
				],
				measuredLineHeight: expect.closeTo(14, 5),
				measuredAscent: expect.closeTo(14 * 0.8, 5),
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
						ascent: expect.closeTo(14 * 0.8, 5),
						descent: expect.closeTo(14 * 0.2, 5),
					},
					{
						text: 'wrap across multiple lines on a',
						ascent: expect.closeTo(14 * 0.8, 5),
						descent: expect.closeTo(14 * 0.2, 5),
					},
					{ text: 'larger display', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) },
				],
				measuredLineHeight: expect.closeTo(14, 5),
				measuredAscent: expect.closeTo(14 * 0.8, 5),
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
				lines: [{ text: 'A', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) }],
				measuredLineHeight: expect.closeTo(14, 5),
				measuredAscent: expect.closeTo(14 * 0.8, 5),
				fits: true,
			} satisfies TextLayoutResult)
		})

		test('single wide character that exceeds width', () => {
			const context = createMockContext(100, 14) // Each char is 100px wide
			const fontDef = '14px TestFont'
			const result = computeTextLayout(context, 72, 72, ['W'], fontDef)

			expect(result).toEqual({
				fontDefinition: fontDef,
				lines: [{ text: 'W', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) }],
				measuredLineHeight: expect.closeTo(14, 5),
				measuredAscent: expect.closeTo(14 * 0.8, 5),
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
				lines: [{ text: '    ', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) }],
				measuredLineHeight: expect.closeTo(14, 5),
				measuredAscent: expect.closeTo(14 * 0.8, 5),
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
					{ text: 'ABCDEFG', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) },
					{ text: 'HIJKLMN', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) },
					{ text: 'OPQRSTU', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) },
					{ text: 'VWXYZ', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) },
				],
				measuredLineHeight: expect.closeTo(14, 5),
				measuredAscent: expect.closeTo(14 * 0.8, 5),
				fits: true,
			} satisfies TextLayoutResult)
		})

		test('newline only', () => {
			const context = createMockContext(10, 14)
			const fontDef = '14px TestFont'
			const result = computeTextLayout(context, 72, 72, ['\n'], fontDef)

			expect(result).toEqual({
				fontDefinition: fontDef,
				lines: [
					{ text: '', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) },
					{ text: '', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) },
				],
				measuredLineHeight: expect.closeTo(14, 5),
				measuredAscent: expect.closeTo(14 * 0.8, 5),
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
					{ text: 'A', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) },
					{ text: '', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) },
					{ text: '', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) },
					{ text: 'B', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) },
				],
				measuredLineHeight: expect.closeTo(14, 5),
				measuredAscent: expect.closeTo(14 * 0.8, 5),
				fits: true,
			} satisfies TextLayoutResult)
		})

		test('unicode characters', () => {
			const context = createMockContext(10, 14)
			const fontDef = '14px TestFont'
			const result = computeTextLayout(context, 72, 72, [...'Héllo'], fontDef)

			expect(result).toEqual({
				fontDefinition: fontDef,
				lines: [{ text: 'Héllo', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) }],
				measuredLineHeight: expect.closeTo(14, 5),
				measuredAscent: expect.closeTo(14 * 0.8, 5),
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
				lines: [{ text: emoji, ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) }],
				measuredLineHeight: expect.closeTo(14, 5),
				measuredAscent: expect.closeTo(14 * 0.8, 5),
				fits: true,
			} satisfies TextLayoutResult)
		})

		test('mixed emoji and text', () => {
			const context = createMockContext(10, 14)
			const fontDef = '14px TestFont'
			const result = computeTextLayout(context, 72, 72, [...'Hi 😀!'], fontDef)

			expect(result).toEqual({
				fontDefinition: fontDef,
				lines: [{ text: 'Hi 😀!', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) }],
				measuredLineHeight: expect.closeTo(14, 5),
				measuredAscent: expect.closeTo(14 * 0.8, 5),
				fits: true,
			} satisfies TextLayoutResult)
		})
	})

	describe('long text handling', () => {
		test('very long text stops adding lines when height exceeded', () => {
			const context = createMockContext(10, 14)
			// With h=72, fits 5 lines (5 * 14 = 70px). Each line fits 'A A A' (5 chars * 10px = 50px < 72px)
			const veryLongText = 'A '.repeat(100) // 200 chars total
			const fontDef = '14px TestFont'
			const result = computeTextLayout(context, 72, 72, [...veryLongText], fontDef)

			expect(result).toEqual({
				fontDefinition: fontDef,
				lines: [
					{ text: 'A A A', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) },
					{ text: 'A A A', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) },
					{ text: 'A A A', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) },
					{ text: 'A A A', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) },
					{ text: 'A A A', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) },
				],
				measuredLineHeight: expect.closeTo(14, 5),
				measuredAscent: expect.closeTo(14 * 0.8, 5),
				fits: false,
			} satisfies TextLayoutResult)
		})

		test('extremely long text does not hang', () => {
			const context = createMockContext(10, 14)
			const extremelyLongText = 'X'.repeat(10000)
			const fontDef = '14px TestFont'

			const startTime = Date.now()
			const result = computeTextLayout(context, 72, 72, [...extremelyLongText], fontDef)
			const elapsed = Date.now() - startTime

			// Should complete in reasonable time (less than 1 second)
			expect(elapsed).toBeLessThan(1000)
			expect(result).toEqual({
				fontDefinition: fontDef,
				lines: [
					{ text: 'XXXXXXX', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) },
					{ text: 'XXXXXXX', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) },
					{ text: 'XXXXXXX', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) },
					{ text: 'XXXXXXX', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) },
					{ text: 'XXXXXXX', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) },
				],
				measuredLineHeight: expect.closeTo(14, 5),
				measuredAscent: expect.closeTo(14 * 0.8, 5),
				fits: false,
			} satisfies TextLayoutResult)
		})

		test('paragraph text wraps correctly', () => {
			const context = createMockContext(8, 12) // 8px per char, 12px line height
			// With w=72, fits 9 chars (72/8=9). Words wrap individually: 'The' (3 chars), 'quick' (5 chars), etc.
			const paragraph = 'The quick brown fox jumps over the lazy dog. ' + 'Pack my box with five dozen liquor jugs.'
			const fontDef = '12px TestFont'
			const result = computeTextLayout(context, 72, 72, [...paragraph], fontDef)

			expect(result).toEqual({
				fontDefinition: fontDef,
				lines: [
					{ text: 'The', ascent: expect.closeTo(12 * 0.8, 5), descent: expect.closeTo(12 * 0.2, 5) },
					{ text: 'quick', ascent: expect.closeTo(12 * 0.8, 5), descent: expect.closeTo(12 * 0.2, 5) },
					{ text: 'brown', ascent: expect.closeTo(12 * 0.8, 5), descent: expect.closeTo(12 * 0.2, 5) },
					{ text: 'fox', ascent: expect.closeTo(12 * 0.8, 5), descent: expect.closeTo(12 * 0.2, 5) },
					{ text: 'jumps', ascent: expect.closeTo(12 * 0.8, 5), descent: expect.closeTo(12 * 0.2, 5) },
				],
				measuredLineHeight: expect.closeTo(12, 5),
				measuredAscent: expect.closeTo(12 * 0.8, 5),
				fits: false,
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
				lines: [{ text: 'AB', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) }],
				measuredLineHeight: expect.closeTo(14, 5),
				measuredAscent: expect.closeTo(14 * 0.8, 5),
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
				lines: [{ text: 'Hello', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) }],
				measuredLineHeight: expect.closeTo(14, 5),
				measuredAscent: expect.closeTo(14 * 0.8, 5),
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
				lines: [{ text: 'Hi', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) }],
				measuredLineHeight: expect.closeTo(14, 5),
				measuredAscent: expect.closeTo(14 * 0.8, 5),
				fits: true,
			} satisfies TextLayoutResult)
		})

		test('height too short for one line still draws it (draw & clip)', () => {
			// #4305: even when a single line does not fit vertically, draw it rather than nothing.
			const context = createMockContext(10, 14)
			const fontDef = '14px TestFont'
			const result = computeTextLayout(context, 72, 13, [...'Hi'], fontDef)

			expect(result).toEqual({
				fontDefinition: fontDef,
				lines: [{ text: 'Hi', ascent: expect.closeTo(14 * 0.8, 5), descent: expect.closeTo(14 * 0.2, 5) }],
				measuredLineHeight: expect.closeTo(14, 5),
				measuredAscent: expect.closeTo(14 * 0.8, 5),
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

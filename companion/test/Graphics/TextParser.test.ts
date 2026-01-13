import { describe, test, expect, vi, beforeEach } from 'vitest'
import {
	resolveFontSizes,
	computeTextLayout,
	segmentTextToUnicodeChars,
	type TextLayoutResult,
} from '../../lib/Graphics/TextParser.js'
import type { CanvasRenderingContext2D } from '@napi-rs/canvas'

// Mock context that simulates measuring text with roughly 10px per character for simplicity
function createMockContext(charWidth: number = 10, lineHeight: number = 14): CanvasRenderingContext2D {
	return {
		font: '',
		measureText: vi.fn((text: string) => ({
			width: text.length * charWidth,
			fontBoundingBoxAscent: lineHeight * 0.8,
			fontBoundingBoxDescent: lineHeight * 0.2,
		})),
	} as unknown as CanvasRenderingContext2D
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
	describe('with auto font size', () => {
		describe('w:72 h:72 (standard button)', () => {
			const w = 72
			const h = 72
			const area = (w * h) / 5000 // ~1.04

			test('very short text returns largest font sizes first', () => {
				// charCount < 7 * area (~7 chars)
				const result = resolveFontSizes(w, h, 'auto', 3)
				expect(result).toEqual([60, 51, 44, 31, 24, 20, 17, 15, 12, 10, 9, 8, 7])
			})

			test('short text returns medium font sizes', () => {
				// charCount < 30 * area (~31 chars)
				const result = resolveFontSizes(w, h, 'auto', 15)
				expect(result).toEqual([31, 24, 20, 17, 15, 12, 10, 9, 8, 7])
			})

			test('medium text returns smaller font sizes', () => {
				// charCount < 40 * area (~42 chars)
				const result = resolveFontSizes(w, h, 'auto', 35)
				expect(result).toEqual([24, 20, 17, 15, 12, 10, 9, 8, 7])
			})

			test('longer text returns even smaller font sizes', () => {
				// charCount < 50 * area (~52 chars)
				const result = resolveFontSizes(w, h, 'auto', 45)
				expect(result).toEqual([17, 15, 12, 10, 9, 8, 7])
			})

			test('very long text returns smallest font sizes', () => {
				// charCount >= 50 * area
				const result = resolveFontSizes(w, h, 'auto', 60)
				expect(result).toEqual([15, 12, 10, 9, 8, 7])
			})

			test('empty text returns largest font sizes', () => {
				const result = resolveFontSizes(w, h, 'auto', 0)
				expect(result).toEqual([60, 51, 44, 31, 24, 20, 17, 15, 12, 10, 9, 8, 7])
			})
		})

		describe('w:144 h:144 (double-size button)', () => {
			const w = 144
			const h = 144
			const area = (w * h) / 5000 // ~4.15

			test('thresholds scale with area', () => {
				// charCount < 7 * area (~29 chars)
				expect(resolveFontSizes(w, h, 'auto', 20)).toEqual([60, 51, 44, 31, 24, 20, 17, 15, 12, 10, 9, 8, 7])

				// charCount < 30 * area (~125 chars)
				expect(resolveFontSizes(w, h, 'auto', 50)).toEqual([31, 24, 20, 17, 15, 12, 10, 9, 8, 7])
			})
		})

		describe('w:360 h:360 (large display)', () => {
			const w = 360
			const h = 360
			const area = (w * h) / 5000 // ~25.9

			test('larger area allows more characters at larger font sizes', () => {
				// charCount < 7 * area (~181 chars)
				expect(resolveFontSizes(w, h, 'auto', 100)).toEqual([60, 51, 44, 31, 24, 20, 17, 15, 12, 10, 9, 8, 7])

				// Even 150 chars still gets the largest sizes
				expect(resolveFontSizes(w, h, 'auto', 150)).toEqual([60, 51, 44, 31, 24, 20, 17, 15, 12, 10, 9, 8, 7])
			})
		})
	})

	describe('with fixed font size', () => {
		test('returns single element array with requested size', () => {
			expect(resolveFontSizes(72, 72, 14, 10)).toEqual([14])
			expect(resolveFontSizes(72, 72, 24, 10)).toEqual([24])
			expect(resolveFontSizes(72, 72, 7, 10)).toEqual([7])
		})

		test('clamps minimum font size to 3', () => {
			expect(resolveFontSizes(72, 72, 1, 10)).toEqual([3])
			expect(resolveFontSizes(72, 72, 2, 10)).toEqual([3])
			expect(resolveFontSizes(72, 72, 0, 10)).toEqual([3])
			expect(resolveFontSizes(72, 72, -5, 10)).toEqual([3])
		})

		test('clamps maximum font size to 120', () => {
			expect(resolveFontSizes(72, 72, 150, 10)).toEqual([120])
			expect(resolveFontSizes(72, 72, 200, 10)).toEqual([120])
			expect(resolveFontSizes(72, 72, 120, 10)).toEqual([120])
		})

		test('passes through edge values', () => {
			expect(resolveFontSizes(72, 72, 3, 10)).toEqual([3])
			expect(resolveFontSizes(72, 72, 119, 10)).toEqual([119])
		})
	})

	describe('font size type coercion', () => {
		test('treats NaN-producing values as auto', () => {
			// NaN values should trigger auto behavior
			expect(resolveFontSizes(72, 72, NaN, 3)).toEqual([60, 51, 44, 31, 24, 20, 17, 15, 12, 10, 9, 8, 7])
		})

		test('treats string numbers as explicit sizes', () => {
			// '14' coerced to 14
			expect(resolveFontSizes(72, 72, '14' as unknown as number, 10)).toEqual([14])
		})
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

		test('very short height', () => {
			const context = createMockContext(10, 14)
			const fontDef = '14px TestFont'
			const result = computeTextLayout(context, 72, 10, [...'Hello'], fontDef)

			expect(result).toEqual({
				fontDefinition: fontDef,
				lines: [],
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

		test('height too short for one line', () => {
			const context = createMockContext(10, 14)
			const fontDef = '14px TestFont'
			const result = computeTextLayout(context, 72, 13, [...'Hi'], fontDef)

			expect(result).toEqual({
				fontDefinition: fontDef,
				lines: [],
				measuredLineHeight: expect.closeTo(14, 5),
				measuredAscent: expect.closeTo(14 * 0.8, 5),
				fits: false,
			} satisfies TextLayoutResult)
		})
	})
})

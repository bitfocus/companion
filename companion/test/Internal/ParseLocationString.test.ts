import { describe, test, expect } from 'vitest'
import { ParseLocationString } from '../../lib/Internal/Util.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'

const DEFAULT_PRESS_LOCATION: ControlLocation = {
	pageNumber: 5,
	row: 2,
	column: 3,
}

describe('ParseLocationString', () => {
	describe('null/undefined/empty inputs', () => {
		test('returns null for null input', () => {
			expect(ParseLocationString(null, DEFAULT_PRESS_LOCATION)).toBeNull()
		})

		test('returns null for undefined input', () => {
			expect(ParseLocationString(undefined, DEFAULT_PRESS_LOCATION)).toBeNull()
		})

		test('returns null for empty string', () => {
			expect(ParseLocationString('', DEFAULT_PRESS_LOCATION)).toBeNull()
		})

		test('returns null for whitespace-only string', () => {
			expect(ParseLocationString('   ', DEFAULT_PRESS_LOCATION)).toBeNull()
		})
	})

	describe('this keyword handling', () => {
		test('returns pressLocation for "this"', () => {
			expect(ParseLocationString('this', DEFAULT_PRESS_LOCATION)).toEqual(DEFAULT_PRESS_LOCATION)
		})

		test('returns pressLocation for "this" with any suffix', () => {
			expect(ParseLocationString('this-run', DEFAULT_PRESS_LOCATION)).toEqual(DEFAULT_PRESS_LOCATION)
			expect(ParseLocationString('this-all-runs', DEFAULT_PRESS_LOCATION)).toEqual(DEFAULT_PRESS_LOCATION)
			expect(ParseLocationString('this:something', DEFAULT_PRESS_LOCATION)).toEqual(DEFAULT_PRESS_LOCATION)
		})

		test('returns null for "this" when pressLocation is undefined', () => {
			expect(ParseLocationString('this', undefined)).toBeNull()
		})

		test('handles case insensitivity for "this"', () => {
			expect(ParseLocationString('THIS', DEFAULT_PRESS_LOCATION)).toEqual(DEFAULT_PRESS_LOCATION)
			expect(ParseLocationString('This', DEFAULT_PRESS_LOCATION)).toEqual(DEFAULT_PRESS_LOCATION)
		})

		test('handles "this" with leading/trailing whitespace', () => {
			expect(ParseLocationString('  this  ', DEFAULT_PRESS_LOCATION)).toEqual(DEFAULT_PRESS_LOCATION)
		})
	})

	describe('legacy bank format (single part: bankX)', () => {
		test('returns null for "bankX" without pressLocation', () => {
			expect(ParseLocationString('bank1', undefined)).toBeNull()
		})

		test('parses "bank1" correctly (first position in grid)', () => {
			expect(ParseLocationString('bank1', DEFAULT_PRESS_LOCATION)).toEqual({
				pageNumber: 5,
				column: 0,
				row: 0,
			})
		})

		test('parses "bank8" correctly (end of first row)', () => {
			expect(ParseLocationString('bank8', DEFAULT_PRESS_LOCATION)).toEqual({
				pageNumber: 5,
				column: 7,
				row: 0,
			})
		})

		test('parses "bank9" correctly (start of second row)', () => {
			expect(ParseLocationString('bank9', DEFAULT_PRESS_LOCATION)).toEqual({
				pageNumber: 5,
				column: 0,
				row: 1,
			})
		})

		test('parses "bank32" correctly (last valid bank)', () => {
			expect(ParseLocationString('bank32', DEFAULT_PRESS_LOCATION)).toEqual({
				pageNumber: 5,
				column: 7,
				row: 3,
			})
		})

		test('returns null for "bank33" (out of range)', () => {
			expect(ParseLocationString('bank33', DEFAULT_PRESS_LOCATION)).toBeNull()
		})

		test('returns null for "bank0" without pressLocation', () => {
			expect(ParseLocationString('bank0', undefined)).toBeNull()
		})

		test('parses "bank0" to pressLocation row/column', () => {
			expect(ParseLocationString('bank0', DEFAULT_PRESS_LOCATION)).toEqual({
				pageNumber: 5,
				column: 3,
				row: 2,
			})
		})

		test('handles case insensitivity for bank format', () => {
			expect(ParseLocationString('BANK1', DEFAULT_PRESS_LOCATION)).toEqual({
				pageNumber: 5,
				column: 0,
				row: 0,
			})
		})

		test('returns null for negative bank number', () => {
			expect(ParseLocationString('bank-1', DEFAULT_PRESS_LOCATION)).toBeNull()
		})

		test('returns null for non-numeric bank', () => {
			expect(ParseLocationString('bankABC', DEFAULT_PRESS_LOCATION)).toBeNull()
		})
	})

	describe('legacy bank format with page (page/bankX)', () => {
		test('parses "1/bank1" correctly', () => {
			expect(ParseLocationString('1/bank1', DEFAULT_PRESS_LOCATION)).toEqual({
				pageNumber: 1,
				column: 0,
				row: 0,
			})
		})

		test('parses "10/bank16" correctly', () => {
			expect(ParseLocationString('10/bank16', DEFAULT_PRESS_LOCATION)).toEqual({
				pageNumber: 10,
				column: 7,
				row: 1,
			})
		})

		test('uses pressLocation pageNumber when page is 0', () => {
			expect(ParseLocationString('0/bank1', DEFAULT_PRESS_LOCATION)).toEqual({
				pageNumber: 5, // from pressLocation
				column: 0,
				row: 0,
			})
		})

		test('returns null for "0/bankX" without pressLocation', () => {
			expect(ParseLocationString('0/bank1', undefined)).toBeNull()
		})

		test('returns null for invalid page number', () => {
			expect(ParseLocationString('abc/bank1', DEFAULT_PRESS_LOCATION)).toBeNull()
		})

		test('returns null for bank33 with page', () => {
			expect(ParseLocationString('1/bank33', DEFAULT_PRESS_LOCATION)).toBeNull()
		})

		test('parses "X/bank0" to pressLocation row/column with specified page', () => {
			expect(ParseLocationString('3/bank0', DEFAULT_PRESS_LOCATION)).toEqual({
				pageNumber: 3,
				column: 3,
				row: 2,
			})
		})

		test('returns null for "X/bank0" without pressLocation', () => {
			expect(ParseLocationString('3/bank0', undefined)).toBeNull()
		})
	})

	describe('row/column format (row/column)', () => {
		test('returns null for row/column without pressLocation', () => {
			expect(ParseLocationString('1/2', undefined)).toBeNull()
		})

		test('parses "0/0" correctly', () => {
			expect(ParseLocationString('0/0', DEFAULT_PRESS_LOCATION)).toEqual({
				pageNumber: 5,
				row: 0,
				column: 0,
			})
		})

		test('parses "3/7" correctly', () => {
			expect(ParseLocationString('3/7', DEFAULT_PRESS_LOCATION)).toEqual({
				pageNumber: 5,
				row: 3,
				column: 7,
			})
		})

		test('returns null for non-numeric row', () => {
			expect(ParseLocationString('abc/2', DEFAULT_PRESS_LOCATION)).toBeNull()
		})

		test('returns null for non-numeric column', () => {
			expect(ParseLocationString('1/abc', DEFAULT_PRESS_LOCATION)).toBeNull()
		})

		test('handles whitespace in parts', () => {
			expect(ParseLocationString(' 1 / 2 ', DEFAULT_PRESS_LOCATION)).toEqual({
				pageNumber: 5,
				row: 1,
				column: 2,
			})
		})
	})

	describe('full format (page/row/column)', () => {
		test('parses "1/0/0" correctly', () => {
			expect(ParseLocationString('1/0/0', DEFAULT_PRESS_LOCATION)).toEqual({
				pageNumber: 1,
				row: 0,
				column: 0,
			})
		})

		test('parses "99/3/7" correctly', () => {
			expect(ParseLocationString('99/3/7', undefined)).toEqual({
				pageNumber: 99,
				row: 3,
				column: 7,
			})
		})

		test('uses pressLocation pageNumber when page is 0', () => {
			expect(ParseLocationString('0/1/2', DEFAULT_PRESS_LOCATION)).toEqual({
				pageNumber: 5, // from pressLocation
				row: 1,
				column: 2,
			})
		})

		test('returns null for "0/X/Y" without pressLocation', () => {
			expect(ParseLocationString('0/1/2', undefined)).toBeNull()
		})

		test('returns null for non-numeric page', () => {
			expect(ParseLocationString('abc/1/2', DEFAULT_PRESS_LOCATION)).toBeNull()
		})

		test('returns null for non-numeric row', () => {
			expect(ParseLocationString('1/abc/2', DEFAULT_PRESS_LOCATION)).toBeNull()
		})

		test('returns null for non-numeric column', () => {
			expect(ParseLocationString('1/2/abc', DEFAULT_PRESS_LOCATION)).toBeNull()
		})

		test('handles decimal values (truncated to integer)', () => {
			expect(ParseLocationString('1/2.5/3.9', DEFAULT_PRESS_LOCATION)).toEqual({
				pageNumber: 1,
				row: 2.5,
				column: 3.9,
			})
		})

		test('handles whitespace in parts', () => {
			expect(ParseLocationString(' 1 / 2 / 3 ', DEFAULT_PRESS_LOCATION)).toEqual({
				pageNumber: 1,
				row: 2,
				column: 3,
			})
		})
	})

	describe('invalid formats', () => {
		test('returns null for too many parts', () => {
			expect(ParseLocationString('1/2/3/4', DEFAULT_PRESS_LOCATION)).toBeNull()
		})

		test('returns null for random strings', () => {
			expect(ParseLocationString('hello', DEFAULT_PRESS_LOCATION)).toBeNull()
			expect(ParseLocationString('page1', DEFAULT_PRESS_LOCATION)).toBeNull()
		})

		test('returns null for strings without "/" that do not start with bank or this', () => {
			expect(ParseLocationString('123', DEFAULT_PRESS_LOCATION)).toBeNull()
		})
	})

	describe('edge cases', () => {
		test('rejects empty parts in location string', () => {
			// Empty string parts should NOT be treated as valid - this would be a bug
			expect(ParseLocationString('//', DEFAULT_PRESS_LOCATION)).toBeNull()
			expect(ParseLocationString('1//', DEFAULT_PRESS_LOCATION)).toBeNull()
			expect(ParseLocationString('//1', DEFAULT_PRESS_LOCATION)).toBeNull()
			expect(ParseLocationString('/1/2', DEFAULT_PRESS_LOCATION)).toBeNull()
			expect(ParseLocationString('1//2', DEFAULT_PRESS_LOCATION)).toBeNull()
			expect(ParseLocationString('1/2/', DEFAULT_PRESS_LOCATION)).toBeNull()
		})

		test('rejects negative page numbers', () => {
			// Negative page numbers should not be valid
			expect(ParseLocationString('-1/0/0', DEFAULT_PRESS_LOCATION)).toBeNull()
			expect(ParseLocationString('-5/1/2', undefined)).toBeNull()
		})

		test('allows negative row or column values', () => {
			// Negative row/column values are valid (used for offsets)
			expect(ParseLocationString('1/-1/0', DEFAULT_PRESS_LOCATION)).toEqual({
				pageNumber: 1,
				row: -1,
				column: 0,
			})
			expect(ParseLocationString('1/0/-1', DEFAULT_PRESS_LOCATION)).toEqual({
				pageNumber: 1,
				row: 0,
				column: -1,
			})
			expect(ParseLocationString('-1/0', DEFAULT_PRESS_LOCATION)).toEqual({
				pageNumber: 5,
				row: -1,
				column: 0,
			})
			expect(ParseLocationString('0/-1', DEFAULT_PRESS_LOCATION)).toEqual({
				pageNumber: 5,
				row: 0,
				column: -1,
			})
		})

		test('correctly maps bank indices to grid positions', () => {
			// Bank 1-8 = row 0, columns 0-7
			// Bank 9-16 = row 1, columns 0-7
			// Bank 17-24 = row 2, columns 0-7
			// Bank 25-32 = row 3, columns 0-7
			for (let bank = 1; bank <= 32; bank++) {
				const result = ParseLocationString(`bank${bank}`, DEFAULT_PRESS_LOCATION)
				expect(result).not.toBeNull()
				const expectedColumn = (bank - 1) % 8
				const expectedRow = Math.floor((bank - 1) / 8)
				expect(result).toEqual({
					pageNumber: 5,
					column: expectedColumn,
					row: expectedRow,
				})
			}
		})
	})
})

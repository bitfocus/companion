import { describe, expect, test } from 'vitest'
import {
	CreateBankControlId,
	CreateExpressionVariableControlId,
	CreatePageControlId,
	CreatePresetControlId,
	CreateTriggerControlId,
	formatLocation,
	oldBankIndexToXY,
	ParseControlId,
	validateActionSetId,
	xyToOldBankIndex,
} from '../ControlId.js'

// ── formatLocation ────────────────────────────────────────────────────────────

describe('formatLocation', () => {
	test('formats a fully-specified location', () => {
		expect(formatLocation({ pageNumber: 1, row: 2, column: 3 })).toBe('1/2/3')
	})

	test('replaces undefined components with "?"', () => {
		expect(formatLocation({ pageNumber: undefined as any, row: undefined as any, column: undefined as any })).toBe(
			'?/?/?'
		)
	})

	test('replaces only missing components with "?"', () => {
		expect(formatLocation({ pageNumber: 5, row: undefined as any, column: 1 })).toBe('5/?/1')
	})
})

// ── oldBankIndexToXY ──────────────────────────────────────────────────────────

describe('oldBankIndexToXY', () => {
	test('bank 1 → top-left corner [0, 0]', () => {
		expect(oldBankIndexToXY(1)).toEqual([0, 0])
	})

	test('bank 8 → end of first row [7, 0]', () => {
		expect(oldBankIndexToXY(8)).toEqual([7, 0])
	})

	test('bank 9 → start of second row [0, 1]', () => {
		expect(oldBankIndexToXY(9)).toEqual([0, 1])
	})

	test('bank 32 → bottom-right corner [7, 3]', () => {
		expect(oldBankIndexToXY(32)).toEqual([7, 3])
	})

	test('bank 0 is out of range → null', () => {
		expect(oldBankIndexToXY(0)).toBeNull()
	})

	test('bank 33 is out of range → null', () => {
		expect(oldBankIndexToXY(33)).toBeNull()
	})

	test('NaN input → null', () => {
		expect(oldBankIndexToXY(NaN)).toBeNull()
	})
})

// ── xyToOldBankIndex ──────────────────────────────────────────────────────────

describe('xyToOldBankIndex', () => {
	test('top-left [0, 0] → bank 1', () => {
		expect(xyToOldBankIndex(0, 0)).toBe(1)
	})

	test('bottom-right [7, 3] → bank 32', () => {
		expect(xyToOldBankIndex(7, 3)).toBe(32)
	})

	test('roundtrips with oldBankIndexToXY', () => {
		for (let bank = 1; bank <= 32; bank++) {
			const xy = oldBankIndexToXY(bank)!
			expect(xyToOldBankIndex(xy[0], xy[1])).toBe(bank)
		}
	})

	test('x out of range (>= 8) → null', () => {
		expect(xyToOldBankIndex(8, 0)).toBeNull()
	})

	test('y out of range (>= 4) → null', () => {
		expect(xyToOldBankIndex(0, 4)).toBeNull()
	})

	test('negative x → null', () => {
		expect(xyToOldBankIndex(-1, 0)).toBeNull()
	})

	test('negative y → null', () => {
		expect(xyToOldBankIndex(0, -1)).toBeNull()
	})
})

// ── Create* functions ─────────────────────────────────────────────────────────

describe('CreateBankControlId', () => {
	test('prefixes id with "bank:"', () => {
		expect(CreateBankControlId('abc-123')).toBe('bank:abc-123')
	})
})

describe('CreateTriggerControlId', () => {
	test('prefixes id with "trigger:"', () => {
		expect(CreateTriggerControlId('t-99')).toBe('trigger:t-99')
	})
})

describe('CreateExpressionVariableControlId', () => {
	test('prefixes id with "expression-variable:"', () => {
		expect(CreateExpressionVariableControlId('myVar')).toBe('expression-variable:myVar')
	})
})

describe('CreatePageControlId', () => {
	test('prefixes id with "page:"', () => {
		expect(CreatePageControlId('page-abc')).toBe('page:page-abc')
	})

	test('roundtrips through ParseControlId', () => {
		const pageId = 'nanoid-1234'
		expect(ParseControlId(CreatePageControlId(pageId))).toEqual({ type: 'page', pageId })
	})
})

describe('CreatePresetControlId', () => {
	test('joins connectionId, presetId, variablesHash with colons', () => {
		expect(CreatePresetControlId('conn1', 'btn_01', 'abc')).toBe('preset:conn1:btn_01:abc')
	})
})

// ── ParseControlId ────────────────────────────────────────────────────────────

describe('ParseControlId', () => {
	test('parses a bank control id', () => {
		expect(ParseControlId('bank:myButton')).toEqual({ type: 'bank', control: 'myButton' })
	})

	test('parses a trigger control id', () => {
		expect(ParseControlId('trigger:t-123')).toEqual({ type: 'trigger', trigger: 't-123' })
	})

	test('parses an expression-variable control id', () => {
		expect(ParseControlId('expression-variable:myVar')).toEqual({
			type: 'expression-variable',
			variableId: 'myVar',
		})
	})

	test('parses a page control id', () => {
		expect(ParseControlId('page:page-abc')).toEqual({ type: 'page', pageId: 'page-abc' })
	})

	test('parses a preset control id', () => {
		expect(ParseControlId('preset:conn1:btn_01:abc123')).toEqual({
			type: 'preset',
			connectionId: 'conn1',
			presetId: 'btn_01',
			variablesHash: 'abc123',
		})
	})

	test('preset: colons in presetId are captured correctly (greedy middle group)', () => {
		// connectionId is non-greedy (stops at first colon)
		// presetId captures everything up to the last colon
		expect(ParseControlId('preset:conn:a:b:c:hash')).toEqual({
			type: 'preset',
			connectionId: 'conn',
			presetId: 'a:b:c',
			variablesHash: 'hash',
		})
	})

	test('returns undefined for an unknown prefix', () => {
		expect(ParseControlId('unknown:xyz')).toBeUndefined()
	})

	test('returns undefined for a non-string input', () => {
		// @ts-expect-error — testing runtime safety
		expect(ParseControlId(42)).toBeUndefined()
	})

	test('returns undefined for an empty string', () => {
		expect(ParseControlId('')).toBeUndefined()
	})
})

// ── validateActionSetId ───────────────────────────────────────────────────────

describe('validateActionSetId', () => {
	test('"down" passes through unchanged', () => {
		expect(validateActionSetId('down')).toBe('down')
	})

	test('"up" passes through unchanged', () => {
		expect(validateActionSetId('up')).toBe('up')
	})

	test('"rotate_left" passes through unchanged', () => {
		expect(validateActionSetId('rotate_left')).toBe('rotate_left')
	})

	test('"rotate_right" passes through unchanged', () => {
		expect(validateActionSetId('rotate_right')).toBe('rotate_right')
	})

	test('numeric string is coerced to a number', () => {
		expect(validateActionSetId('5' as any)).toBe(5)
	})

	test('invalid string → undefined', () => {
		expect(validateActionSetId('unknown' as any)).toBeUndefined()
	})

	test('number passes through unchanged', () => {
		expect(validateActionSetId(3)).toBe(3)
	})

	test('zero passes through unchanged', () => {
		expect(validateActionSetId(0)).toBe(0)
	})
})

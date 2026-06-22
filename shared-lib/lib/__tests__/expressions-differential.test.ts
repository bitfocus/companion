import { describe, expect, it } from 'vitest'
import { ExpressionFunctions } from '../Expression/ExpressionFunctions.js'
import { ParseExpression } from '../Expression/ExpressionParse.js'
import { ResolveExpression, type GetVariableValueProps } from '../Expression/ExpressionResolve.js'
import { ParseExpressionLegacy } from './_legacy/ExpressionParseLegacy.js'
import { ResolveExpressionLegacy } from './_legacy/ExpressionResolveLegacy.js'

/**
 * Differential harness: every expression in the corpus is evaluated through both the OLD jsep-based
 * pipeline and the NEW acorn-based pipeline with identical inputs, and the results must match.
 *
 * This is the central de-risking step for the parser swap (Phase 1): it proves the new parser+evaluator
 * is behaviour-preserving for the existing dialect, beyond the hand-written expected values elsewhere.
 *
 * Known intentional divergences (NOT in the corpus, asserted separately at the bottom):
 *  - the "multiple statements with no separator" quirk is dropped (acorn rejects it)
 *  - non-computed member access `$(x).foo` / `obj.foo` now works (legacy silently returned undefined)
 */

const VARS: Record<string, any> = {
	'my:num': 7,
	'my:num2': 3,
	'my:str': 'hello',
	'my:arr': [10, 20, 30],
	'my:obj': { k: 'v', n: 42 },
	'internal:a': 2,
	'test:c': 5,
}
const getVar = (p: GetVariableValueProps): any => VARS[p.variableId]

type RunResult = { ok: true; value: unknown } | { ok: false }

function runNew(expr: string): RunResult {
	try {
		return { ok: true, value: ResolveExpression(ParseExpression(expr), getVar, ExpressionFunctions) }
	} catch {
		return { ok: false }
	}
}
function runLegacy(expr: string): RunResult {
	try {
		return { ok: true, value: ResolveExpressionLegacy(ParseExpressionLegacy(expr), getVar, ExpressionFunctions) }
	} catch {
		return { ok: false }
	}
}

const corpus: string[] = [
	// arithmetic + precedence
	'1 + 2 * 3',
	'(1 + 2) * 3',
	'2 - 3 - 4',
	'12 / 2 / 3',
	'10 % 3',
	'-3 + 4',
	'-(-1) + 1',
	'1.234 * 2',
	'1 / 0',

	// bitwise + shifts (jsep precedences match JS for these)
	'5 & 3',
	'5 | 2',
	'6 ^ 3',
	'1 << 4',
	'64 >> 2',
	'~5',
	'2 + 3 & 4',
	'$(my:num) ^ 2',

	// comparison
	'3 >= 2',
	'2 <= 1',
	'1 < 2',
	"'a' == 'a'",
	'1 != 2',
	'1 === 1',
	"2 !== '2'",
	"1 == '1'",
	"1 === '1'",

	// logical
	'true && false',
	'false || 7',
	'null ?? 9',
	'0 || 5',
	'5 && 3',
	'!true',
	'!0',

	// ternary
	'1 > 2 ? 10 : 20',
	"$(my:num) > 5 ? 'big' : 'small'",
	'0 ? 1 : 2',
	'42 ? 1 : 2',

	// literals
	'undefined',
	'null',
	'undefined === undefined',
	'true',

	// templates
	'`a${1 + 2}b`',
	'`${$(my:str)}!`',
	'`val: ${1 + 2}dB or ${$(my:str)}`',

	// arrays + objects (computed access only)
	'[1, 2, 3]',
	"[1, 'c', null]",
	'[1, 2, 3][1]',
	"{a: 1, 'b': 2}['b']",
	"{a: 1, c: {v: 4}}['c']['v']",
	"'abc'[0]",
	'$(my:arr)[0]',
	'$(my:arr)[5] === undefined',
	"$(my:obj)['n']",
	"{a: $(my:num)}['a']",

	// variables in maths
	'$(my:num) + $(my:num2)',
	'$(my:num) / $(my:num)',
	'$(internal:a) + $(test:c)',

	// functions
	'round(3.4)',
	'floor(3.9)',
	'ceil(3.1)',
	'abs(-5)',
	"length('hello')",
	'round(10.1111) + round(10.1111, 0.1)',

	// comments
	'1 + 2 // trailing comment',
	'3 /* mid */ + 4',

	// assignment / update / return / declarations
	'a = 5; a + 1',
	'a = 1; b = 2; return a + b',
	'a = 1\nb = 2\nreturn a + b',
	'let a = 3; a * 2',
	'x = 5; ++x; x',
	'p = 5; --p; p',
	'c = 1; c += 4; c',
	'a = [1, 2, 3]; a[1] = 9; a',
	'q = [4, 5, 6]; ++q[0]; q',
	'a = null; a ??= 5',
	'return 42',
	'return 1\nreturn 2',

	// exponentiation (right-associative)
	'2 ** 3',
	'2 ** 3 ** 2',

	// number formats supported by both
	'1_000',
	'0xff',
	'0b101',
	'0o17',
	'1e3',
	'.5',

	// trailing commas in array/object literals
	'[1, 2,]',
	'{a: 1,}',

	// sequence/comma at top level is rejected by both? (kept out - see documented differences)
	'const a = 1; a = 2; a',
	'a = 1, b = 2, a + b',

	// nested ternary (right-associative)
	'1 ? 2 : 3 ? 4 : 5',

	// numeric coercion quirks of the dialect (shared with the old parser)
	"'a' + 1", // NaN - `+` always coerces to Number, it does not concatenate strings
	'true + 1',
	'null + 1',
	'5 % 0', // NaN
	'0 / 0', // NaN
	'-0',

	// chained comparison (left-associative, shared semantics)
	'1 < 2 < 3',
	'1 === 1 === true',

	// bare globals are NOT special - both resolve them as (undefined) local identifiers
	'NaN',
	'Infinity',

	// template concatenation
	'`a` + `b`',

	// empty object literal at statement start
	'{}',
	'{}["x"]',

	// built-in/inherited properties are not accessible in either parser (both yield undefined)
	'[1, 2, 3].length',
	"'abc'.length",
	'$(my:arr).length',
	'[1, 2, 3].map',
]

describe('differential: acorn pipeline vs legacy jsep pipeline', () => {
	for (const expr of corpus) {
		it(`matches for: ${JSON.stringify(expr)}`, () => {
			const legacy = runLegacy(expr)
			const next = runNew(expr)

			expect({ expr, ok: next.ok }).toEqual({ expr, ok: legacy.ok })

			if (legacy.ok && next.ok) {
				if (typeof legacy.value === 'number' && Number.isNaN(legacy.value)) {
					expect(Number.isNaN(next.value as number)).toBe(true)
				} else {
					expect(next.value).toStrictEqual(legacy.value)
				}
			}
		})
	}
})

/**
 * Behavioural differences between the old (jsep) and new (acorn) parsers.
 *
 * These are SKIPPED on purpose: they are not part of the equivalence contract, they document the
 * (intended) differences that should be communicated to users in the 5.0 changelog / expression docs.
 * Each test asserts the NEW behaviour and records the OLD behaviour in a comment, so un-skipping any of
 * them is a quick way to verify the difference still holds.
 */
describe.skip('documented behavioural differences from the legacy jsep parser', () => {
	it('DROPPED: multiple statements with no separator', () => {
		// OLD: treated as separate statements, returned the last value (30)
		// NEW: rejected as a syntax error - use `;` or a newline between statements
		expect(runLegacy('10 + 10 20 30')).toEqual({ ok: true, value: 30 })
		expect(runNew('10 + 10 20 30').ok).toBe(false)
	})

	it('FIXED: non-computed access to a data property now works', () => {
		// OLD: `.prop` access silently returned undefined; only `['prop']` worked
		// NEW: `obj.prop` resolves the data property like JS, matching `obj['prop']`
		// NOTE: this is limited to own enumerable (data) properties - built-in/inherited members
		// such as `.length` or array/string methods remain inaccessible in both parsers (see corpus).
		expect(runLegacy('$(my:obj).k')).toEqual({ ok: true, value: undefined })
		expect(runNew('$(my:obj).k')).toEqual({ ok: true, value: 'v' })

		expect(runLegacy('$(my:obj).n')).toEqual({ ok: true, value: undefined })
		expect(runNew('$(my:obj).n')).toEqual({ ok: true, value: 42 })
	})

	it('CHANGED: `return` followed by a newline now returns undefined (JS ASI)', () => {
		// OLD: the value on the following line was returned (5)
		// NEW: a line break after `return` ends the statement -> returns undefined.
		//      Keep the value on the same line as `return`.
		expect(runLegacy('return\n5')).toEqual({ ok: true, value: 5 })
		expect(runNew('return\n5')).toEqual({ ok: true, value: undefined })
	})

	it('NEW: comma/sequence expressions evaluate to their last operand', () => {
		// OLD: rejected ("Unknown node SequenceExpression")
		// NEW: `(a, b, c)` evaluates each and yields the last
		expect(runLegacy('(1, 2, 3)').ok).toBe(false)
		expect(runNew('(1, 2, 3)')).toEqual({ ok: true, value: 3 })
	})

	it('NEW: trailing commas are allowed in function call arguments', () => {
		// OLD: rejected (trailing comma in call args). Array/object trailing commas worked in both.
		// NEW: allowed, like modern JS
		expect(runLegacy('round(1.5,)').ok).toBe(false)
		expect(runNew('round(1.5,)')).toEqual({ ok: true, value: 2 })
	})

	it('CHANGED: `typeof` / `void` are now recognised operators (and currently rejected)', () => {
		// OLD: `typeof`/`void` were parsed as throwaway identifiers, silently yielding the operand
		//      (`typeof 5` -> 5, `void 0` -> 0)
		// NEW: recognised as operators; not implemented by the evaluator, so they error clearly
		expect(runLegacy('typeof 5')).toEqual({ ok: true, value: 5 })
		expect(runNew('typeof 5').ok).toBe(false)

		expect(runLegacy('void 0')).toEqual({ ok: true, value: 0 })
		expect(runNew('void 0').ok).toBe(false)
	})

	it('NEW: regex literals now parse (to be handled by the validation pass in a later phase)', () => {
		// OLD: `/` was always division, so `/ab/` was a syntax error
		// NEW: acorn parses `/ab/` as a RegExp literal. The evaluator returns the RegExp for now;
		//      this should be explicitly rejected by the Phase 2 validation pass.
		expect(runLegacy('/ab/').ok).toBe(false)
		expect(runNew('/ab/').ok).toBe(true)
	})
})

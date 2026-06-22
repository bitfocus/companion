import { describe, expect, it } from 'vitest'
import { ExpressionFunctions } from '../Expression/ExpressionFunctions.js'
import { ParseExpression } from '../Expression/ExpressionParse.js'
import { ResolveExpression, type GetVariableValueProps } from '../Expression/ExpressionResolve.js'

/**
 * Regression corpus for the existing expression dialect: a broad spread of operators, precedence,
 * literals, templates, objects/arrays, assignment and the data-only member model, each pinned to its
 * expected value. These values were verified during the jsep -> acorn migration to match the previous
 * engine exactly; this guards against accidental changes to the core evaluation semantics.
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

function evaluate(expr: string): unknown {
	return ResolveExpression(ParseExpression(expr), getVar, ExpressionFunctions)
}
function isInvalid(expr: string): boolean {
	try {
		ParseExpression(expr)
		ResolveExpression(ParseExpression(expr), getVar, ExpressionFunctions)
		return false
	} catch {
		return true
	}
}

const corpus: Array<[string, unknown]> = [
	// arithmetic + precedence
	['1 + 2 * 3', 7],
	['(1 + 2) * 3', 9],
	['2 - 3 - 4', -5],
	['12 / 2 / 3', 2],
	['10 % 3', 1],
	['-3 + 4', 1],
	['-(-1) + 1', 2],
	['1.234 * 2', 2.468],
	['1 / 0', Infinity],

	// bitwise + shifts
	['5 & 3', 1],
	['5 | 2', 7],
	['6 ^ 3', 5],
	['1 << 4', 16],
	['64 >> 2', 16],
	['~5', -6],
	['2 + 3 & 4', 4],
	['$(my:num) ^ 2', 5],

	// comparison
	['3 >= 2', true],
	['2 <= 1', false],
	['1 < 2', true],
	["'a' == 'a'", true],
	['1 != 2', true],
	['1 === 1', true],
	["2 !== '2'", true],
	["1 == '1'", true],
	["1 === '1'", false],

	// logical
	['true && false', false],
	['false || 7', 7],
	['null ?? 9', 9],
	['0 || 5', 5],
	['5 && 3', 3],
	['!true', false],
	['!0', true],

	// ternary
	['1 > 2 ? 10 : 20', 20],
	["$(my:num) > 5 ? 'big' : 'small'", 'big'],
	['0 ? 1 : 2', 2],
	['42 ? 1 : 2', 1],

	// literals
	['undefined', undefined],
	['null', null],
	['undefined === undefined', true],
	['true', true],

	// templates
	['`a${1 + 2}b`', 'a3b'],
	['`${$(my:str)}!`', 'hello!'],
	['`val: ${1 + 2}dB or ${$(my:str)}`', 'val: 3dB or hello'],

	// arrays + objects (computed access)
	['[1, 2, 3]', [1, 2, 3]],
	["[1, 'c', null]", [1, 'c', null]],
	['[1, 2, 3][1]', 2],
	["{a: 1, 'b': 2}['b']", 2],
	["{a: 1, c: {v: 4}}['c']['v']", 4],
	["'abc'[0]", 'a'],
	['$(my:arr)[0]', 10],
	['$(my:arr)[5] === undefined', true],
	["$(my:obj)['n']", 42],
	["{a: $(my:num)}['a']", 7],

	// variables in maths
	['$(my:num) + $(my:num2)', 10],
	['$(my:num) / $(my:num)', 1],
	['$(internal:a) + $(test:c)', 7],

	// functions
	['round(3.4)', 3],
	['floor(3.9)', 3],
	['ceil(3.1)', 4],
	['abs(-5)', 5],
	["length('hello')", 5],
	['round(10.1111) + round(10.1111, 0.1)', 20],

	// comments
	['1 + 2 // trailing comment', 3],
	['3 /* mid */ + 4', 7],

	// assignment / update / return / declarations
	['a = 5; a + 1', 6],
	['a = 1; b = 2; return a + b', 3],
	['a = 1\nb = 2\nreturn a + b', 3],
	['let a = 3; a * 2', 6],
	['x = 5; ++x; x', 6],
	['p = 5; --p; p', 4],
	['c = 1; c += 4; c', 5],
	['a = [1, 2, 3]; a[1] = 9; a', [1, 9, 3]],
	['q = [4, 5, 6]; ++q[0]; q', [5, 5, 6]],
	['a = null; a ??= 5', 5],
	['return 42', 42],
	['return 1\nreturn 2', 1],

	// exponentiation (right-associative)
	['2 ** 3', 8],
	['2 ** 3 ** 2', 512],

	// number formats
	['1_000', 1000],
	['0xff', 255],
	['0b101', 5],
	['0o17', 15],
	['1e3', 1000],
	['.5', 0.5],

	// trailing commas in array/object literals
	['[1, 2,]', [1, 2]],
	['{a: 1,}', { a: 1 }],

	// comma/sequence assignment chain
	['a = 1, b = 2, a + b', 3],

	// nested ternary (right-associative)
	['1 ? 2 : 3 ? 4 : 5', 2],

	// numeric coercion quirks of the dialect
	["'a' + 1", NaN], // `+` always coerces to Number, it does not concatenate strings
	['true + 1', 2],
	['null + 1', 1],
	['5 % 0', NaN],
	['0 / 0', NaN],
	['-0', -0],

	// chained comparison (left-associative)
	['1 < 2 < 3', true],
	['1 === 1 === true', true],

	// bare globals are NOT special - resolved as (undefined) local identifiers
	['NaN', undefined],
	['Infinity', undefined],

	// template "concatenation" (numeric + coerces both to Number)
	['`a` + `b`', NaN],

	// object literals at statement start
	['{}', {}],
	['{}["x"]', undefined],

	// built-in/inherited properties are not accessible (data-only member model)
	['[1, 2, 3].length', undefined],
	["'abc'.length", undefined],
	['$(my:arr).length', undefined],
	['[1, 2, 3].map', undefined],
]

describe('expression evaluation corpus', () => {
	for (const [expr, expected] of corpus) {
		it(`evaluates ${JSON.stringify(expr)}`, () => {
			expect(evaluate(expr)).toStrictEqual(expected)
		})
	}
})

/**
 * Behaviour changes introduced in Companion 5.0 when the engine moved to a standard JS parser.
 * Each asserts the new behaviour; the old (jsep) behaviour is noted in a comment for the changelog.
 */
describe('Companion 5.0 behaviour changes', () => {
	it('rejects multiple statements with no separator (was: returned the last, 30)', () => {
		expect(isInvalid('10 + 10 20 30')).toBe(true)
	})

	it('reads a data property via dot access (was: undefined, only bracket access worked)', () => {
		expect(evaluate('$(my:obj).k')).toBe('v')
		expect(evaluate('$(my:obj).n')).toBe(42)
	})

	it('`return` followed by a newline returns undefined (was: returned the next line, 5)', () => {
		expect(evaluate('return\n5')).toBeUndefined()
	})

	it('evaluates comma/sequence expressions to the last operand (was: rejected)', () => {
		expect(evaluate('(1, 2, 3)')).toBe(3)
	})

	it('allows trailing commas in function call arguments (was: rejected)', () => {
		expect(evaluate('round(1.5,)')).toBe(2)
	})

	it('rejects `typeof` / `void` (was: parsed as throwaway identifiers, yielding the operand)', () => {
		expect(isInvalid('typeof 5')).toBe(true)
		expect(isInvalid('void 0')).toBe(true)
	})

	it('enforces `const` (was: reassignment silently allowed)', () => {
		expect(isInvalid('const a = 1; a = 2')).toBe(true)
	})

	it('rejects regular-expression literals (was: a syntax error from `/` being division)', () => {
		expect(isInvalid('/ab/')).toBe(true)
	})
})

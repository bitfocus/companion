import { describe, expect, it } from 'vitest'
import { FindAllReferencedVariables, ParseExpression } from '../Expression/ExpressionParse.js'

// Note: the expression dialect is now parsed with acorn, producing a standard ESTree `Program`.
// These tests cover parsing behaviour at the level that matters to consumers: whether an expression
// parses at all, and which Companion variables it references. The exact AST shape is an implementation
// detail of acorn and is not asserted here; behavioural equivalence with the previous parser is proven
// by expressions-resolver.test.ts and expressions-differential.test.ts.

function referencedVariables(str: string): string[] {
	return FindAllReferencedVariables(ParseExpression(str))
}

function parses(str: string): boolean {
	try {
		ParseExpression(str)
		return true
	} catch {
		return false
	}
}

describe('parser', () => {
	describe('parses valid expressions', () => {
		const valid = [
			'1 + 2',
			'1 + 2 * 3',
			'((2 + 2) * 3 / 4) ^ 3 % 2',
			'-1 + -2',
			'--1 + 1',
			'-(-1) + 1',
			'1.234 * 2',
			'(1 > 2) ? 3 : 4',
			'true && false || 5',
			'null ?? 7',
			'`val: ${1 + 2}dB`',
			'`${$(some:var)} and ${$(another:var)}`',
			"{ a: 1, b: { c: 3 } }['d']",
			'[0, 1, 2][1]',
			"$(my:variable)['d']",
			'$(my:variable).d',
			'round(10.1)',
			'round(10.1111, 0.1)',
			'1 + 2 // trailing comment',
			'1 /* mid */ + 2',
			'a = 1; b = 2; return a + b',
			'a = 1\nb = 2\nreturn a + b',
			'let a = 5; a + 1',
			'return 1',
			'return (1 / 2)',
			'a = [4, 5, 6]; a[1] = 2; return a',
			'a = 5; ++a; a',
			'undefined',
			'null',
		]
		for (const expr of valid) {
			it(`parses: ${JSON.stringify(expr)}`, () => {
				expect(parses(expr)).toBe(true)
			})
		}

		it('produces a Program node', () => {
			expect(ParseExpression('1 + 2').type).toBe('Program')
		})
	})

	describe('syntax errors', () => {
		const invalid = [
			'1 +',
			'(1 + 2',
			'@', // invalid token
			'10 + 10 20 30', // no-separator multi-statement quirk - dropped in 5.0
			'$(unclosed',
		]
		for (const expr of invalid) {
			it(`rejects: ${JSON.stringify(expr)}`, () => {
				expect(parses(expr)).toBe(false)
			})
		}
	})

	describe('referenced variables', () => {
		it('none for a plain expression', () => {
			expect(referencedVariables('1 + 2')).toEqual([])
		})

		it('single variable', () => {
			expect(referencedVariables('$(internal:a) + 1')).toEqual(['internal:a'])
		})

		it('multiple variables', () => {
			expect(referencedVariables('$(internal:a) + $(test:c)')).toEqual(['internal:a', 'test:c'])
		})

		it('duplicate variables are reported each time', () => {
			expect(referencedVariables('$(internal:a) / $(internal:a)')).toEqual(['internal:a', 'internal:a'])
		})

		it('variables inside templates', () => {
			expect(referencedVariables('`${$(some:var)} and ${$(another:var)}`')).toEqual(['some:var', 'another:var'])
		})

		it('variable with computed property access', () => {
			expect(referencedVariables("$(my:variable)['d']")).toEqual(['my:variable'])
		})

		it('variable with non-computed property access', () => {
			expect(referencedVariables('$(my:variable).d')).toEqual(['my:variable'])
		})

		it('variables inside objects and arrays', () => {
			expect(referencedVariables('{a: $(my:var), b: [$(other:var)]}')).toEqual(['my:var', 'other:var'])
		})

		it('variables used as function arguments', () => {
			expect(referencedVariables('round($(some:num))')).toEqual(['some:num'])
		})
	})

	describe('variable parsing', () => {
		it('unclosed reference is a syntax error', () => {
			expect(parses('$(internal:a')).toBe(false)
		})

		it('empty name is allowed by the parser', () => {
			expect(referencedVariables('$()')).toEqual([''])
		})
	})
})

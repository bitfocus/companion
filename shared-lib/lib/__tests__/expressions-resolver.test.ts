import { describe, it, expect } from 'vitest'
import { ParseExpression as parse } from '../Expression/ExpressionParse.js'
import { type GetVariableValueProps, ResolveExpression as resolve } from '../Expression/ExpressionResolve.js'
import jsep from 'jsep'
import type { VariableValue } from '../Model/Variables.js'

const defaultGetValue = (_props: GetVariableValueProps): VariableValue | undefined => {
	throw new Error('Not implemented')
}

describe('resolver', function () {
	describe('ensure each binary operator is implemented', function () {
		for (const op of Object.keys(jsep.binary_ops)) {
			if (op) {
				it(`should handle "${op}" operator`, function () {
					const result = resolve(parse(`a = 1 ; a ${op} 2`), defaultGetValue)
					expect(typeof result).toMatch(/^(number|boolean)$/)
				})
			}
		}
	})

	describe('ensure each unary operator is implemented', function () {
		for (const op of Object.keys(jsep.unary_ops)) {
			if (op) {
				it(`should handle "${op}" operator`, function () {
					const result = resolve(parse(`${op}2`), defaultGetValue)
					expect(typeof result).toMatch(/^(number|boolean)$/)
				})
			}
		}
	})

	describe('expressions with literal operand', function () {
		it('should handle addition', function () {
			const result = resolve(parse('1 + 2'), defaultGetValue)
			expect(result).toBe(3)
		})

		it('should handle addition', function () {
			const result = resolve(parse('3 - 4'), defaultGetValue)
			expect(result).toBe(-1)
		})

		it('should handle multiplication', function () {
			const result = resolve(parse('5 * 6'), defaultGetValue)
			expect(result).toBe(30)
		})

		it('should handle division', function () {
			const result = resolve(parse('7 / 8'), defaultGetValue)
			expect(result).toBe(0.875)
		})

		// it('should handle exponentiation', function () {
		// 	const result = resolve(parse('2 ^ 8'),defaultGetValue)
		// 	expect(result).toBe(256)
		// })

		it('should handle unary negation', function () {
			const result = resolve(parse('-1 + -2'), defaultGetValue)
			expect(result).toBe(-3)
		})

		it('should handle consecutive unary negation', function () {
			const result = resolve(parse('--1 + 1'), defaultGetValue)
			expect(result).toBe(2)
		})

		it('should handle consecutive unary negation with parenthesis', function () {
			const result = resolve(parse('-(-1) + 1'), defaultGetValue)
			expect(result).toBe(2)
		})

		it('should handle negation of expression within parenthesis', function () {
			const result = resolve(parse('-(-1 + -1)'), defaultGetValue)
			expect(result).toBe(2)
		})

		it('should handle multiple operators', function () {
			const result = resolve(parse('((2 + 2) * 3 / 4) ^ 3 % 2'), defaultGetValue)
			expect(result).toBe(2)
		})

		it('should handle floating point literals', function () {
			const result = resolve(parse('1.234 * 2'), defaultGetValue)
			expect(result).toBe(2.468)
		})

		it('should handle division by zero', function () {
			const result = resolve(parse('1 / 0'), defaultGetValue)
			expect(result).toBe(Infinity)
		})
	})

	describe('expressions with symbol/variable operands', function () {
		it('should handle symbol and literal operands', function () {
			const postfix = parse('$(internal:a) + 1')
			const getVariable = (props: GetVariableValueProps): VariableValue | undefined => {
				switch (props.variableId) {
					case 'internal:a':
						return 2
				}
				return undefined
			}
			expect(resolve(postfix, getVariable)).toBe(3)
		})

		it('should handle multiple symbol operands', function () {
			const postfix = parse('$(internal:a) + $(test:c)')
			const getVariable = (props: GetVariableValueProps): VariableValue | undefined => {
				switch (props.variableId) {
					case 'internal:a':
						return '3'
					case 'test:c':
						return '1'
				}
				return undefined
			}
			expect(resolve(postfix, getVariable)).toBe(4)
		})

		it('handle string variables', function () {
			const postfix = parse('$(internal:a) ^ 2 + 2 * $(internal:b) + $(test:c)')
			const getVariable = (props: GetVariableValueProps): VariableValue | undefined => {
				switch (props.variableId) {
					case 'internal:a':
						return 3
					case 'internal:b':
						return 2
					case 'test:c':
						return 1
				}
				return undefined
			}
			expect(resolve(postfix, getVariable)).toBe(4)
		})

		it('should handle duplicate symbol operands', function () {
			const postfix = parse('$(internal:a) / $(internal:a)')
			const getVariable = (props: GetVariableValueProps): VariableValue | undefined => {
				switch (props.variableId) {
					case 'internal:a':
						return 10
				}
				return undefined
			}
			expect(resolve(postfix, getVariable)).toBe(1)
		})
	})

	describe('expressions with errors', function () {
		it('should detect missing symbol values', function () {
			const getVariable = () => {
				throw new Error('My error')
			}
			const fn = () => resolve(parse('$(internal:a) + 1'), getVariable)
			expect(fn).toThrow(/My error/)
		})

		it('should silently handle missing symbol values', function () {
			const getVariable = () => undefined
			const fn = () => resolve(parse('$(internal:a) + 1'), getVariable)
			expect(fn()).toEqual(NaN)
		})

		it('should detect missing operands', function () {
			const fn = () => resolve(parse('1 +'), defaultGetValue)
			expect(fn).toThrow(/Expected expression after/)
		})

		it('should treat extraneous operands as multiple statements', function () {
			const value = resolve(parse('10 + 10 20 30'), defaultGetValue)
			expect(value).toEqual(30)
		})
	})

	describe('functions', function () {
		it('should parse and execute provided functions', function () {
			const result = resolve(parse('round(10.1)'), defaultGetValue, { round: (v) => Math.round(v) })
			expect(result).toBe(10)
		})

		it('should fail on an unknown function', function () {
			const fn = () => resolve(parse('round2(10.1)'), defaultGetValue, { round: (v) => Math.round(v) })
			expect(fn).toThrow(/Unsupported function "round2"/)
		})

		it('should handle multiple function arguments', function () {
			const result = resolve(parse('round(10.1111) + round(10.1111, 0.1)'), defaultGetValue, {
				round: (v, accuracy = 1) => Math.round(v / accuracy) * accuracy,
			})
			expect(result).toBe(20.1)
		})
	})

	describe('ternaries', function () {
		it('should parse and execute ternary', function () {
			const result = resolve(parse('(1 > 2) ? 3 : 4'), defaultGetValue)
			expect(result).toBe(4)
		})
	})

	describe('templates', function () {
		it('handle template', () => {
			const result = resolve(parse('`val: ${1 + 2}dB`'), defaultGetValue)
			expect(result).toBe('val: 3dB')
		})

		it('handle template at start', () => {
			const result = resolve(parse('`${1 + 2}dB`'), defaultGetValue)
			expect(result).toBe('3dB')
		})

		it('handle template at end', () => {
			const result = resolve(parse('`val: ${1 + 2}`'), defaultGetValue)
			expect(result).toBe('val: 3')
		})

		it('handle complex templates', () => {
			const getVariable = (props: GetVariableValueProps): VariableValue | undefined => {
				switch (props.variableId) {
					case 'some:var':
						return 'var1'
					case 'another:var':
						return 99
				}
				return undefined
			}
			const result = resolve(parse('`val: ${1 + 2}dB or ${$(some:var)} and ${$(another:var)}`'), getVariable)
			expect(result).toBe('val: 3dB or var1 and 99')
		})
	})

	describe('objects', () => {
		it('handle object define and lookup', () => {
			const result = resolve(parse("{a: 1}['a']"), defaultGetValue)
			expect(result).toBe(1)
		})

		it('handle object define and lookup - multi level', () => {
			const result = resolve(parse("{a: 1, 'b': 2, c: {v: 4}}['c']['v']"), defaultGetValue)
			expect(result).toBe(4)
		})

		it('handle object define and lookup - missing prop', () => {
			const result = resolve(parse("{a: 1}['b']"), defaultGetValue)
			expect(result).toBe(undefined)
		})

		it('handle object define and lookup - off string', () => {
			const result = resolve(parse("'abc'[0]"), defaultGetValue)
			expect(result).toBe('a')
		})

		it('handle object define and lookup - off companion variable', () => {
			const getVariable = (props: GetVariableValueProps): any => {
				switch (props.variableId) {
					case 'my:var':
						return { val: 4 }
				}
			}

			const result = resolve(parse("$(my:var)['val']"), getVariable)
			expect(result).toBe(4)
		})

		it('define object - using companion variable', () => {
			const getVariable = (props: GetVariableValueProps): VariableValue | undefined => {
				switch (props.variableId) {
					case 'my:var':
						return 'val'
				}
				return undefined
			}

			const result = resolve(parse("{a: 1, 'v': {a: $(my:var), c: null}}"), getVariable)
			expect(result).toEqual({ a: 1, v: { a: 'val', c: null } })
		})

		it('define array', () => {
			const result = resolve(parse("[1, 'c', null]"), defaultGetValue)
			expect(result).toEqual([1, 'c', null])
		})

		it('define array - with lookup', () => {
			const result = resolve(parse("[1, 'c', null][1]"), defaultGetValue)
			expect(result).toEqual('c')
		})

		it('array get beyond end - inline access', () => {
			const getVariable = (props: GetVariableValueProps) => {
				switch (props.variableId) {
					case 'my:var':
						return [1, 2, 3] as any
				}
				return undefined
			}

			const result = resolve(parse('$(my:var)[42] === undefined'), getVariable)
			expect(result).toEqual(true)
		})

		it('array get beyond end - intermediate var', () => {
			const getVariable = (props: GetVariableValueProps) => {
				switch (props.variableId) {
					case 'my:var':
						return [1, 2, 3] as any
				}
				return undefined
			}

			const result = resolve(parse('let a = $(my:var);a[42] === undefined'), getVariable)
			expect(result).toEqual(true)
		})
	})

	describe('return', () => {
		it('return value', () => {
			const result = resolve(parse('return 1'), defaultGetValue)
			expect(result).toBe(1)
		})

		it('return formula', () => {
			const result = resolve(parse('return 1 + 2 / 3'), defaultGetValue)
			expect(result).toBe(1 + 2 / 3)
		})

		it('return brackets', () => {
			const result = resolve(parse('return (1 / 2)'), defaultGetValue)
			expect(result).toBe(1 / 2)
		})

		it('return variable', () => {
			const getVariable = (props: GetVariableValueProps): VariableValue | undefined => {
				switch (props.variableId) {
					case 'some:var':
						return 'var1'
				}
				return undefined
			}

			const result = resolve(parse('return $(some:var)'), getVariable)
			expect(result).toBe('var1')
		})

		it('return in the middle', () => {
			const result = resolve(parse('return 1\n return 2'), defaultGetValue)
			expect(result).toBe(1)
		})
	})

	describe('assignment', () => {
		it('basic maths', () => {
			const result = resolve(parse('a = 1\nb=2\nreturn a+b'), defaultGetValue)
			expect(result).toBe(3)
		})

		it('basic maths with semicolons', () => {
			const result = resolve(parse('a=1;b=2;return a+b;'), defaultGetValue)
			expect(result).toBe(3)
		})

		it('no return', () => {
			const result = resolve(parse('a = 1'), defaultGetValue)
			expect(result).toBe(1)
		})

		it('no return with update', () => {
			const result = resolve(parse('a = 1; ++a'), defaultGetValue)
			expect(result).toBe(2)
		})
	})

	describe('assignment - array', () => {
		it('array set', () => {
			const result = resolve(parse('a = [4,5,6]\na[1]=2\nreturn a'), defaultGetValue)
			expect(result).toEqual([4, 2, 6])
		})

		it('array set with semi colons', () => {
			const result = resolve(parse('a=[4,5,6];a[1]=2;return a;'), defaultGetValue)
			expect(result).toEqual([4, 2, 6])
		})

		it('array +=', () => {
			const result = resolve(parse('a = [4,5,6]\na[1]+=2\nreturn a'), defaultGetValue)
			expect(result).toEqual([4, 7, 6])
		})

		it('no return', () => {
			const result = resolve(parse('a=[4,5,6]\na[1] = 1'), defaultGetValue)
			expect(result).toEqual(1)
		})

		it('no return with update', () => {
			const result = resolve(parse('a = [4,5,6]; ++a[0]'), defaultGetValue)
			expect(result).toEqual(5)
		})

		it('return with update', () => {
			const result = resolve(parse('a = [4,5,6]; ++a[0]; a'), defaultGetValue)
			expect(result).toEqual([5, 5, 6])
		})

		it('mutate in place', () => {
			const inputValue = [1, 2, 3]
			const getVariable = (props: GetVariableValueProps): any => {
				switch (props.variableId) {
					case 'some:var':
						return inputValue
				}
			}

			const result = resolve(parse('a = $(some:var); a[1]=5; a'), getVariable)
			expect(result).toEqual([1, 5, 3])

			// Ensure input is unchanged
			expect(inputValue).toEqual([1, 2, 3])
		})
	})

	describe('integer as boolean', () => {
		it('should treat 0 as false', () => {
			const result = resolve(parse('0 ? 1 : 2'), defaultGetValue)
			expect(result).toBe(2)
		})

		it('should treat non-zero as true', () => {
			const result = resolve(parse('42 ? 1 : 2'), defaultGetValue)
			expect(result).toBe(1)
		})
	})
})

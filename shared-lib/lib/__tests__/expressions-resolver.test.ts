import { describe, expect, it } from 'vitest'
import { ParseExpression as parse } from '../Expression/ExpressionParse.js'
import { ResolveExpression as resolve, type GetVariableValueProps } from '../Expression/ExpressionResolve.js'
import type { VariableValue } from '../Model/Variables.js'

// The operators the evaluator implements. (Previously enumerated from jsep's tables; now that we parse
// with acorn these are listed explicitly.)
const BINARY_OPERATORS = [
	'+',
	'-',
	'*',
	'/',
	'%',
	'^',
	'**',
	'>>',
	'<<',
	'>=',
	'<=',
	'>',
	'<',
	'==',
	'!=',
	'===',
	'!==',
	'&',
	'|',
]
const LOGICAL_OPERATORS = ['||', '&&', '??']
const UNARY_OPERATORS = ['-', '+', '!', '~']

const defaultGetValue = (_props: GetVariableValueProps): VariableValue | undefined => {
	throw new Error('Not implemented')
}

describe('resolver', function () {
	describe('ensure each binary operator is implemented', function () {
		for (const op of [...BINARY_OPERATORS, ...LOGICAL_OPERATORS]) {
			it(`should handle "${op}" operator`, function () {
				const result = resolve(parse(`a = 1 ; a ${op} 2`), defaultGetValue)
				expect(typeof result).toMatch(/^(number|boolean)$/)
			})
		}
	})

	describe('ensure each unary operator is implemented', function () {
		for (const op of UNARY_OPERATORS) {
			it(`should handle "${op}" operator`, function () {
				const result = resolve(parse(`${op}2`), defaultGetValue)
				expect(typeof result).toMatch(/^(number|boolean)$/)
			})
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

	describe('builtin constants', function () {
		it('should resolve PI', function () {
			expect(resolve(parse('PI'), defaultGetValue)).toBeCloseTo(Math.PI)
		})

		it('should be usable in expressions', function () {
			expect(resolve(parse('2 * PI'), defaultGetValue)).toBeCloseTo(2 * Math.PI)
		})

		it('should be overridable by an explicit assignment', function () {
			expect(resolve(parse('PI = 5 ; PI'), defaultGetValue)).toBe(5)
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
			expect(fn).toThrow()
		})

		it('should reject extraneous operands (no-separator multi-statement quirk dropped in 5.0)', function () {
			// Previously this was silently treated as multiple statements and returned 30.
			// A real parser rejects it; the quirk is intentionally removed.
			const fn = () => resolve(parse('10 + 10 20 30'), defaultGetValue)
			expect(fn).toThrow()
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

	describe('property access', () => {
		const getObjVar = (props: GetVariableValueProps): any => {
			switch (props.variableId) {
				case 'my:obj':
					return { k: 'v', n: 42 }
				case 'my:arr':
					return [10, 20, 30]
			}
			return undefined
		}

		it('non-computed data property on an object', () => {
			expect(resolve(parse('$(my:obj).k'), getObjVar)).toBe('v')
			expect(resolve(parse('{a: 1, b: 2}.b'), defaultGetValue)).toBe(2)
		})

		it('computed and non-computed access agree for data properties', () => {
			expect(resolve(parse("$(my:obj)['k']"), getObjVar)).toBe('v')
			expect(resolve(parse('$(my:obj).k'), getObjVar)).toBe('v')
		})

		it('array index access works', () => {
			expect(resolve(parse('$(my:arr)[1]'), getObjVar)).toBe(20)
			expect(resolve(parse('[10, 20, 30][2]'), defaultGetValue)).toBe(30)
		})

		it('built-in/inherited properties are NOT accessible', () => {
			// `length` is an own-but-non-enumerable property; methods are inherited
			expect(resolve(parse('$(my:arr).length'), getObjVar)).toBe(undefined)
			expect(resolve(parse("$(my:arr)['length']"), getObjVar)).toBe(undefined)
			expect(resolve(parse('[1, 2, 3].length'), defaultGetValue)).toBe(undefined)
			expect(resolve(parse("'abc'.length"), defaultGetValue)).toBe(undefined)
			expect(resolve(parse('[1, 2, 3].map'), defaultGetValue)).toBe(undefined)
		})

		it('string index access still works', () => {
			expect(resolve(parse("'abc'[0]"), defaultGetValue)).toBe('a')
		})
	})

	describe('optional chaining', () => {
		const getValue = (props: GetVariableValueProps): any => {
			switch (props.variableId) {
				case 'my:obj':
					return { k: 'v', nested: { deep: 1 } }
				case 'my:null':
					return null
				case 'my:arr':
					return [{ name: 'first' }]
			}
			return undefined
		}

		it('reads through a present value', () => {
			expect(resolve(parse('$(my:obj)?.k'), getValue)).toBe('v')
			expect(resolve(parse('$(my:obj)?.nested?.deep'), getValue)).toBe(1)
		})

		it('short-circuits to undefined on a nullish value', () => {
			expect(resolve(parse('$(my:null)?.k'), getValue)).toBe(undefined)
			expect(resolve(parse('$(my:null)?.k?.deep'), getValue)).toBe(undefined)
			expect(resolve(parse('a = null; a?.b'), defaultGetValue)).toBe(undefined)
		})

		it('works with computed optional access', () => {
			expect(resolve(parse('$(my:arr)?.[0]?.name'), getValue)).toBe('first')
			expect(resolve(parse('$(my:null)?.[0]'), getValue)).toBe(undefined)
		})
	})

	describe('spread', () => {
		const getValue = (props: GetVariableValueProps): any => {
			switch (props.variableId) {
				case 'my:arr':
					return [10, 20, 30]
				case 'my:obj':
					return { a: 1, b: 2 }
			}
			return undefined
		}

		it('spreads into array literals', () => {
			expect(resolve(parse('[...[1, 2], 3]'), defaultGetValue)).toEqual([1, 2, 3])
			expect(resolve(parse('[0, ...$(my:arr)]'), getValue)).toEqual([0, 10, 20, 30])
			expect(resolve(parse("[...'ab']"), defaultGetValue)).toEqual(['a', 'b'])
		})

		it('spreads into object literals (later keys win)', () => {
			expect(resolve(parse('{ ...{ a: 1 }, b: 2 }'), defaultGetValue)).toEqual({ a: 1, b: 2 })
			expect(resolve(parse('{ a: 1, ...{ a: 2 } }'), defaultGetValue)).toEqual({ a: 2 })
			expect(resolve(parse('{ ...$(my:obj), c: 3 }'), getValue)).toEqual({ a: 1, b: 2, c: 3 })
		})

		it('spreads into function call arguments', () => {
			const result = resolve(parse('sum(...[1, 2, 3], 4)'), defaultGetValue, {
				sum: (...args: number[]) => args.reduce((a, b) => a + b, 0),
			})
			expect(result).toBe(10)
		})

		it('throws when spreading a non-iterable value', () => {
			expect(() => resolve(parse('[...5]'), defaultGetValue)).toThrow(/not iterable/)
			expect(() => resolve(parse('[...null]'), defaultGetValue)).toThrow(/null or undefined/)
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

		it('no return with decrement', () => {
			const result = resolve(parse('a = 5; --a'), defaultGetValue)
			expect(result).toBe(4)
		})

		it('postfix decrement', () => {
			const result = resolve(parse('a = 5; a--; a'), defaultGetValue)
			expect(result).toBe(4)
		})

		it('nullish coalescing assignment - left is null', () => {
			const result = resolve(parse('a = null; a ??= 5'), defaultGetValue)
			expect(result).toBe(5)
		})

		it('nullish coalescing assignment - left is undefined', () => {
			const result = resolve(parse('a ??= 5'), defaultGetValue)
			expect(result).toBe(5)
		})

		it('nullish coalescing assignment - left has value', () => {
			const result = resolve(parse('a = 3; a ??= 5'), defaultGetValue)
			expect(result).toBe(3)
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

		it('no return with decrement', () => {
			const result = resolve(parse('a = [4,5,6]; --a[0]'), defaultGetValue)
			expect(result).toEqual(3)
		})

		it('return with decrement', () => {
			const result = resolve(parse('a = [4,5,6]; --a[0]; a'), defaultGetValue)
			expect(result).toEqual([3, 5, 6])
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

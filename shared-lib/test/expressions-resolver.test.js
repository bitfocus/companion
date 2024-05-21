import { ParseExpression as parse } from '../lib/Expression/ExpressionParse'
import { ResolveExpression as resolve } from '../lib/Expression/ExpressionResolve'
import jsep from 'jsep'

describe('resolver', function () {
	describe('ensure each binary operator is implemented', function () {
		for (const op of Object.keys(jsep.binary_ops)) {
			if (op) {
				it(`should handle "${op}" operator`, function () {
					const result = resolve(parse(`1 ${op} 2`))
					expect(typeof result).toMatch(/^number|boolean$/)
				})
			}
		}
	})

	describe('ensure each unary operator is implemented', function () {
		for (const op of Object.keys(jsep.unary_ops)) {
			if (op) {
				it(`should handle "${op}" operator`, function () {
					const result = resolve(parse(`${op}2`))
					expect(typeof result).toMatch(/^number|boolean$/)
				})
			}
		}
	})

	describe('expressions with literal operand', function () {
		it('should handle addition', function () {
			const result = resolve(parse('1 + 2'))
			expect(result).toBe(3)
		})

		it('should handle addition', function () {
			const result = resolve(parse('3 - 4'))
			expect(result).toBe(-1)
		})

		it('should handle multiplication', function () {
			const result = resolve(parse('5 * 6'))
			expect(result).toBe(30)
		})

		it('should handle division', function () {
			const result = resolve(parse('7 / 8'))
			expect(result).toBe(0.875)
		})

		// it('should handle exponentiation', function () {
		// 	const result = resolve(parse('2 ^ 8'))
		// 	expect(result).toBe(256)
		// })

		it('should handle unary negation', function () {
			const result = resolve(parse('-1 + -2'))
			expect(result).toBe(-3)
		})

		it('should handle consecutive unary negation', function () {
			const result = resolve(parse('--1 + 1'))
			expect(result).toBe(2)
		})

		it('should handle consecutive unary negation with parenthesis', function () {
			const result = resolve(parse('-(-1) + 1'))
			expect(result).toBe(2)
		})

		it('should handle negation of expression within parenthesis', function () {
			const result = resolve(parse('-(-1 + -1)'))
			expect(result).toBe(2)
		})

		it('should handle multiple operators', function () {
			const result = resolve(parse('((2 + 2) * 3 / 4) ^ 3 % 2'))
			expect(result).toBe(2)
		})

		it('should handle floating point literals', function () {
			const result = resolve(parse('1.234 * 2'))
			expect(result).toBe(2.468)
		})

		it('should handle division by zero', function () {
			const result = resolve(parse('1 / 0'))
			expect(result).toBe(Infinity)
		})
	})

	describe('expressions with symbol/variable operands', function () {
		it('should handle symbol and literal operands', function () {
			const postfix = parse('$(internal:a) + 1')
			const getVariable = (id) => {
				switch (id) {
					case 'internal:a':
						return 2
				}
			}
			expect(resolve(postfix, getVariable)).toBe(3)
		})

		it('should handle multiple symbol operands', function () {
			const postfix = parse('$(internal:a) + $(test:c)')
			const getVariable = (id) => {
				switch (id) {
					case 'internal:a':
						return '3'
					case 'test:c':
						return '1'
				}
			}
			expect(resolve(postfix, getVariable)).toBe(4)
		})

		it('handle string variables', function () {
			const postfix = parse('$(internal:a) ^ 2 + 2 * $(internal:b) + $(test:c)')
			const getVariable = (id) => {
				switch (id) {
					case 'internal:a':
						return 3
					case 'internal:b':
						return 2
					case 'test:c':
						return 1
				}
			}
			expect(resolve(postfix, getVariable)).toBe(4)
		})

		it('should handle duplicate symbol operands', function () {
			const postfix = parse('$(internal:a) / $(internal:a)')
			const getVariable = (id) => {
				switch (id) {
					case 'internal:a':
						return 10
				}
			}
			expect(resolve(postfix, getVariable)).toBe(1)
		})
	})

	describe('expressions with errors', function () {
		it('should detect missing symbol values', function () {
			const getVariable = () => undefined
			const fn = () => resolve(parse('$(internal:a) + 1'), getVariable)
			expect(fn).toThrow(/Missing variable value/)
		})

		it('should detect missing operands', function () {
			const fn = () => resolve(parse('1 +'))
			expect(fn).toThrow(/Expected expression after/)
		})

		it('should detect extraneous operands', function () {
			const fn = () => resolve(parse('10 + 10 20 30'))
			expect(fn).toThrow(/Unknown node "Compound"/)
		})
	})

	describe('functions', function () {
		it('should parse and execute provided functions', function () {
			const result = resolve(parse('round(10.1)'), {}, { round: (v) => Math.round(v) })
			expect(result).toBe(10)
		})

		it('should fail on an unknown function', function () {
			const fn = () => resolve(parse('round2(10.1)'), {}, { round: (v) => Math.round(v) })
			expect(fn).toThrow(/Unsupported function "round2"/)
		})

		it('should handle multiple function arguments', function () {
			const result = resolve(
				parse('round(10.1111) + round(10.1111, 0.1)'),
				{},
				{ round: (v, accuracy = 1) => Math.round(v / accuracy) * accuracy }
			)
			expect(result).toBe(20.1)
		})
	})

	describe('ternaries', function () {
		it('should parse and execute ternary', function () {
			const result = resolve(parse('(1 > 2) ? 3 : 4'))
			expect(result).toBe(4)
		})
	})

	describe('templates', function () {
		it('handle template', () => {
			const result = resolve(parse('`val: ${1 + 2}dB`'))
			expect(result).toBe('val: 3dB')
		})

		it('handle template at start', () => {
			const result = resolve(parse('`${1 + 2}dB`'))
			expect(result).toBe('3dB')
		})

		it('handle template at end', () => {
			const result = resolve(parse('`val: ${1 + 2}`'))
			expect(result).toBe('val: 3')
		})

		it('handle complex templates', () => {
			const getVariable = (id) => {
				switch (id) {
					case 'some:var':
						return 'var1'
					case 'another:var':
						return 99
				}
			}
			const result = resolve(parse('`val: ${1 + 2}dB or ${$(some:var)} and ${$(another:var)}`'), getVariable)
			expect(result).toBe('val: 3dB or var1 and 99')
		})
	})

	describe('objects', () => {
		it('handle object define and lookup', () => {
			const result = resolve(parse("{a: 1}['a']"))
			expect(result).toBe(1)
		})

		it('handle object define and lookup - multi level', () => {
			const result = resolve(parse("{a: 1, 'b': 2, c: {v: 4}}['c']['v']"))
			expect(result).toBe(4)
		})

		it('handle object define and lookup - missing prop', () => {
			const result = resolve(parse("{a: 1}['b']"))
			expect(result).toBe(undefined)
		})

		it('handle object define and lookup - off string', () => {
			const result = resolve(parse("'abc'[0]"))
			expect(result).toBe('a')
		})

		it('handle object define and lookup - off companion variable', () => {
			const getVariable = (id) => {
				switch (id) {
					case 'my:var':
						return { val: 4 }
				}
			}

			const result = resolve(parse("$(my:var)['val']"), getVariable)
			expect(result).toBe(4)
		})

		it('define object - using companion variable', () => {
			const getVariable = (id) => {
				switch (id) {
					case 'my:var':
						return 'val'
				}
			}

			const result = resolve(parse("{a: 1, 'v': {a: $(my:var), c: null}}"), getVariable)
			expect(result).toEqual({ a: 1, v: { a: 'val', c: null } })
		})

		it('define array', () => {
			const result = resolve(parse("[1, 'c', null]"))
			expect(result).toEqual([1, 'c', null])
		})

		it('define array - with lookup', () => {
			const result = resolve(parse("[1, 'c', null][1]"))
			expect(result).toEqual('c')
		})
	})

	describe('return', () => {
		it('return value', () => {
			const result = resolve(parse('return 1'), undefined)
			expect(result).toBe(1)
		})

		it('return formula', () => {
			const result = resolve(parse('return 1 + 2 / 3'), undefined)
			expect(result).toBe(1 + 2 / 3)
		})

		it('return brackets', () => {
			const result = resolve(parse('return (1 / 2)'), undefined)
			expect(result).toBe(1 / 2)
		})

		it('return variable', () => {
			const getVariable = (id) => {
				switch (id) {
					case 'some:var':
						return 'var1'
				}
			}

			const result = resolve(parse('return $(some:var)'), getVariable)
			expect(result).toBe('var1')
		})
	})
})

import { ParseExpression as parse } from '../lib/Shared/Expression/ExpressionParse'
import { ResolveExpression as resolve } from '../lib/Shared/Expression/ExpressionResolve'
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

		it('should handle consective unary negation', function () {
			const result = resolve(parse('--1 + 1'))
			expect(result).toBe(2)
		})

		it('should handle consective unary negation with parenthesis', function () {
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
			const variables = { internal: { a: 2 } }
			expect(resolve(postfix, variables)).toBe(3)
		})

		it('should handle multiple symbol operands', function () {
			const postfix = parse('$(internal:a) ^ 2 + 2 * $(internal:b) + $(test:c)')
			const variables = { internal: { a: 3, b: 2 }, test: { c: 1 } }
			expect(resolve(postfix, variables)).toBe(4)
		})

		it('should handle duplicate symbol operands', function () {
			const postfix = parse('$(internal:a) / $(internal:a)')
			const variables = { internal: { a: 10 } }
			expect(resolve(postfix, variables)).toBe(1)
		})
	})

	describe('expressions with errors', function () {
		it('should detect missing symbol values', function () {
			const fn = () => resolve(parse('$(internal:a) + 1'))
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
})

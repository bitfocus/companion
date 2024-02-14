import { ParseExpression, FindAllReferencedVariables } from '../lib/Shared/Expression/ExpressionParse'

function ParseExpression2(str) {
	const node = ParseExpression(str)
	return {
		expr: node,
		variableIds: FindAllReferencedVariables(node),
	}
}

describe('parser', () => {
	describe('operator precedence', () => {
		it('should handle expressions with single operators', () => {
			const result = ParseExpression2('$(internal:a) + $(internal:b)')
			expect(result).toEqual({
				expr: {
					type: 'BinaryExpression',
					operator: '+',
					left: {
						name: 'internal:a',
						type: 'CompanionVariable',
					},
					right: {
						name: 'internal:b',
						type: 'CompanionVariable',
					},
				},
				variableIds: ['internal:a', 'internal:b'],
			})
		})

		it('should handle multiple operators with same precedence', () => {
			const result = ParseExpression2('$(internal:a) + $(internal:b) - $(internal:c)')
			expect(result).toEqual({
				expr: {
					type: 'BinaryExpression',
					operator: '-',
					left: {
						type: 'BinaryExpression',
						operator: '+',
						left: {
							name: 'internal:a',
							type: 'CompanionVariable',
						},
						right: {
							name: 'internal:b',
							type: 'CompanionVariable',
						},
					},
					right: {
						name: 'internal:c',
						type: 'CompanionVariable',
					},
				},
				variableIds: ['internal:a', 'internal:b', 'internal:c'],
			})
		})

		it('should handle multiple operators with different precedence', () => {
			const result = ParseExpression2('$(internal:a) + $(internal:b) * $(internal:c)')
			expect(result).toEqual({
				expr: {
					type: 'BinaryExpression',
					operator: '+',
					left: {
						name: 'internal:a',
						type: 'CompanionVariable',
					},
					right: {
						type: 'BinaryExpression',
						operator: '*',
						left: {
							name: 'internal:b',
							type: 'CompanionVariable',
						},
						right: {
							name: 'internal:c',
							type: 'CompanionVariable',
						},
					},
				},
				variableIds: ['internal:a', 'internal:b', 'internal:c'],
			})
		})

		it('should handle parenthesis', () => {
			const result = ParseExpression2('($(internal:a) + $(internal:b)) * $(internal:c)')
			expect(result).toEqual({
				expr: {
					type: 'BinaryExpression',
					operator: '*',
					left: {
						type: 'BinaryExpression',
						operator: '+',
						left: {
							name: 'internal:a',
							type: 'CompanionVariable',
						},
						right: {
							name: 'internal:b',
							type: 'CompanionVariable',
						},
					},
					right: {
						name: 'internal:c',
						type: 'CompanionVariable',
					},
				},
				variableIds: ['internal:a', 'internal:b', 'internal:c'],
			})
		})

		it('should handle embedded parenthesis', () => {
			const result = ParseExpression2(
				'(($(internal:a) + $(internal:b)) / ($(internal:c) + $(internal:d))) ^ ($(internal:e) % 2)'
			)
			expect(result).toEqual({
				expr: {
					type: 'BinaryExpression',
					operator: '^',
					left: {
						type: 'BinaryExpression',
						operator: '/',
						left: {
							type: 'BinaryExpression',
							operator: '+',
							left: {
								name: 'internal:a',
								type: 'CompanionVariable',
							},
							right: {
								name: 'internal:b',
								type: 'CompanionVariable',
							},
						},
						right: {
							type: 'BinaryExpression',
							operator: '+',
							left: {
								name: 'internal:c',
								type: 'CompanionVariable',
							},
							right: {
								name: 'internal:d',
								type: 'CompanionVariable',
							},
						},
					},
					right: {
						type: 'BinaryExpression',
						operator: '%',
						left: {
							name: 'internal:e',
							type: 'CompanionVariable',
						},
						right: {
							raw: '2',
							type: 'Literal',
							value: 2,
						},
					},
				},
				variableIds: ['internal:a', 'internal:b', 'internal:c', 'internal:d', 'internal:e'],
			})
		})
	})

	describe('unary negative', () => {
		it('should handle at the beginning of the expression', () => {
			const result = ParseExpression2('-$(internal:a) + $(internal:b)')
			expect(result).toEqual({
				expr: {
					type: 'BinaryExpression',
					operator: '+',
					left: {
						type: 'UnaryExpression',
						operator: '-',
						prefix: true,
						argument: {
							name: 'internal:a',
							type: 'CompanionVariable',
						},
					},
					right: {
						name: 'internal:b',
						type: 'CompanionVariable',
					},
				},
				variableIds: ['internal:a', 'internal:b'],
			})
		})

		it('should handle in the middle of an expression', () => {
			const result = ParseExpression2('-$(internal:a) + -$(internal:b)')
			expect(result).toEqual({
				expr: {
					type: 'BinaryExpression',
					operator: '+',
					left: {
						type: 'UnaryExpression',
						operator: '-',
						prefix: true,
						argument: {
							name: 'internal:a',
							type: 'CompanionVariable',
						},
					},
					right: {
						type: 'UnaryExpression',
						operator: '-',
						prefix: true,
						argument: {
							name: 'internal:b',
							type: 'CompanionVariable',
						},
					},
				},
				variableIds: ['internal:a', 'internal:b'],
			})
		})

		it('should handle before open parenthesis', () => {
			const result = ParseExpression2('$(internal:a) + (-$(internal:b) + $(internal:c))')
			expect(result).toEqual({
				expr: {
					type: 'BinaryExpression',
					operator: '+',
					left: {
						name: 'internal:a',
						type: 'CompanionVariable',
					},
					right: {
						type: 'BinaryExpression',
						operator: '+',
						left: {
							type: 'UnaryExpression',
							operator: '-',
							prefix: true,
							argument: {
								name: 'internal:b',
								type: 'CompanionVariable',
							},
						},
						right: {
							name: 'internal:c',
							type: 'CompanionVariable',
						},
					},
				},
				variableIds: ['internal:a', 'internal:b', 'internal:c'],
			})
		})

		it('boolean expression', () => {
			const result = ParseExpression2('true || !$(internal:b)')
			expect(result).toEqual({
				expr: {
					type: 'BinaryExpression',
					operator: '||',
					left: {
						type: 'Literal',
						raw: 'true',
						value: true,
					},
					right: {
						type: 'UnaryExpression',
						prefix: true,
						operator: '!',
						argument: {
							name: 'internal:b',
							type: 'CompanionVariable',
						},
					},
				},
				variableIds: ['internal:b'],
			})
		})

		it('boolean expression2', () => {
			const result = ParseExpression2('1 == true')
			expect(result).toEqual({
				expr: {
					type: 'BinaryExpression',
					operator: '==',
					left: {
						type: 'Literal',
						raw: '1',
						value: 1,
					},
					right: {
						type: 'Literal',
						raw: 'true',
						value: true,
					},
				},
				variableIds: [],
			})
		})
	})

	describe('syntax errors', () => {
		it('should detect invalid tokens', () => {
			const fn = () => ParseExpression2('$(internal:a) @ $(internal:b)')
			expect(fn).toThrow(/Unexpected \"@\" at/)
		})

		// it.only('should detect empty parenthesis', () => {
		// 	const fn = () => parse('()')
		// 	expect(fn).to.throw(/Empty parenthesis/)
		// })

		it('should detect missing parenthesis', () => {
			const fn = () => ParseExpression2('$(internal:a) * ( $(internal:b) +')
			expect(fn).toThrow(/Expected expression after +/)
		})
	})

	describe('functions', () => {
		it('should detect function', () => {
			const result = ParseExpression2('round($(internal:a))')
			expect(result).toEqual({
				expr: {
					type: 'CallExpression',
					callee: {
						name: 'round',
						type: 'Identifier',
					},
					arguments: [
						{
							name: 'internal:a',
							type: 'CompanionVariable',
						},
					],
				},
				variableIds: ['internal:a'],
			})
		})
	})

	describe('ternaries', () => {
		it('handle ternary', () => {
			const result = ParseExpression2('(1 > 2) ? 3 : 4')
			expect(result).toEqual({
				expr: {
					type: 'ConditionalExpression',
					test: {
						left: {
							raw: '1',
							type: 'Literal',
							value: 1,
						},
						operator: '>',
						right: {
							raw: '2',
							type: 'Literal',
							value: 2,
						},
						type: 'BinaryExpression',
					},
					consequent: {
						raw: '3',
						type: 'Literal',
						value: 3,
					},
					alternate: {
						raw: '4',
						type: 'Literal',
						value: 4,
					},
				},
				variableIds: [],
			})
		})
	})

	describe('template', () => {
		it('handle template', () => {
			const result = ParseExpression2('`val: ${1 + 2}dB`')
			expect(result).toEqual({
				expr: {
					type: 'TemplateLiteral',
					expressions: [
						{
							type: 'BinaryExpression',
							operator: '+',
							left: {
								type: 'Literal',
								raw: '1',
								value: 1,
							},
							right: {
								type: 'Literal',
								raw: '2',
								value: 2,
							},
						},
					],
					quasis: [
						{
							type: 'TemplateElement',
							tail: false,
							value: {
								cooked: 'val: ',
								raw: 'val: ',
							},
						},
						{
							type: 'TemplateElement',
							tail: true,
							value: {
								cooked: 'dB',
								raw: 'dB',
							},
						},
					],
				},
				variableIds: [],
			})
		})

		it('handle complex templates', () => {
			const result = ParseExpression2('`val: ${1 + 2}dB or ${$(some:var)} and ${$(another:var)}` + 1')
			expect(result).toEqual({
				expr: {
					type: 'BinaryExpression',
					operator: '+',
					left: {
						type: 'TemplateLiteral',
						expressions: [
							{
								type: 'BinaryExpression',
								operator: '+',
								left: {
									type: 'Literal',
									raw: '1',
									value: 1,
								},
								right: {
									type: 'Literal',
									raw: '2',
									value: 2,
								},
							},
							{
								type: 'CompanionVariable',
								name: 'some:var',
							},
							{
								type: 'CompanionVariable',
								name: 'another:var',
							},
						],
						quasis: [
							{
								type: 'TemplateElement',
								tail: false,
								value: {
									cooked: 'val: ',
									raw: 'val: ',
								},
							},
							{
								type: 'TemplateElement',
								tail: false,
								value: {
									cooked: 'dB or ',
									raw: 'dB or ',
								},
							},
							{
								tail: false,
								type: 'TemplateElement',
								value: {
									cooked: ' and ',
									raw: ' and ',
								},
							},
							{
								type: 'TemplateElement',
								tail: true,
								value: {
									cooked: '',
									raw: '',
								},
							},
						],
					},
					right: {
						type: 'Literal',
						raw: '1',
						value: 1,
					},
				},
				variableIds: ['some:var', 'another:var'],
			})
		})
	})

	describe('variable parsing', () => {
		it('unclosed identifier', () => {
			expect(() => ParseExpression2('21 == $(')).toThrow('Expected )')
		})
		it('no name', () => {
			const res = ParseExpression2('21 == $()')

			expect(res).toEqual({
				expr: {
					type: 'BinaryExpression',
					operator: '==',
					left: {
						type: 'Literal',
						raw: '21',
						value: 21,
					},
					right: {
						type: 'CompanionVariable',
						name: '',
					},
				},
				variableIds: [''],
			})
		})
	})
})

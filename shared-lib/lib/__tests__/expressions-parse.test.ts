import { describe, it, expect } from 'vitest'
import { ParseExpression, FindAllReferencedVariables } from '../Expression/ExpressionParse.js'

function ParseExpression2(str: string) {
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
			expect(fn).toThrow(/Unexpected "@" at/)
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

	describe('identifier', () => {
		it('should accept null', () => {
			const result = ParseExpression2('null')
			expect(result).toEqual({
				expr: {
					raw: 'null',
					type: 'Literal',
					value: null,
				},
				variableIds: [],
			})
		})
		it('should accept undefined', () => {
			const result = ParseExpression2('undefined')
			expect(result).toEqual({
				expr: {
					raw: 'undefined',
					type: 'Literal',
					value: undefined,
				},
				variableIds: [],
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

	describe('object property', () => {
		it('from created object', () => {
			const res = ParseExpression2("{ a: 1, b: { c: 3 }}['d']")

			expect(res).toEqual({
				expr: {
					computed: true,
					object: {
						properties: [
							{
								computed: false,
								key: {
									raw: "'a'",
									type: 'Literal',
									value: 'a',
								},
								shorthand: false,
								type: 'Property',
								value: {
									raw: '1',
									type: 'Literal',
									value: 1,
								},
							},
							{
								computed: false,
								key: {
									raw: "'b'",
									type: 'Literal',
									value: 'b',
								},
								shorthand: false,
								type: 'Property',
								value: {
									properties: [
										{
											computed: false,
											key: {
												raw: "'c'",
												type: 'Literal',
												value: 'c',
											},
											shorthand: false,
											type: 'Property',
											value: {
												raw: '3',
												type: 'Literal',
												value: 3,
											},
										},
									],
									type: 'ObjectExpression',
								},
							},
						],
						type: 'ObjectExpression',
					},
					property: {
						raw: "'d'",
						type: 'Literal',
						value: 'd',
					},
					type: 'MemberExpression',
				},
				variableIds: [],
			})
		})

		it('from variable', () => {
			const res = ParseExpression2("$(my:variable)['d']")

			expect(res).toEqual({
				expr: {
					computed: true,
					object: {
						name: 'my:variable',
						type: 'CompanionVariable',
					},
					property: {
						raw: "'d'",
						type: 'Literal',
						value: 'd',
					},
					type: 'MemberExpression',
				},
				variableIds: ['my:variable'],
			})
		})

		it('from variable with comparison', () => {
			const res = ParseExpression2("$(my:variable)['d'] === undefined")

			expect(res).toEqual({
				expr: {
					type: 'BinaryExpression',
					operator: '===',
					left: {
						computed: true,
						object: {
							name: 'my:variable',
							type: 'CompanionVariable',
						},
						property: {
							raw: "'d'",
							type: 'Literal',
							value: 'd',
						},
						type: 'MemberExpression',
					},
					right: {
						raw: 'undefined',
						type: 'Literal',
						value: undefined,
					},
				},
				variableIds: ['my:variable'],
			})
		})

		it('from variable with brackets', () => {
			const res = ParseExpression2("($(my:variable)['d'])")

			expect(res).toEqual({
				expr: {
					computed: true,
					object: {
						name: 'my:variable',
						type: 'CompanionVariable',
					},
					property: {
						raw: "'d'",
						type: 'Literal',
						value: 'd',
					},
					type: 'MemberExpression',
				},
				variableIds: ['my:variable'],
			})
		})

		it('chained', () => {
			const res = ParseExpression2("{}['b']['c']['d']")

			expect(res).toEqual({
				expr: {
					computed: true,
					object: {
						computed: true,
						object: {
							computed: true,
							object: {
								properties: [],
								type: 'ObjectExpression',
							},
							property: {
								raw: "'b'",
								type: 'Literal',
								value: 'b',
							},
							type: 'MemberExpression',
						},
						property: {
							raw: "'c'",
							type: 'Literal',
							value: 'c',
						},
						type: 'MemberExpression',
					},
					property: {
						raw: "'d'",
						type: 'Literal',
						value: 'd',
					},
					type: 'MemberExpression',
				},
				variableIds: [],
			})
		})

		it('array', () => {
			const res = ParseExpression2('[0,1][3]')

			expect(res).toEqual({
				expr: {
					computed: true,
					object: {
						elements: [
							{
								raw: '0',
								type: 'Literal',
								value: 0,
							},
							{
								raw: '1',
								type: 'Literal',
								value: 1,
							},
						],
						type: 'ArrayExpression',
					},
					property: {
						raw: '3',
						type: 'Literal',
						value: 3,
					},
					type: 'MemberExpression',
				},
				variableIds: [],
			})
		})
	})

	describe('comments', () => {
		it('ignore end of line comments', () => {
			const result = ParseExpression2('1 + 2 // test')
			expect(result).toEqual({
				expr: {
					type: 'BinaryExpression',
					operator: '+',
					left: {
						raw: '1',
						type: 'Literal',
						value: 1,
					},
					right: {
						raw: '2',
						type: 'Literal',
						value: 2,
					},
				},
				variableIds: [],
			})
		})

		it('ignore middle of line comments', () => {
			const result = ParseExpression2('1 /* Test */ + 2')
			expect(result).toEqual({
				expr: {
					type: 'BinaryExpression',
					operator: '+',
					left: {
						raw: '1',
						type: 'Literal',
						value: 1,
					},
					right: {
						raw: '2',
						type: 'Literal',
						value: 2,
					},
				},
				variableIds: [],
			})
		})
	})

	describe('line terminator', () => {
		it('multi-statement with semicolon', () => {
			const result = ParseExpression2('1 + 2;3 + 4')
			expect(result).toEqual({
				expr: {
					body: [
						{
							type: 'BinaryExpression',
							operator: '+',
							left: {
								raw: '1',
								type: 'Literal',
								value: 1,
							},
							right: {
								raw: '2',
								type: 'Literal',
								value: 2,
							},
						},
						{
							type: 'BinaryExpression',
							operator: '+',
							left: {
								raw: '3',
								type: 'Literal',
								value: 3,
							},
							right: {
								raw: '4',
								type: 'Literal',
								value: 4,
							},
						},
					],
					type: 'Compound',
				},
				variableIds: [],
			})
		})
		it('multi-statement with line split', () => {
			const result = ParseExpression2('1 + 2\n3 + 4')
			expect(result).toEqual({
				expr: {
					body: [
						{
							type: 'BinaryExpression',
							operator: '+',
							left: {
								raw: '1',
								type: 'Literal',
								value: 1,
							},
							right: {
								raw: '2',
								type: 'Literal',
								value: 2,
							},
						},
						{
							type: 'BinaryExpression',
							operator: '+',
							left: {
								raw: '3',
								type: 'Literal',
								value: 3,
							},
							right: {
								raw: '4',
								type: 'Literal',
								value: 4,
							},
						},
					],
					type: 'Compound',
				},
				variableIds: [],
			})
		})

		it('multi-statement with extra newlines', () => {
			const result = ParseExpression2('1\n+ \n2\n3 +\n 4\n')
			expect(result).toEqual({
				expr: {
					body: [
						{
							type: 'BinaryExpression',
							operator: '+',
							left: {
								raw: '1',
								type: 'Literal',
								value: 1,
							},
							right: {
								raw: '2',
								type: 'Literal',
								value: 2,
							},
						},
						{
							type: 'BinaryExpression',
							operator: '+',
							left: {
								raw: '3',
								type: 'Literal',
								value: 3,
							},
							right: {
								raw: '4',
								type: 'Literal',
								value: 4,
							},
						},
					],
					type: 'Compound',
				},
				variableIds: [],
			})
		})
	})

	describe('return statement', () => {
		it('basic statement', () => {
			const result = ParseExpression2('1\n+ \n2\n return 3 +\n 4\n')
			expect(result).toEqual({
				expr: {
					body: [
						{
							type: 'BinaryExpression',
							operator: '+',
							left: {
								raw: '1',
								type: 'Literal',
								value: 1,
							},
							right: {
								raw: '2',
								type: 'Literal',
								value: 2,
							},
						},
						{
							type: 'ReturnStatement',
							argument: {
								type: 'BinaryExpression',
								operator: '+',
								left: {
									raw: '3',
									type: 'Literal',
									value: 3,
								},
								right: {
									raw: '4',
									type: 'Literal',
									value: 4,
								},
							},
						},
					],
					type: 'Compound',
				},
				variableIds: [],
			})
		})

		it('with brackets', () => {
			const result = ParseExpression2('return (1 + 2)')
			expect(result).toEqual({
				expr: {
					type: 'ReturnStatement',
					argument: {
						type: 'BinaryExpression',
						operator: '+',
						left: {
							raw: '1',
							type: 'Literal',
							value: 1,
						},
						right: {
							raw: '2',
							type: 'Literal',
							value: 2,
						},
					},
				},
				variableIds: [],
			})
		})

		it('return statement complex', () => {
			const result = ParseExpression2('return $(int:a)[1]')
			expect(result).toEqual({
				expr: {
					type: 'ReturnStatement',
					argument: {
						computed: true,
						object: {
							name: 'int:a',
							type: 'CompanionVariable',
						},
						property: {
							raw: '1',
							type: 'Literal',
							value: 1,
						},
						type: 'MemberExpression',
					},
				},
				variableIds: ['int:a'],
			})
		})
	})

	describe('assignment', () => {
		it('basic assignment', () => {
			const result = ParseExpression2('a = 1; a')
			expect(result).toEqual({
				expr: {
					type: 'Compound',
					body: [
						{
							type: 'AssignmentExpression',
							operator: '=',
							left: {
								type: 'Identifier',
								name: 'a',
							},
							right: {
								type: 'Literal',
								raw: '1',
								value: 1,
							},
						},
						{
							type: 'Identifier',
							name: 'a',
						},
					],
				},
				variableIds: [],
			})
		})

		it('increment', () => {
			const result = ParseExpression2('a++')
			expect(result).toEqual({
				expr: {
					type: 'UpdateExpression',
					operator: '++',
					prefix: false,
					argument: {
						type: 'Identifier',
						name: 'a',
					},
				},
				variableIds: [],
			})
		})
	})

	describe('assignment', () => {
		it('basic assignment', () => {
			const result = ParseExpression2('a[1] = 1; a')
			expect(result).toEqual({
				expr: {
					type: 'Compound',
					body: [
						{
							type: 'AssignmentExpression',
							operator: '=',
							left: {
								type: 'MemberExpression',
								computed: true,
								object: {
									type: 'Identifier',
									name: 'a',
								},
								property: {
									type: 'Literal',
									raw: '1',
									value: 1,
								},
							},
							right: {
								type: 'Literal',
								raw: '1',
								value: 1,
							},
						},
						{
							type: 'Identifier',
							name: 'a',
						},
					],
				},
				variableIds: [],
			})
		})

		it('increment', () => {
			const result = ParseExpression2('a[1]++')
			expect(result).toEqual({
				expr: {
					type: 'UpdateExpression',
					operator: '++',
					prefix: false,
					argument: {
						type: 'MemberExpression',
						computed: true,
						object: {
							type: 'Identifier',
							name: 'a',
						},
						property: {
							type: 'Literal',
							raw: '1',
							value: 1,
						},
					},
				},
				variableIds: [],
			})
		})
	})
})

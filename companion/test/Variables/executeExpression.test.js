import { executeExpression } from '../../lib/Variables/Util.js'

describe('executeExpression', () => {
	test('basic math', () => {
		const res = executeExpression('1 + 2', {})
		expect(res).toMatchObject({ value: 3, variableIds: new Set() })
	})

	test('missing variables', () => {
		const res = executeExpression("concat($(test:something), '=', $(another:value))", {})
		expect(res).toMatchObject({ value: '$NA=$NA', variableIds: new Set(['test:something', 'another:value']) })
	})

	test('normal variables', () => {
		const res = executeExpression("concat($(test:page), '/', $(test:row))", {
			test: {
				page: 'abc',
				row: 'def',
			},
		})
		expect(res).toMatchObject({ value: 'abc/def', variableIds: new Set(['test:page', 'test:row']) })
	})

	test('injected variables', () => {
		const injectedVariableValues = {
			'$(test:something)': 'val1',
			'$(another:value)': 'bbb',
		}

		const res = executeExpression(
			"concat($(test:something), '=', $(another:value))",
			{},
			undefined,
			injectedVariableValues
		)
		expect(res).toMatchObject({ value: 'val1=bbb', variableIds: new Set(['test:something', 'another:value']) })
	})

	test('nested variable names', () => {
		const injectedVariableValues = {
			'$(test:something)': 'val1',
			'$(another:value)': 'something',
		}

		const res = executeExpression('parseVariables("$(test:$(another:value))")', {}, undefined, injectedVariableValues)
		expect(res).toMatchObject({ value: 'val1', variableIds: new Set(['test:something', 'another:value']) })
	})
})

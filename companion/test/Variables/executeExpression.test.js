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

	test('array variable', () => {
		const injectedVariableValues = {
			'$(test:something)': [1, 2, 3],
		}

		const res = executeExpression('$(test:something)[1]', {}, undefined, injectedVariableValues)
		expect(res).toMatchObject({ value: 2, variableIds: new Set(['test:something']) })
	})

	test('object variable', () => {
		const injectedVariableValues = {
			'$(test:something)': { a: 1, b: '123' },
		}

		const res = executeExpression('$(test:something)["b"]', {}, undefined, injectedVariableValues)
		expect(res).toMatchObject({ value: '123', variableIds: new Set(['test:something']) })
	})

	test('chained variables', () => {
		const injectedVariableValues = {
			'$(test:something)': '$(another:value)',
			'$(another:value)': 'something',
		}

		const res = executeExpression('parseVariables("$(test:something)")', {}, undefined, injectedVariableValues)
		expect(res).toMatchObject({ value: 'something', variableIds: new Set(['test:something', 'another:value']) })
	})

	test('chained variables 2', () => {
		const injectedVariableValues = {
			'$(test:something)': '$(another:value)',
			'$(another:value)': 'something',
		}

		const res = executeExpression('$(test:something)', {}, undefined, injectedVariableValues)
		expect(res).toMatchObject({ value: 'something', variableIds: new Set(['test:something', 'another:value']) })
	})

	test('chained array variable', () => {
		const injectedVariableValues = {
			'$(test:something)': '$(another:value)',
			'$(another:value)': [1, 2, 3],
		}

		const res = executeExpression('join($(test:something), "/")', {}, undefined, injectedVariableValues)
		expect(res).toMatchObject({ value: '1/2/3', variableIds: new Set(['test:something', 'another:value']) })
	})

	test('falsey variables', () => {
		const res = executeExpression("concat($(test:page), '/', $(test:row), '/', $(test:col))", {
			test: {
				page: 0,
				row: '',
				col: undefined,
			},
		})
		expect(res).toMatchObject({ value: '0//$NA', variableIds: new Set(['test:page', 'test:row', 'test:col']) })
	})
})

import { describe, test, expect } from 'vitest'
import { executeExpression, VariableValueCache } from '../../lib/Variables/Util.js'

describe('executeExpression', () => {
	test('basic math', () => {
		const res = executeExpression('1 + 2', {}, undefined, new Map())
		expect(res).toMatchObject({ value: 3, variableIds: new Set() })
	})

	test('missing variables', () => {
		const res = executeExpression("concat($(test:something), '=', $(another:value))", {}, undefined, new Map())
		expect(res).toMatchObject({ value: '=', variableIds: new Set(['test:something', 'another:value']) })
	})

	test('normal variables', () => {
		const res = executeExpression(
			"concat($(test:page), '/', $(test:row))",
			{
				test: {
					page: 'abc',
					row: 'def',
				},
			},
			undefined,
			new Map()
		)
		expect(res).toMatchObject({ value: 'abc/def', variableIds: new Set(['test:page', 'test:row']) })
	})

	test('injected variables', () => {
		const injectedVariableValues: VariableValueCache = new Map()
		injectedVariableValues.set('$(test:something)', 'val1')
		injectedVariableValues.set('$(another:value)', 'bbb')

		const res = executeExpression(
			"concat($(test:something), '=', $(another:value))",
			{},
			undefined,
			injectedVariableValues
		)
		expect(res).toMatchObject({ value: 'val1=bbb', variableIds: new Set(['test:something', 'another:value']) })
	})

	test('nested variable names', () => {
		const injectedVariableValues: VariableValueCache = new Map()
		injectedVariableValues.set('$(test:something)', 'val1')
		injectedVariableValues.set('$(another:value)', 'something')

		const res = executeExpression('parseVariables("$(test:$(another:value))")', {}, undefined, injectedVariableValues)
		expect(res).toMatchObject({ value: 'val1', variableIds: new Set(['test:something', 'another:value']) })
	})

	test('array variable', () => {
		const injectedVariableValues: VariableValueCache = new Map()
		injectedVariableValues.set('$(test:something)', [1, 2, 3] as any)

		const res = executeExpression('$(test:something)[1]', {}, undefined, injectedVariableValues)
		expect(res).toMatchObject({ value: 2, variableIds: new Set(['test:something']) })
	})

	test('object variable', () => {
		const injectedVariableValues: VariableValueCache = new Map()
		injectedVariableValues.set('$(test:something)', { a: 1, b: '123' } as any)

		const res = executeExpression('$(test:something)["b"]', {}, undefined, injectedVariableValues)
		expect(res).toMatchObject({ value: '123', variableIds: new Set(['test:something']) })
	})

	test('chained variables', () => {
		const injectedVariableValues: VariableValueCache = new Map()
		injectedVariableValues.set('$(test:something)', '$(another:value)')
		injectedVariableValues.set('$(another:value)', 'something')

		const res = executeExpression('parseVariables("$(test:something)")', {}, undefined, injectedVariableValues)
		expect(res).toMatchObject({ value: 'something', variableIds: new Set(['test:something', 'another:value']) })
	})

	test('chained variables 2', () => {
		const injectedVariableValues: VariableValueCache = new Map()
		injectedVariableValues.set('$(test:something)', '$(another:value)')
		injectedVariableValues.set('$(another:value)', 'something')

		const res = executeExpression('$(test:something)', {}, undefined, injectedVariableValues)
		expect(res).toMatchObject({ value: 'something', variableIds: new Set(['test:something', 'another:value']) })
	})

	test('chained array variable', () => {
		const injectedVariableValues: VariableValueCache = new Map()
		injectedVariableValues.set('$(test:something)', '$(another:value)')
		injectedVariableValues.set('$(another:value)', [1, 2, 3] as any)

		const res = executeExpression('join($(test:something), "/")', {}, undefined, injectedVariableValues)
		expect(res).toMatchObject({ value: '1/2/3', variableIds: new Set(['test:something', 'another:value']) })
	})

	test('falsey variables', () => {
		const res = executeExpression(
			"concat($(test:page), '/', $(test:row), '/', $(test:col))",
			{
				test: {
					page: 0,
					row: '',
					col: undefined,
				},
			},
			undefined,
			new Map()
		)
		expect(res).toMatchObject({ value: '0//', variableIds: new Set(['test:page', 'test:row', 'test:col']) })
	})

	test('falsey variables interpolation', () => {
		const res = executeExpression(
			'`${$(test:page)}/${$(test:row)}/${$(test:col)}`',
			{
				test: {
					page: 0,
					row: '',
					col: undefined,
				},
			},
			undefined,
			new Map()
		)
		expect(res).toMatchObject({ value: '0//$NA', variableIds: new Set(['test:page', 'test:row', 'test:col']) })
	})

	test('getVariable single-arg form', () => {
		const res = executeExpression(
			"getVariable('test:page')",
			{
				test: {
					page: 'abc',
				},
			},
			undefined,
			new Map()
		)
		expect(res).toMatchObject({ value: 'abc', variableIds: new Set(['test:page']) })
	})

	test('getVariable two-arg form', () => {
		const res = executeExpression(
			"getVariable('test','row')",
			{
				test: {
					row: 'def',
				},
			},
			undefined,
			new Map()
		)
		expect(res).toMatchObject({ value: 'def', variableIds: new Set(['test:row']) })
	})

	test('getVariable missing returns undefined', () => {
		const res = executeExpression("getVariable('another:missing')", {}, undefined, new Map())
		expect(res).toMatchObject({ value: undefined, variableIds: new Set(['another:missing']) })
	})

	test('getVariable chained resolution', () => {
		const injectedVariableValues: VariableValueCache = new Map()
		injectedVariableValues.set('$(test:something)', '$(another:value)')
		injectedVariableValues.set('$(another:value)', 'something')

		const res = executeExpression("getVariable('test:something')", {}, undefined, injectedVariableValues)
		expect(res).toMatchObject({ value: 'something', variableIds: new Set(['test:something', 'another:value']) })
	})
})

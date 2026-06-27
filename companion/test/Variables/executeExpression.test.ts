import { describe, expect, test } from 'vitest'
import { mock } from 'vitest-mock-extended'
import { executeExpression as executeExpressionRaw, VariableValueCache } from '../../lib/Variables/Util.js'
import { VariablesBlinker } from '../../lib/Variables/VariablesBlinker.js'

const mockOptions = {
	fallbackMockImplementation: () => {
		throw new Error('not mocked')
	},
}

/** These tests run without a configured timezone, so date/time functions use the process-local timezone. */
const executeExpression = (
	blinker: VariablesBlinker,
	str: string,
	rawVariableValues: Parameters<typeof executeExpressionRaw>[2],
	requiredType: string | undefined,
	cachedVariableValues: VariableValueCache
) => executeExpressionRaw(blinker, str, rawVariableValues, requiredType, cachedVariableValues, undefined)

describe('executeExpression', () => {
	const mockBlinker = mock<VariablesBlinker>({}, mockOptions)

	test('basic math', () => {
		const res = executeExpression(mockBlinker, '1 + 2', {}, undefined, new Map())
		expect(res).toMatchObject({ value: 3, variableIds: new Set() })
	})

	test('missing variables', () => {
		const res = executeExpression(
			mockBlinker,
			"concat($(test:something), '=', $(another:value))",
			{},
			undefined,
			new Map()
		)
		expect(res).toMatchObject({ value: '=', variableIds: new Set(['test:something', 'another:value']) })
	})

	test('normal variables', () => {
		const res = executeExpression(
			mockBlinker,
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
		injectedVariableValues.set('test:something', 'val1')
		injectedVariableValues.set('another:value', 'bbb')

		const res = executeExpression(
			mockBlinker,
			"concat($(test:something), '=', $(another:value))",
			{},
			undefined,
			injectedVariableValues
		)
		expect(res).toMatchObject({ value: 'val1=bbb', variableIds: new Set(['test:something', 'another:value']) })
	})

	test('nested variable names', () => {
		const injectedVariableValues: VariableValueCache = new Map()
		injectedVariableValues.set('test:something', 'val1')
		injectedVariableValues.set('another:value', 'something')

		const res = executeExpression(
			mockBlinker,
			'parseVariables("$(test:$(another:value))")',
			{},
			undefined,
			injectedVariableValues
		)
		expect(res).toMatchObject({ value: 'val1', variableIds: new Set(['test:something', 'another:value']) })
	})

	test('array variable', () => {
		const injectedVariableValues: VariableValueCache = new Map()
		injectedVariableValues.set('test:something', [1, 2, 3] as any)

		const res = executeExpression(mockBlinker, '$(test:something)[1]', {}, undefined, injectedVariableValues)
		expect(res).toMatchObject({ value: 2, variableIds: new Set(['test:something']) })
	})

	test('object variable', () => {
		const injectedVariableValues: VariableValueCache = new Map()
		injectedVariableValues.set('test:something', { a: 1, b: '123' } as any)

		const res = executeExpression(mockBlinker, '$(test:something)["b"]', {}, undefined, injectedVariableValues)
		expect(res).toMatchObject({ value: '123', variableIds: new Set(['test:something']) })
	})

	test('chained variables', () => {
		const injectedVariableValues: VariableValueCache = new Map()
		injectedVariableValues.set('test:something', '$(another:value)')
		injectedVariableValues.set('another:value', 'something')

		const res = executeExpression(
			mockBlinker,
			'parseVariables("$(test:something)")',
			{},
			undefined,
			injectedVariableValues
		)
		expect(res).toMatchObject({ value: 'something', variableIds: new Set(['test:something', 'another:value']) })
	})

	test('chained variables 2', () => {
		const injectedVariableValues: VariableValueCache = new Map()
		injectedVariableValues.set('test:something', '$(another:value)')
		injectedVariableValues.set('another:value', 'something')

		const res = executeExpression(mockBlinker, '$(test:something)', {}, undefined, injectedVariableValues)
		expect(res).toMatchObject({ value: 'something', variableIds: new Set(['test:something', 'another:value']) })
	})

	test('chained array variable', () => {
		const injectedVariableValues: VariableValueCache = new Map()
		injectedVariableValues.set('test:something', '$(another:value)')
		injectedVariableValues.set('another:value', [1, 2, 3] as any)

		const res = executeExpression(mockBlinker, 'join($(test:something), "/")', {}, undefined, injectedVariableValues)
		expect(res).toMatchObject({ value: '1/2/3', variableIds: new Set(['test:something', 'another:value']) })
	})

	test('undefined variables', () => {
		const injectedVariableValues: VariableValueCache = new Map()
		injectedVariableValues.set('test:something', '$(another:value)')
		injectedVariableValues.set('another:value', undefined)

		const res = executeExpression(
			mockBlinker,
			'parseVariables("$(another:value)", "sub")',
			{},
			undefined,
			injectedVariableValues
		)
		expect(res).toMatchObject({ value: 'sub', variableIds: new Set(['another:value']) })

		const res2 = executeExpression(
			mockBlinker,
			'parseVariables("$(test:something)", "sub")',
			{},
			undefined,
			injectedVariableValues
		)
		expect(res2).toMatchObject({ value: 'sub', variableIds: new Set(['test:something', 'another:value']) })
	})

	test('falsey variables', () => {
		const res = executeExpression(
			mockBlinker,
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
			mockBlinker,
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
			mockBlinker,
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
			mockBlinker,
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
		const res = executeExpression(mockBlinker, "getVariable('another:missing')", {}, undefined, new Map())
		expect(res).toMatchObject({ value: undefined, variableIds: new Set(['another:missing']) })
	})

	test('getVariable chained resolution', () => {
		const injectedVariableValues: VariableValueCache = new Map()
		injectedVariableValues.set('test:something', '$(another:value)')
		injectedVariableValues.set('another:value', 'something')

		const res = executeExpression(mockBlinker, "getVariable('test:something')", {}, undefined, injectedVariableValues)
		expect(res).toMatchObject({ value: 'something', variableIds: new Set(['test:something', 'another:value']) })
	})

	describe("requiredType: 'boolean'", () => {
		test('coerces a truthy number to true', () => {
			const res = executeExpression(mockBlinker, '1', {}, 'boolean', new Map())
			expect(res).toMatchObject({ ok: true, value: true })
		})

		test('coerces a falsy number to false', () => {
			const res = executeExpression(mockBlinker, '0', {}, 'boolean', new Map())
			expect(res).toMatchObject({ ok: true, value: false })
		})

		test('passes through an actual boolean', () => {
			const res = executeExpression(mockBlinker, '1 == 1', {}, 'boolean', new Map())
			expect(res).toMatchObject({ ok: true, value: true })
		})

		test('does not coerce a missing value (e.g. variable from a disabled connection) to false', () => {
			// A variable that does not exist resolves to undefined. It must not be coerced to `false`,
			// otherwise consumers cannot fall back to their default. Instead it should fail the type check.
			const res = executeExpression(mockBlinker, '$(test:missing)', {}, 'boolean', new Map())
			expect(res).toMatchObject({ ok: false, variableIds: new Set(['test:missing']) })
		})
	})

	test('a direct reference to another variable preserves its type', () => {
		const res = executeExpression(
			mockBlinker,
			'$(test:ref)',
			{
				test: {
					ref: '$(test:num)',
					num: 42,
				},
			},
			'number',
			new Map()
		)
		expect(res).toMatchObject({ value: 42, variableIds: new Set(['test:ref', 'test:num']) })
	})

	test('custom variables are resolvable through the internal:custom_ alias', () => {
		const res = executeExpression(
			mockBlinker,
			'$(internal:custom_foo)',
			{
				custom: {
					foo: 'custom value',
				},
			},
			undefined,
			new Map()
		)
		expect(res).toMatchObject({ value: 'custom value' })
	})

	test('a variable embedding itself does not recurse endlessly', () => {
		const res = executeExpression(
			mockBlinker,
			'$(test:loop)',
			{
				test: {
					loop: 'foo $(test:loop)',
				},
			},
			undefined,
			new Map()
		)
		expect(res).toMatchObject({ value: 'foo $RE', variableIds: new Set(['test:loop']) })
	})

	describe('parseVariables function', () => {
		test('parses variables within a string', () => {
			const res = executeExpression(
				mockBlinker,
				"parseVariables('$(test:page) x')",
				{ test: { page: 'abc' } },
				undefined,
				new Map()
			)
			expect(res).toMatchObject({ value: 'abc x', variableIds: new Set(['test:page']) })
		})

		test('missing variables use the provided fallback', () => {
			const res = executeExpression(mockBlinker, "parseVariables('$(test:missing)', 'N/A')", {}, undefined, new Map())
			expect(res).toMatchObject({ value: 'N/A' })
		})
	})

	describe('blink function', () => {
		test('looks up the blinker value for the interval', () => {
			const blinker = mock<VariablesBlinker>({}, mockOptions)
			blinker.trackDependencyOnInterval.mockReturnValue({
				variableId: 'internal:__interval_500_500',
				label: 'internal',
				name: '__interval_500_500',
			})

			const injectedVariableValues: VariableValueCache = new Map()
			injectedVariableValues.set('internal:__interval_500_500', true)

			const res = executeExpression(blinker, 'blink(1000)', {}, undefined, injectedVariableValues)
			expect(res).toMatchObject({ value: 1 })
			expect(blinker.trackDependencyOnInterval).toHaveBeenCalledWith(1000, 0.5)

			injectedVariableValues.set('internal:__interval_500_500', false)
			const res2 = executeExpression(blinker, 'blink(1000)', {}, undefined, injectedVariableValues)
			expect(res2).toMatchObject({ value: 0 })
		})

		test('a custom duty cycle is passed through', () => {
			const blinker = mock<VariablesBlinker>({}, mockOptions)
			blinker.trackDependencyOnInterval.mockReturnValue({
				variableId: 'internal:__interval_250_750',
				label: 'internal',
				name: '__interval_250_750',
			})

			executeExpression(blinker, 'blink(1000, 0.25)', {}, undefined, new Map())
			expect(blinker.trackDependencyOnInterval).toHaveBeenCalledWith(1000, 0.25)
		})

		test('an invalid duty cycle falls back to 0.5', () => {
			const blinker = mock<VariablesBlinker>({}, mockOptions)
			blinker.trackDependencyOnInterval.mockReturnValue({
				variableId: 'internal:__interval_500_500',
				label: 'internal',
				name: '__interval_500_500',
			})

			executeExpression(blinker, "blink(1000, 'nope')", {}, undefined, new Map())
			expect(blinker.trackDependencyOnInterval).toHaveBeenCalledWith(1000, 0.5)
		})

		test('invalid intervals return 0 without tracking', () => {
			// mockBlinker throws if trackDependencyOnInterval is called
			expect(executeExpression(mockBlinker, 'blink(0)', {}, undefined, new Map())).toMatchObject({ value: 0 })
			expect(executeExpression(mockBlinker, 'blink(-5)', {}, undefined, new Map())).toMatchObject({ value: 0 })
			expect(executeExpression(mockBlinker, "blink('abc')", {}, undefined, new Map())).toMatchObject({ value: 0 })
		})

		test('a rejected interval returns 0', () => {
			const blinker = mock<VariablesBlinker>({}, mockOptions)
			blinker.trackDependencyOnInterval.mockReturnValue(null)

			const res = executeExpression(blinker, 'blink(1000)', {}, undefined, new Map())
			expect(res).toMatchObject({ value: 0 })
		})
	})

	describe('default timezone dependency', () => {
		test('a date function without an explicit tz depends on internal:timezone', () => {
			const res = executeExpression(mockBlinker, 'dateYear(0)', {}, undefined, new Map())
			expect(res).toMatchObject({ variableIds: new Set(['internal:timezone']) })
		})

		test('an explicit tz argument does not register the dependency', () => {
			const res = executeExpression(mockBlinker, "dateYear(0, 'UTC')", {}, undefined, new Map())
			expect(res).toMatchObject({ variableIds: new Set() })
		})

		test('an expression with no date function does not register the dependency', () => {
			const res = executeExpression(mockBlinker, '1 + 2', {}, undefined, new Map())
			expect(res).toMatchObject({ variableIds: new Set() })
		})

		test('the configured timezone is applied and tracked', () => {
			const ts = new Date('2024-06-15T12:00:00Z').getTime()
			const res = executeExpressionRaw(
				mockBlinker,
				`dateHour(${ts})`,
				{},
				undefined,
				new Map(),
				'America/New_York'
			)
			expect(res).toMatchObject({ value: 8, variableIds: new Set(['internal:timezone']) }) // UTC-4 in summer
		})
	})
})

import { describe, test, expect } from 'vitest'
import { VARIABLE_UNKNOWN_VALUE, VariableValueCache, parseVariablesInString } from '../../lib/Variables/Util.js'
import { afterEach, beforeEach } from 'node:test'

describe('variable parsing', () => {
	test('undefined string', () => {
		expect(parseVariablesInString(undefined as any, {}, new Map())).toMatchObject({
			text: undefined,
			variableIds: new Set([]),
		})
	})

	test('empty string', () => {
		expect(parseVariablesInString('', {}, new Map())).toMatchObject({ text: '', variableIds: new Set([]) })
	})

	test('simple unknown variable', () => {
		console.log('new Map()', new Map())
		expect(parseVariablesInString('$(abc:def)', {}, new Map())).toMatchObject({
			text: VARIABLE_UNKNOWN_VALUE,
			variableIds: new Set(['abc:def']),
		})
	})
	test('malformed variable', () => {
		expect(parseVariablesInString('$(abc)', {}, new Map())).toMatchObject({ text: '$(abc)', variableIds: new Set([]) })
		expect(parseVariablesInString('$(abc:f', {}, new Map())).toMatchObject({
			text: '$(abc:f',
			variableIds: new Set([]),
		})
		expect(parseVariablesInString('$(abc:)', {}, new Map())).toMatchObject({
			text: '$(abc:)',
			variableIds: new Set([]),
		})
		expect(parseVariablesInString('$(:abc)', {}, new Map())).toMatchObject({
			text: '$(:abc)',
			variableIds: new Set([]),
		})
	})

	test('unknown variable', () => {
		const variables = {
			abc: {
				def: 'val1',
			},
		}
		expect(parseVariablesInString('$(abc:def2) $(abc2:def)', variables, new Map())).toMatchObject({
			text: `${VARIABLE_UNKNOWN_VALUE} ${VARIABLE_UNKNOWN_VALUE}`,
			variableIds: new Set(['abc:def2', 'abc2:def']),
		})
		expect(parseVariablesInString('$(abc2:def)', variables, new Map())).toMatchObject({
			text: VARIABLE_UNKNOWN_VALUE,
			variableIds: new Set(['abc2:def']),
		})
	})

	test('basic variable', () => {
		const variables = {
			abc: {
				def: 'val1',
				v2: 'val2',
				3: 'val3',
			},
			another: {
				str: 'vvvv',
			},
		}
		expect(parseVariablesInString('$(abc:def)', variables, new Map())).toMatchObject({
			text: 'val1',
			variableIds: new Set(['abc:def']),
		})
		expect(parseVariablesInString('$(abc:def) $(abc:v2) $(another:str) $(abc:3)', variables, new Map())).toMatchObject({
			text: 'val1 val2 vvvv val3',
			variableIds: new Set(['abc:def', 'abc:v2', 'another:str', 'abc:3']),
		})
	})

	test('simple inter variable references', () => {
		const variables = {
			abc: {
				def: 'val1',
				v2: 'val2',
				3: 'val3',
			},
			another: {
				str: '$(abc:def) $(abc:3)',
				str2: '$(abc:v2)',
			},
		}
		expect(parseVariablesInString('$(another:str) $(abc:v2) $(another:str2)', variables, new Map())).toMatchObject({
			text: 'val1 val3 val2 val2',
			variableIds: new Set(['another:str', 'abc:def', 'abc:3', 'abc:v2', 'another:str2', 'abc:v2']),
		})
	})

	test('self referencing variable', () => {
		const variables = {
			abc: {
				def: '$(abc:def) + 1',
			},
		}
		expect(parseVariablesInString('$(abc:def)', variables, new Map())).toMatchObject({
			text: '$RE + 1',
			variableIds: new Set(['abc:def', 'abc:def']),
		})
	})

	test('infinite referencing variable', () => {
		const variables = {
			abc: {
				def: '$(abc:second)_1',
				second: '$(abc:def)_2',
			},
		}
		expect(parseVariablesInString('$(abc:def)', variables, new Map())).toEqual({
			text: '$RE_2_1',
			variableIds: new Set(['abc:def', 'abc:second', 'abc:def']),
		})
		expect(parseVariablesInString('$(abc:second)', variables, new Map())).toEqual({
			text: '$RE_1_2',
			variableIds: new Set(['abc:second', 'abc:def', 'abc:second']),
		})
	})

	test('variable name from variable name', () => {
		const variables = {
			abc: {
				def: 'second',
				second: 'val2',
				third: 'nope',
			},
		}
		expect(parseVariablesInString('$(abc:def)', variables, new Map())).toEqual({
			text: 'second',
			variableIds: new Set(['abc:def']),
		})
		expect(parseVariablesInString('$(abc:$(abc:def))', variables, new Map())).toEqual({
			text: 'val2',
			variableIds: new Set(['abc:def', 'abc:second']),
		})
		expect(parseVariablesInString('$(abc:$(abc:third))', variables, new Map())).toEqual({
			text: VARIABLE_UNKNOWN_VALUE,
			variableIds: new Set(['abc:third', 'abc:nope']),
		})
	})
})

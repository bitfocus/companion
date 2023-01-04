import { parseVariablesInString } from '../lib/Instance/Variable.js'

describe('variable parsing', () => {
	test('undefined string', () => {
		expect(parseVariablesInString(undefined, {})).toMatchObject({ text: undefined, variableIds: [] })
	})

	test('empty string', () => {
		expect(parseVariablesInString('', {})).toMatchObject({ text: '', variableIds: [] })
	})

	test('simple unknown variable', () => {
		expect(parseVariablesInString('$(abc:def)', {})).toMatchObject({ text: '$NA', variableIds: ['abc:def'] })
	})
	test('malformed variable', () => {
		expect(parseVariablesInString('$(abc)', {})).toMatchObject({ text: '$(abc)', variableIds: [] })
		expect(parseVariablesInString('$(abc:f', {})).toMatchObject({ text: '$(abc:f', variableIds: [] })
		expect(parseVariablesInString('$(abc:)', {})).toMatchObject({ text: '$(abc:)', variableIds: [] })
		expect(parseVariablesInString('$(:abc)', {})).toMatchObject({ text: '$(:abc)', variableIds: [] })
	})

	test('unknown variable', () => {
		const variables = {
			abc: {
				def: 'val1',
			},
		}
		expect(parseVariablesInString('$(abc:def2) $(abc2:def)', variables)).toMatchObject({
			text: '$NA $NA',
			variableIds: ['abc:def2', 'abc2:def'],
		})
		expect(parseVariablesInString('$(abc2:def)', variables)).toMatchObject({ text: '$NA', variableIds: ['abc2:def'] })
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
		expect(parseVariablesInString('$(abc:def)', variables)).toMatchObject({ text: 'val1', variableIds: ['abc:def'] })
		expect(parseVariablesInString('$(abc:def) $(abc:v2) $(another:str) $(abc:3)', variables)).toMatchObject({
			text: 'val1 val2 vvvv val3',
			variableIds: ['abc:def', 'abc:v2', 'another:str', 'abc:3'],
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
		expect(parseVariablesInString('$(another:str) $(abc:v2) $(another:str2)', variables)).toMatchObject({
			text: 'val1 val3 val2 val2',
			variableIds: ['another:str', 'abc:def', 'abc:3', 'abc:v2', 'another:str2', 'abc:v2'],
		})
	})

	test('self referencing variable', () => {
		const variables = {
			abc: {
				def: '$(abc:def) + 1',
			},
		}
		expect(parseVariablesInString('$(abc:def)', variables)).toMatchObject({
			text: '$RE + 1',
			variableIds: ['abc:def', 'abc:def'],
		})
	})

	test('infinite referencing variable', () => {
		const variables = {
			abc: {
				def: '$(abc:second)_1',
				second: '$(abc:def)_2',
			},
		}
		expect(parseVariablesInString('$(abc:def)', variables)).toEqual({
			text: '$RE_2_1',
			variableIds: ['abc:def', 'abc:second', 'abc:def'],
		})
		expect(parseVariablesInString('$(abc:second)', variables)).toEqual({
			text: '$RE_1_2',
			variableIds: ['abc:second', 'abc:def', 'abc:second'],
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
		expect(parseVariablesInString('$(abc:def)', variables)).toEqual({
			text: 'second',
			variableIds: ['abc:def'],
		})
		expect(parseVariablesInString('$(abc:$(abc:def))', variables)).toEqual({
			text: 'val2',
			variableIds: ['abc:def', 'abc:second'],
		})
		expect(parseVariablesInString('$(abc:$(abc:third))', variables)).toEqual({
			text: '$NA',
			variableIds: ['abc:third', 'abc:nope'],
		})
	})
})

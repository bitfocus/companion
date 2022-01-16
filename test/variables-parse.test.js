const { parseVariablesInString } = require('../lib/variable')

describe('variable parsing', () => {
	test('undefined string', () => {
		expect(parseVariablesInString(undefined, {})).toBeUndefined()
	})

	test('empty string', () => {
		expect(parseVariablesInString('', {})).toBe('')
	})

	test('simple unknown variable', () => {
		expect(parseVariablesInString('$(abc:def)', {})).toBe('$NA')
	})
	test('malformed variable', () => {
		expect(parseVariablesInString('$(abc)', {})).toBe('$(abc)')
		expect(parseVariablesInString('$(abc:f', {})).toBe('$(abc:f')
		expect(parseVariablesInString('$(abc:)', {})).toBe('$(abc:)')
		expect(parseVariablesInString('$(:abc)', {})).toBe('$(:abc)')
	})

	test('unknown variable', () => {
		const variables = {
			abc: {
				def: 'val1',
			},
		}
		expect(parseVariablesInString('$(abc:def2) $(abc2:def)', variables)).toBe('$NA $NA')
		expect(parseVariablesInString('$(abc2:def)', variables)).toBe('$NA')
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
		expect(parseVariablesInString('$(abc:def)', variables)).toBe('val1')
		expect(parseVariablesInString('$(abc:def) $(abc:v2) $(another:str) $(abc:3)', variables)).toBe(
			'val1 val2 vvvv val3'
		)
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
		expect(parseVariablesInString('$(another:str) $(abc:v2) $(another:str2)', variables)).toBe('val1 val3 val2 val2')
	})

	test('self referencing variable', () => {
		const variables = {
			abc: {
				def: '$(abc:def) + 1',
			},
		}
		expect(parseVariablesInString('$(abc:def)', variables)).toBe('$RE + 1')
	})

	test('infinite referencing variable', () => {
		const variables = {
			abc: {
				def: '$(abc:second)_1',
				second: '$(abc:def)_2',
			},
		}
		expect(parseVariablesInString('$(abc:def)', variables)).toBe('$RE_2_1')
		expect(parseVariablesInString('$(abc:second)', variables)).toBe('$RE_1_2')
	})

	test('variable name from variable name', () => {
		const variables = {
			abc: {
				def: 'second',
				second: 'val2',
				third: 'nope',
			},
		}
		expect(parseVariablesInString('$(abc:def)', variables)).toBe('second')
		expect(parseVariablesInString('$(abc:$(abc:def))', variables)).toBe('val2')
		expect(parseVariablesInString('$(abc:$(abc:third))', variables)).toBe('$NA')
	})
})

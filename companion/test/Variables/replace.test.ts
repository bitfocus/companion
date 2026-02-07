import { describe, test, expect } from 'vitest'
import { replaceAllVariables } from '../../lib/Variables/Util.js'

describe('variable replacing', () => {
	const emptySet = new Set<string>()
	test('undefined string', () => {
		expect(replaceAllVariables(undefined as any, 'new-label', emptySet)).toBe(undefined)
	})

	test('empty string', () => {
		expect(replaceAllVariables('', 'new-label', emptySet)).toBe('')
	})

	test('string with no values', () => {
		expect(replaceAllVariables('some text here', 'new-label', emptySet)).toBe('some text here')
	})

	test('basic variable', () => {
		expect(replaceAllVariables('$(aaa:var)', 'new-label', emptySet)).toBe('$(new-label:var)')
	})

	test('multiple: new label longer', () => {
		expect(
			replaceAllVariables('P/T Pos.\n$(UE150:panPositionDeg)°\n$(UE150:tiltPositionDeg)°', 'new-label', emptySet)
		).toBe('P/T Pos.\n$(new-label:panPositionDeg)°\n$(new-label:tiltPositionDeg)°')
	})

	test('multiple: new label shorter', () => {
		expect(
			replaceAllVariables(
				'$(generic-module:title)\n$(generic-module:model)\n$(generic-module:version)',
				'new-label',
				emptySet
			)
		).toBe('$(new-label:title)\n$(new-label:model)\n$(new-label:version)')
	})

	test('preserve some labels', () => {
		const preserveSet = new Set<string>(['options'])
		expect(replaceAllVariables('$(options:abc) $(internal:def) $(other:xyz)', 'new-label', preserveSet)).toBe(
			'$(options:abc) $(new-label:def) $(new-label:xyz)'
		)
	})
})

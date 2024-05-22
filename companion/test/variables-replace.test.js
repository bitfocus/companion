import { replaceAllVariables } from '../lib/Instance/Variable.js'

describe('variable replacing', () => {
	test('undefined string', () => {
		expect(replaceAllVariables(undefined, 'new-label')).toBe(undefined)
	})

	test('empty string', () => {
		expect(replaceAllVariables('', 'new-label')).toBe('')
	})

	test('string with no values', () => {
		expect(replaceAllVariables('some text here', 'new-label')).toBe('some text here')
	})

	test('basic variable', () => {
		expect(replaceAllVariables('$(aaa:var)', 'new-label')).toBe('$(new-label:var)')
	})

	test('multiple: new label longer', () => {
		expect(replaceAllVariables('P/T Pos.\n$(UE150:panPositionDeg)°\n$(UE150:tiltPositionDeg)°', 'new-label')).toBe(
			'P/T Pos.\n$(new-label:panPositionDeg)°\n$(new-label:tiltPositionDeg)°'
		)
	})

	test('multiple: new label shorter', () => {
		expect(
			replaceAllVariables('$(generic-module:title)\n$(generic-module:model)\n$(generic-module:version)', 'new-label')
		).toBe('$(new-label:title)\n$(new-label:model)\n$(new-label:version)')
	})
})

import { describe, expect, it } from 'vitest'
import { unwrapPastedVariableReference } from '../variablePaste.js'

describe('unwrapPastedVariableReference', () => {
	it('leaves a plain name untouched (aside from trimming)', () => {
		expect(unwrapPastedVariableReference('myvar')).toBe('myvar')
		expect(unwrapPastedVariableReference('  myvar  ')).toBe('myvar')
	})

	it('returns empty/whitespace-only input unchanged', () => {
		expect(unwrapPastedVariableReference('')).toBe('')
		expect(unwrapPastedVariableReference('   ')).toBe('   ')
	})

	it('unwraps a $(...) reference to its inner text when no namespace is given', () => {
		expect(unwrapPastedVariableReference('$(local:myvar)')).toBe('local:myvar')
		expect(unwrapPastedVariableReference('$(internal:time_hms)')).toBe('internal:time_hms')
		expect(unwrapPastedVariableReference('  $(local:myvar)  ')).toBe('local:myvar')
	})

	it('strips the matching namespace prefix when given', () => {
		expect(unwrapPastedVariableReference('$(local:myvar)', 'local')).toBe('myvar')
		expect(unwrapPastedVariableReference('$(page:myvar)', 'page')).toBe('myvar')
	})

	it('leaves a non-matching namespace prefix in place', () => {
		expect(unwrapPastedVariableReference('$(page:myvar)', 'local')).toBe('page:myvar')
	})

	it('does not strip a bare namespace prefix without the $(...) wrapper', () => {
		expect(unwrapPastedVariableReference('local:myvar', 'local')).toBe('local:myvar')
	})
})

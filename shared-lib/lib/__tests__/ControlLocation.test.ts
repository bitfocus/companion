import { describe, expect, expectTypeOf, it } from 'vitest'
import { ControlLocationOption, LocalVariableLocationOption } from '../ControlLocation.js'
import {
	getFieldDefaultForControl,
	type CompanionInputFieldCheckboxExtended,
	type CompanionInputFieldTextInputExtended,
} from '../Model/Options.js'

describe('getFieldDefaultForControl', () => {
	it('uses the plain default when there is no override', () => {
		expect(getFieldDefaultForControl(ControlLocationOption, 'trigger')).toBe(ControlLocationOption.default)
	})

	it('uses the plain default when there is no control kind', () => {
		expect(getFieldDefaultForControl(LocalVariableLocationOption, null)).toBe(ControlLocationOption.default)
	})

	it('keeps the grid location default for buttons', () => {
		expect(getFieldDefaultForControl(LocalVariableLocationOption, 'bank')).toBe(ControlLocationOption.default)
	})

	it.each(['trigger', 'expression-variable', 'page'] as const)('defaults local variables to "this" on a %s', (kind) => {
		expect(getFieldDefaultForControl(LocalVariableLocationOption, kind)).toBe('this')
	})
})

describe('defaultForControlType types', () => {
	it('narrows the default to the values of the field', () => {
		expectTypeOf(getFieldDefaultForControl(LocalVariableLocationOption, 'trigger')).toEqualTypeOf<
			'this' | '$(this:page)/$(this:row)/$(this:column)'
		>()
	})

	it('must match the type of the default', () => {
		const field: CompanionInputFieldTextInputExtended = {
			id: 'test',
			type: 'textinput',
			label: 'Test',
			default: 'a',
			// @ts-expect-error a textinput override must be a string
			defaultForControlType: { trigger: 1 },
		}
		expect(getFieldDefaultForControl(field, 'trigger')).toBe(1)
	})

	it('requires a default unless the field type allows omitting it', () => {
		// @ts-expect-error a checkbox must have a default
		const checkbox: CompanionInputFieldCheckboxExtended = { id: 'test', type: 'checkbox', label: 'Test' }
		const textInput: CompanionInputFieldTextInputExtended = { id: 'test', type: 'textinput', label: 'Test' }
		expect(getFieldDefaultForControl(checkbox, null)).toBeUndefined()
		expect(getFieldDefaultForControl(textInput, null)).toBeUndefined()
	})
})

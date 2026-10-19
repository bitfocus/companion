import { describe, expect, it } from 'vitest'
import { SomeCompanionInputFieldSchema, type SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'
import {
	changeInputFieldType,
	commonAdvancedProperties,
	createInputField,
	getInputFieldTypeSpec,
	getPropertyEditorValue,
	InputFieldTypeSpecs,
	isInputFieldIdValid,
	makeInputFieldIdFromLabel,
	makeInputFieldIdUnique,
	setInputFieldLabel,
	setPropertyEditorValue,
} from '../InputFieldTypes.js'

describe('InputFieldTypeSpecs', () => {
	it('creates valid fields of every type', () => {
		for (const spec of InputFieldTypeSpecs) {
			const field = spec.create({ id: 'a', label: 'A' })
			expect(field.type).toBe(spec.type)
			expect(SomeCompanionInputFieldSchema.safeParse(field).error, spec.type).toBeUndefined()
		}
	})

	it('describes property editors which are valid fields', () => {
		for (const spec of InputFieldTypeSpecs) {
			for (const property of [...spec.properties, ...spec.advanced]) {
				expect(SomeCompanionInputFieldSchema.safeParse(property.field).error, property.field.id).toBeUndefined()
			}
		}
		for (const property of commonAdvancedProperties) {
			expect(SomeCompanionInputFieldSchema.safeParse(property.field).error, property.field.id).toBeUndefined()
		}
	})

	it('does not offer config only types', () => {
		expect(getInputFieldTypeSpec('secret-text')).toBeUndefined()
		expect(getInputFieldTypeSpec('bonjour-device')).toBeUndefined()
	})
})

describe('changeInputFieldType', () => {
	it('keeps the common properties', () => {
		const field: SomeCompanionInputField = {
			type: 'textinput',
			id: 'name',
			label: 'Name',
			description: 'desc',
			tooltip: 'tip',
			default: 'abc',
			multiline: true,
		}
		expect(changeInputFieldType(field, 'checkbox')).toEqual({
			type: 'checkbox',
			id: 'name',
			label: 'Name',
			description: 'desc',
			tooltip: 'tip',
			default: false,
		})
	})

	it('returns the same field for the same type', () => {
		const field: SomeCompanionInputField = { type: 'checkbox', id: 'a', label: 'A', default: true }
		expect(changeInputFieldType(field, 'checkbox')).toBe(field)
	})
})

describe('properties', () => {
	it('converts dropdown choices to and from table rows', () => {
		const spec = getInputFieldTypeSpec('dropdown')!
		const choices = spec.properties.find((p) => p.field.id === 'choices')!
		const field: SomeCompanionInputField = {
			type: 'dropdown',
			id: 'a',
			label: 'A',
			default: 'x',
			choices: [{ id: 'x', label: 'X' }],
		}

		const rows = getPropertyEditorValue(field, choices)
		expect(rows).toEqual([{ _id: '0', id: 'x', label: 'X' }])

		const updated = setPropertyEditorValue(field, choices, [
			{ _id: '0', id: 'x', label: 'X' },
			{ _id: 'new', id: 'y', label: 'Y' },
		])
		expect(updated).toMatchObject({
			choices: [
				{ id: 'x', label: 'X' },
				{ id: 'y', label: 'Y' },
			],
		})
	})

	it('removes a cleared optional property', () => {
		const spec = getInputFieldTypeSpec('textinput')!
		const placeholder = spec.advanced.find((p) => p.field.id === 'placeholder')!
		const field: SomeCompanionInputField = { type: 'textinput', id: 'a', label: 'A', placeholder: 'abc' }

		const updated = setPropertyEditorValue(field, placeholder, '')
		expect(updated).not.toHaveProperty('placeholder')
	})

	it('inverts allow expressions', () => {
		const allowExpressions = commonAdvancedProperties.find((p) => p.field.id === 'disableAutoExpression')!
		const field: SomeCompanionInputField = { type: 'checkbox', id: 'a', label: 'A', default: false }

		expect(getPropertyEditorValue(field, allowExpressions)).toBe(true)

		const updated = setPropertyEditorValue(field, allowExpressions, false)
		expect(updated.disableAutoExpression).toBe(true)
		expect(setPropertyEditorValue(updated, allowExpressions, true)).not.toHaveProperty('disableAutoExpression')
	})

	it('stores the visibility as an expression', () => {
		const visible = commonAdvancedProperties.find((p) => p.field.id === 'isVisibleUi')!
		const field: SomeCompanionInputField = { type: 'checkbox', id: 'a', label: 'A', default: false }

		const updated = setPropertyEditorValue(field, visible, '$(options:b) == 1')
		expect(updated.isVisibleUi).toEqual({ type: 'expression', fn: '$(options:b) == 1' })
		expect(getPropertyEditorValue(updated, visible)).toBe('$(options:b) == 1')
		expect(setPropertyEditorValue(updated, visible, ' ')).not.toHaveProperty('isVisibleUi')
	})
})

describe('ids', () => {
	it('derives an id from a label', () => {
		expect(makeInputFieldIdFromLabel(' Camera Input ')).toBe('camera_input')
		expect(makeInputFieldIdFromLabel('a:b')).toBe('a_b')
	})

	it('makes an id unique', () => {
		expect(makeInputFieldIdUnique('a', new Set())).toBe('a')
		expect(makeInputFieldIdUnique('a', new Set(['a']))).toBe('a_2')
		expect(makeInputFieldIdUnique('a', new Set(['a', 'a_2']))).toBe('a_3')
	})

	it('validates an id', () => {
		expect(isInputFieldIdValid('abc_1', new Set())).toBe(true)
		expect(isInputFieldIdValid('', new Set())).toBe(false)
		expect(isInputFieldIdValid('a b', new Set())).toBe(false)
		expect(isInputFieldIdValid('abc', new Set(['abc']))).toBe(false)
	})

	it('updates the id with the label while it has not been edited', () => {
		const field: SomeCompanionInputField = { type: 'checkbox', id: 'input', label: 'Input', default: false }
		const updated = setInputFieldLabel(field, 'Auto Take', new Set())
		expect(updated).toMatchObject({ id: 'auto_take', label: 'Auto Take' })
	})

	it('keeps an edited id when the label changes', () => {
		const field: SomeCompanionInputField = { type: 'checkbox', id: 'custom', label: 'Input', default: false }
		expect(setInputFieldLabel(field, 'Other', new Set())).toMatchObject({ id: 'custom', label: 'Other' })
	})

	it('keeps a following id unique', () => {
		const field: SomeCompanionInputField = { type: 'checkbox', id: 'input', label: 'Input', default: false }
		expect(setInputFieldLabel(field, 'Take', new Set(['take']))).toMatchObject({ id: 'take_2' })
	})

	it('creates a field with a unique id', () => {
		expect(createInputField(new Set())).toMatchObject({ id: 'input', label: 'Input' })
		expect(createInputField(new Set(['input']))).toMatchObject({ id: 'input_2', label: 'Input 2' })
	})
})

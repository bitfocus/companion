import { describe, expect, it } from 'vitest'
import {
	AUTHORABLE_INPUT_FIELD_TYPES,
	AuthorableInputFieldSchema,
	SomeCompanionInputFieldSchema,
	type SomeCompanionInputField,
} from '@companion-app/shared/Model/Options.js'
import {
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
	it('offers each type of field which a user can author', () => {
		expect(new Set(InputFieldTypeSpecs.map((spec) => spec.type))).toEqual(AUTHORABLE_INPUT_FIELD_TYPES)
		expect(InputFieldTypeSpecs).toHaveLength(AUTHORABLE_INPUT_FIELD_TYPES.size)
	})

	it('creates valid fields of every type', () => {
		for (const spec of InputFieldTypeSpecs) {
			const field = spec.create({ id: 'a', label: 'A' })
			expect(field.type).toBe(spec.type)
			expect(AuthorableInputFieldSchema.safeParse(field).error, spec.type).toBeUndefined()
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

	it('does not offer visibility or turning off expressions', () => {
		const ids = commonAdvancedProperties.map((p) => p.field.id)
		expect(ids).not.toContain('isVisibleUi')
		expect(ids).not.toContain('disableAutoExpression')
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
		expect(createInputField('textinput', new Set())).toEqual({
			type: 'textinput',
			id: 'text',
			label: 'Text',
			default: '',
		})
		expect(createInputField('textinput', new Set(['text']))).toMatchObject({ id: 'text_2', label: 'Text 2' })
		expect(createInputField('checkbox', new Set())).toMatchObject({
			type: 'checkbox',
			id: 'checkbox',
			label: 'Checkbox',
		})
	})
})

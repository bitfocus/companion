import { describe, expect, test } from 'vitest'
import { ActionSetsModelSchema } from '../Model/ActionModel.js'
import {
	ButtonReferenceButtonModelSchema,
	LayeredButtonModelSchema,
	PresetReferenceButtonModelSchema,
	SomeButtonModelSchema,
} from '../Model/ButtonModel.js'

const action = { type: 'action', id: 'a1', definitionId: 'send', connectionId: 'conn1', options: {} }
const emptyStep = {
	action_sets: { down: [], up: [], rotate_left: undefined, rotate_right: undefined },
	options: { runWhileHeld: [] },
}

describe('LayeredButtonModelSchema', () => {
	test('a minimal layered button is given every default', () => {
		expect(LayeredButtonModelSchema.parse({ type: 'button-layered' })).toEqual({
			type: 'button-layered',
			feedbacks: [],
			localVariables: [],
			steps: { '0': emptyStep },
			options: { stepProgression: 'auto', rotaryActions: false, canModifyStyleInApis: false },
			style: { layers: [] },
		})
	})

	test('an empty set of steps is kept, rather than replaced with a step', () => {
		expect(LayeredButtonModelSchema.parse({ type: 'button-layered', steps: {} }).steps).toEqual({})
	})

	test('a step is given empty action sets and options', () => {
		const button = LayeredButtonModelSchema.parse({ type: 'button-layered', steps: { '0': {}, '1': {} } })

		expect(button.steps).toEqual({ '0': emptyStep, '1': emptyStep })
	})

	test('keeps the options that are set', () => {
		const options = {
			stepProgression: 'expression',
			stepExpression: '$(local:step)',
			rotaryActions: true,
			canModifyStyleInApis: true,
			notes: 'Cue the lights',
		}

		expect(LayeredButtonModelSchema.parse({ type: 'button-layered', options }).options).toEqual(options)
	})

	test('parses the entities of its feedbacks, local variables and steps', () => {
		const button = LayeredButtonModelSchema.parse({
			type: 'button-layered',
			feedbacks: [{ ...action, type: 'feedback', id: 'f1' }],
			localVariables: [{ ...action, type: 'feedback', id: 'v1', variableName: 'count' }],
			steps: { '0': { action_sets: { down: [action] } } },
		})

		expect(button.feedbacks[0]).toMatchObject({ type: 'feedback', id: 'f1' })
		expect(button.localVariables[0]).toMatchObject({ variableName: 'count' })
		expect(button.steps['0'].action_sets.down).toEqual([{ ...action, upgradeIndex: undefined }])
	})

	test('parses its style elements', () => {
		const button = LayeredButtonModelSchema.parse({
			type: 'button-layered',
			style: {
				layers: [
					{ type: 'canvas', id: 'canvas' },
					{ type: 'text', id: 't1' },
				],
			},
		})

		expect(button.style.layers.map((layer) => layer.type)).toEqual(['canvas', 'text'])
		expect(button.style.layers[1]).toHaveProperty('fontsize')
	})

	test('rejects an invalid step progression, entity or element', () => {
		const invalid = [
			{ options: { stepProgression: 'sometimes' } },
			{ feedbacks: [{ ...action, id: 5 }] },
			{ style: { layers: [{ type: 'sparkle', id: 'x' }] } },
		]
		for (const fields of invalid) {
			expect(
				LayeredButtonModelSchema.safeParse({ type: 'button-layered', ...fields }).success,
				JSON.stringify(fields)
			).toBe(false)
		}
	})
})

describe('ActionSetsModelSchema', () => {
	test('keeps the rotation and hold duration sets', () => {
		const sets = ActionSetsModelSchema.parse({
			down: [],
			up: [action],
			rotate_left: [action],
			'500': [action],
			'1000': [],
		})

		expect(sets).toEqual({
			down: [],
			up: [{ ...action, upgradeIndex: undefined }],
			rotate_left: [{ ...action, upgradeIndex: undefined }],
			rotate_right: undefined,
			'500': [{ ...action, upgradeIndex: undefined }],
			'1000': [],
		})
	})

	test('rejects an invalid entity in any set', () => {
		expect(ActionSetsModelSchema.safeParse({ down: [], up: [], '500': [{ ...action, id: 5 }] }).success).toBe(false)
	})
})

describe('PresetReferenceButtonModelSchema', () => {
	const presetRef = { connectionId: 'conn1', moduleId: 'mod', presetId: 'p1' }

	test('keeps its reference, without variable values by default', () => {
		const button = PresetReferenceButtonModelSchema.parse({ type: 'preset-reference', presetRef, checksum: 'abc' })

		expect(button.presetRef).toEqual({ ...presetRef, variableValues: null })
		expect(button.checksum).toBe('abc')
		expect(button.steps).toEqual({ '0': emptyStep })
	})

	test('keeps its variable values', () => {
		const variableValues = { count: 3, name: 'x' }

		expect(
			PresetReferenceButtonModelSchema.parse({ type: 'preset-reference', presetRef: { ...presetRef, variableValues } })
				.presetRef.variableValues
		).toEqual(variableValues)
	})

	test('rejects one without its reference', () => {
		expect(PresetReferenceButtonModelSchema.safeParse({ type: 'preset-reference' }).success).toBe(false)
		expect(
			PresetReferenceButtonModelSchema.safeParse({ type: 'preset-reference', presetRef: { connectionId: 'conn1' } })
				.success
		).toBe(false)
	})
})

describe('ButtonReferenceButtonModelSchema', () => {
	test('keeps its location', () => {
		const options = { location: { isExpression: true, value: '$(this:page)/0/0' }, notes: 'Mirror' }

		expect(ButtonReferenceButtonModelSchema.parse({ type: 'button-reference', options })).toEqual({
			type: 'button-reference',
			options,
		})
	})

	test('rejects one without its location', () => {
		expect(ButtonReferenceButtonModelSchema.safeParse({ type: 'button-reference', options: {} }).success).toBe(false)
	})
})

describe('SomeButtonModelSchema', () => {
	test.each(['pagenum', 'pageup', 'pagedown'])('a %s button is just its type', (type) => {
		expect(SomeButtonModelSchema.parse({ type, style: {}, steps: {} })).toEqual({ type })
	})

	test('rejects a button of an unknown type', () => {
		expect(SomeButtonModelSchema.safeParse({ type: 'button-sparkle' }).success).toBe(false)
	})

	test('parsing a parsed button changes nothing', () => {
		const once = SomeButtonModelSchema.parse({
			type: 'button-layered',
			steps: { '0': { action_sets: { down: [action], '500': [action] } } },
			style: { layers: [{ type: 'canvas', id: 'canvas' }] },
		})

		expect(SomeButtonModelSchema.parse(once)).toEqual(once)
	})
})

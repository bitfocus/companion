import { describe, expect, test } from 'vitest'
import { ActionSetsModelSchema } from '../Model/ActionModel.js'
import {
	ButtonReferenceButtonModelSchema,
	LayeredButtonModelSchema,
	PresetReferenceButtonModelSchema,
	SomeButtonModelSchema,
} from '../Model/ButtonModel.js'
import { SomeControlModelSchema } from '../Model/Controls.js'
import { CustomActionModelSchema, getCustomActionCallsExcludedFrom } from '../Model/CustomActionModel.js'
import { EventInstanceSchema } from '../Model/EventModel.js'
import { ExpressionVariableModelSchema } from '../Model/ExpressionVariableModel.js'
import { PageControlModelSchema } from '../Model/PageControlModel.js'
import { TriggerModelSchema } from '../Model/TriggerModel.js'

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

describe('TriggerModelSchema', () => {
	test('a minimal trigger is given every default', () => {
		expect(TriggerModelSchema.parse({ type: 'trigger' })).toEqual({
			type: 'trigger',
			options: { name: 'New Trigger', enabled: false, sortOrder: 0 },
			actions: [],
			condition: [],
			events: [],
			localVariables: [],
		})
	})

	test('keeps its options, entities and events', () => {
		const trigger = TriggerModelSchema.parse({
			type: 'trigger',
			options: { name: 'Show start', enabled: true, sortOrder: 3, collectionId: 'col', notes: 'n' },
			actions: [action],
			condition: [{ ...action, type: 'feedback', id: 'f1' }],
			events: [{ id: 'e1', type: 'interval', enabled: true, options: { seconds: 5 } }],
		})

		expect(trigger.options).toEqual({
			name: 'Show start',
			enabled: true,
			sortOrder: 3,
			collectionId: 'col',
			notes: 'n',
		})
		expect(trigger.actions).toHaveLength(1)
		expect(trigger.condition[0]).toMatchObject({ type: 'feedback', id: 'f1' })
		expect(trigger.events).toEqual([{ id: 'e1', type: 'interval', enabled: true, options: { seconds: 5 } }])
	})

	test('rejects an invalid entity or event', () => {
		expect(TriggerModelSchema.safeParse({ type: 'trigger', actions: [{ ...action, id: 5 }] }).success).toBe(false)
		expect(TriggerModelSchema.safeParse({ type: 'trigger', events: [{ type: 'interval' }] }).success).toBe(false)
	})
})

describe('EventInstanceSchema', () => {
	test('an event saved without being enabled is disabled, with no options', () => {
		expect(EventInstanceSchema.parse({ id: 'e1', type: 'startup' })).toEqual({
			id: 'e1',
			type: 'startup',
			enabled: false,
			options: {},
		})
	})
})

describe('ExpressionVariableModelSchema', () => {
	test('a minimal expression variable is given every default', () => {
		expect(ExpressionVariableModelSchema.parse({ type: 'expression-variable' })).toEqual({
			type: 'expression-variable',
			options: { variableName: '', description: 'An expression variable', sortOrder: 0 },
			entity: null,
			localVariables: [],
		})
	})

	test('keeps its entity', () => {
		const variable = ExpressionVariableModelSchema.parse({
			type: 'expression-variable',
			options: { variableName: 'total' },
			entity: { ...action, type: 'feedback' },
		})

		expect(variable.options.variableName).toBe('total')
		expect(variable.entity).toMatchObject({ type: 'feedback', id: 'a1' })
	})
})

describe('CustomActionModelSchema', () => {
	test('a minimal custom action gets the defaults', () => {
		expect(CustomActionModelSchema.parse({ type: 'custom-action' })).toEqual({
			type: 'custom-action',
			options: { name: 'New custom action', description: '', sortOrder: 0 },
			inputs: [],
			actions: [],
			localVariables: [],
			outputs: [],
		})
	})

	test('an input must be a valid input field', () => {
		const result = CustomActionModelSchema.safeParse({ type: 'custom-action', inputs: [{ type: 'sparkle', id: 'a' }] })
		expect(result.success).toBe(false)
	})

	test.each([
		['a type for connection config', { type: 'secret-text', id: 'key', label: 'Key' }],
		['an id which is not usable in a variable', { type: 'checkbox', id: 'a b', label: 'A', default: false }],
	])('an input can not have %s', (_name, input) => {
		expect(CustomActionModelSchema.safeParse({ type: 'custom-action', inputs: [input] }).success).toBe(false)
	})
})

describe('getCustomActionCallsExcludedFrom', () => {
	const customActions: [string, { calledCustomActionIds: string[] }][] = [
		['custom-action:a', { calledCustomActionIds: ['b', 'c'] }],
		['custom-action:b', { calledCustomActionIds: ['c'] }],
		['custom-action:c', { calledCustomActionIds: [] }],
	]

	test('excludes the custom action itself, and any which call it', () => {
		expect(getCustomActionCallsExcludedFrom('custom-action:c', customActions)).toEqual(
			new Set(['__custom-actions__:c', '__custom-actions__:a', '__custom-actions__:b'])
		)
		expect(getCustomActionCallsExcludedFrom('custom-action:a', customActions)).toEqual(
			new Set(['__custom-actions__:a'])
		)
	})

	test('excludes nothing from a control which is not a custom action', () => {
		expect(getCustomActionCallsExcludedFrom('bank:abc', customActions)).toEqual(new Set())
	})
})

describe('PageControlModelSchema', () => {
	test('a page control without local variables has none', () => {
		expect(PageControlModelSchema.parse({ type: 'page' })).toEqual({ type: 'page', localVariables: [] })
	})
})

describe('SomeControlModelSchema', () => {
	test.each([
		['button-layered', { type: 'button-layered' }],
		['trigger', { type: 'trigger' }],
		['expression-variable', { type: 'expression-variable' }],
		['custom-action', { type: 'custom-action' }],
		['page', { type: 'page' }],
		['pageup', { type: 'pageup' }],
	])('parses a %s control', (type, control) => {
		expect(SomeControlModelSchema.parse(control).type).toBe(type)
	})

	test('rejects a control of an unknown type', () => {
		expect(SomeControlModelSchema.safeParse({ type: 'sparkle' }).success).toBe(false)
	})
})

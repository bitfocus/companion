import { describe, expect, test } from 'vitest'
import type { SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'
import type { ButtonGraphicsCompositeElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { CompositeElementDefinitionsStore } from '~/Stores/CompositeElementDefinitionsStore.js'
import { getElementSchemaSections, getHiddenCompositeOptionFields } from '../useElementSchema.js'

// The ui definition of a composite: ids are `opt:` prefixed, but the expressions use the module's own ids
const OPTIONS: SomeCompanionInputField[] = [
	{
		id: 'opt:shape',
		type: 'dropdown',
		label: 'Shape',
		default: 'circle',
		choices: [
			{ id: 'circle', label: 'Circle' },
			{ id: 'rect', label: 'Rectangle' },
		],
		disableAutoExpression: true,
	},
	{
		id: 'opt:radius',
		type: 'number',
		label: 'Radius',
		default: 10,
		min: 0,
		max: 100,
		isVisibleUi: { type: 'expression', fn: "$(options:shape) == 'circle'", data: undefined },
	},
	{
		id: 'opt:width',
		type: 'number',
		label: 'Width',
		default: 20,
		min: 0,
		max: 100,
		isVisibleUi: { type: 'expression', fn: "$(options:shape) == 'rect'", data: undefined },
	},
	{
		id: 'opt:size',
		type: 'number',
		label: 'Size',
		default: 20,
		min: 0,
		max: 100,
	},
	{
		id: 'opt:expr',
		type: 'expression',
		label: 'Expr',
		default: '',
		disableAutoExpression: true,
	},
	{
		id: 'opt:exprDependent',
		type: 'number',
		label: 'Expr dependent',
		default: 0,
		min: 0,
		max: 100,
		// expression fields are always expressions, so may not be referenced
		isVisibleUi: { type: 'expression', fn: "$(options:expr) == 'x'", data: undefined },
	},
	{
		id: 'opt:label',
		type: 'textinput',
		label: 'Label',
		default: '',
		// size can be an expression, so may not be referenced
		isVisibleUi: { type: 'expression', fn: '$(options:size) > 10', data: undefined },
	},
]

function composite(options: Record<`opt:${string}`, unknown>): ButtonGraphicsCompositeElement {
	const element: Record<string, unknown> = {
		id: 'el1',
		name: '',
		type: 'composite',
		connectionId: 'conn1',
		elementId: 'shape',
	}
	for (const [key, value] of Object.entries(options)) {
		element[key] = { isExpression: false, value }
	}
	return element as unknown as ButtonGraphicsCompositeElement
}

describe('getHiddenCompositeOptionFields', () => {
	test('hides options by the value of a disableAutoExpression sibling', () => {
		expect(getHiddenCompositeOptionFields(composite({ 'opt:shape': 'circle' }), OPTIONS)).toEqual(
			new Set(['opt:width'])
		)
		expect(getHiddenCompositeOptionFields(composite({ 'opt:shape': 'rect' }), OPTIONS)).toEqual(new Set(['opt:radius']))
	})

	test('an expression referencing an option which can be an expression leaves the field visible', () => {
		const hidden = getHiddenCompositeOptionFields(composite({ 'opt:shape': 'circle', 'opt:size': 5 }), OPTIONS)
		expect(hidden.has('opt:label')).toBe(false)
	})

	test('an expression referencing an expression field leaves the field visible', () => {
		const hidden = getHiddenCompositeOptionFields(composite({ 'opt:shape': 'circle', 'opt:expr': 'y' }), OPTIONS)
		expect(hidden.has('opt:exprDependent')).toBe(false)
	})
})

describe('getElementSchemaSections', () => {
	test('omits hidden composite options from the properties section', () => {
		const definitions = new CompositeElementDefinitionsStore()
		definitions.updateStore({
			type: 'init',
			definitions: { conn1: { shape: { name: 'Shape', sortKey: null, description: undefined, options: OPTIONS } } },
		})

		const sections = getElementSchemaSections(composite({ 'opt:shape': 'rect' }), definitions)
		const properties = sections?.find((section) => section.id === 'properties')
		expect(properties?.fields.map((field) => field.id)).toEqual([
			'opt:shape',
			'opt:width',
			'opt:size',
			'opt:expr',
			'opt:exprDependent',
			'opt:label',
		])
	})
})

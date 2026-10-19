import type { JsonValue } from 'type-fest'
import type { DropdownChoice } from '@companion-app/shared/Model/Common.js'
import {
	CompanionFieldVariablesSupport,
	type IsVisibleUiFn,
	type SomeCompanionInputField,
} from '@companion-app/shared/Model/Options.js'
import { stringifyVariableValue } from '@companion-app/shared/Model/Variables.js'

/**
 * The properties of a field which are kept when its type is changed
 */
export type InputFieldCommonProps = Pick<
	SomeCompanionInputField,
	'id' | 'label' | 'tooltip' | 'description' | 'disableAutoExpression' | 'isVisibleUi'
>

/**
 * An editable property of a field definition
 */
export interface InputFieldPropertySpec {
	/** The editor for this property. Its id is the name of the property on the field definition */
	field: SomeCompanionInputField
	/** Convert the stored value of the property to the value for the editor */
	toEditor?: (value: unknown) => JsonValue | undefined
	/** Convert the value from the editor to the value to store for the property */
	fromEditor?: (value: JsonValue | undefined) => unknown
}

/**
 * Describes how to author a field of a type
 */
export interface InputFieldTypeSpec {
	type: SomeCompanionInputField['type']
	label: string
	/** Whether a field of this type has a default value */
	hasDefault: boolean
	/** Create a new field of this type, keeping the common properties of the field it replaces */
	create: (common: InputFieldCommonProps) => SomeCompanionInputField
	/** Properties which a field of this type is not usable without, always shown */
	properties: InputFieldPropertySpec[]
	/** Optional properties, shown in the advanced section */
	advanced: InputFieldPropertySpec[]
}

const choicesProperty: InputFieldPropertySpec = {
	field: {
		type: 'internal:table',
		id: 'choices',
		label: 'Choices',
		default: [],
		columns: [
			{ type: 'textinput', id: 'id', label: 'Value', default: '' },
			{ type: 'textinput', id: 'label', label: 'Label', default: '' },
		],
	},
	toEditor: (value) =>
		((value as DropdownChoice[] | undefined) ?? []).map((choice, i) => ({
			_id: String(i),
			id: choice.id,
			label: choice.label,
		})),
	fromEditor: (value) =>
		((value as Record<string, JsonValue>[] | undefined) ?? []).map((row): DropdownChoice => ({
			id: stringifyVariableValue(row.id) ?? '',
			label: stringifyVariableValue(row.label) ?? '',
		})),
}

function checkboxProperty(id: string, label: string, tooltip?: string): InputFieldPropertySpec {
	return { field: { type: 'checkbox', id, label, tooltip, default: false } }
}

function numberProperty(id: string, label: string, defaultValue: number | null): InputFieldPropertySpec {
	return {
		field: {
			type: 'number',
			id,
			label,
			default: defaultValue,
			min: Number.MIN_SAFE_INTEGER,
			max: Number.MAX_SAFE_INTEGER,
			allowNull: defaultValue === null,
		},
		// An unset property is shown as 'auto', and stored as unset
		toEditor: (value) => (typeof value === 'number' ? value : defaultValue),
		fromEditor: (value) => (typeof value === 'number' ? value : undefined),
	}
}

function textProperty(id: string, label: string, multiline?: boolean): InputFieldPropertySpec {
	return {
		field: { type: 'textinput', id, label, default: '', multiline },
		fromEditor: (value) => (typeof value === 'string' && value !== '' ? value : undefined),
	}
}

/** Properties which every type has, shown in the advanced section */
export const commonAdvancedProperties: InputFieldPropertySpec[] = [
	textProperty('description', 'Description'),
	textProperty('tooltip', 'Tooltip'),
	{
		field: {
			type: 'checkbox',
			id: 'disableAutoExpression',
			label: 'Allow expressions',
			tooltip: 'Whether the value of this input can be an expression',
			default: true,
		},
		toEditor: (value) => !value,
		fromEditor: (value) => (value ? undefined : true),
	},
	{
		field: {
			type: 'expression',
			id: 'isVisibleUi',
			label: 'Visible when',
			description:
				'An expression which decides whether this input is shown. It can only reference inputs which do not allow expressions, with $(options:<id>)',
		},
		toEditor: (value) => (value as IsVisibleUiFn | undefined)?.fn ?? '',
		fromEditor: (value): IsVisibleUiFn | undefined =>
			typeof value === 'string' && value.trim() !== '' ? { type: 'expression', fn: value } : undefined,
	},
]

/**
 * The types of field which a user can author, and how to edit each of them
 */
export const InputFieldTypeSpecs: InputFieldTypeSpec[] = [
	{
		type: 'textinput',
		label: 'Text',
		hasDefault: true,
		create: (common) => ({ ...common, type: 'textinput', default: '' }),
		properties: [],
		advanced: [
			textProperty('placeholder', 'Placeholder'),
			checkboxProperty('multiline', 'Multiline'),
			{
				...checkboxProperty('useVariables', 'Parse variables', 'Whether variables in the text are replaced'),
				toEditor: (value) => !!value,
				fromEditor: (value) => (value ? CompanionFieldVariablesSupport.InternalParser : undefined),
			},
			textProperty('regex', 'Validation regex'),
			numberProperty('minLength', 'Minimum length', null),
		],
	},
	{
		type: 'number',
		label: 'Number',
		hasDefault: true,
		create: (common) => ({ ...common, type: 'number', default: 0, min: 0, max: 100 }),
		properties: [numberProperty('min', 'Minimum', 0), numberProperty('max', 'Maximum', 100)],
		advanced: [
			numberProperty('step', 'Step', null),
			checkboxProperty('range', 'Show a slider'),
			checkboxProperty('asInteger', 'Whole numbers only'),
			checkboxProperty(
				'clampValues',
				'Clamp values',
				'Clamp values to the minimum and maximum, instead of rejecting them'
			),
		],
	},
	{
		type: 'checkbox',
		label: 'Checkbox',
		hasDefault: true,
		create: (common) => ({ ...common, type: 'checkbox', default: false }),
		properties: [],
		advanced: [checkboxProperty('displayToggle', 'Show as a toggle')],
	},
	{
		type: 'dropdown',
		label: 'Dropdown',
		hasDefault: true,
		create: (common) => ({ ...common, type: 'dropdown', default: '', choices: [] }),
		properties: [choicesProperty],
		advanced: [checkboxProperty('allowCustom', 'Allow custom values'), textProperty('regex', 'Custom value regex')],
	},
	{
		type: 'multidropdown',
		label: 'Multi-select dropdown',
		hasDefault: true,
		create: (common) => ({ ...common, type: 'multidropdown', default: [], choices: [] }),
		properties: [choicesProperty],
		advanced: [
			numberProperty('minSelection', 'Minimum selected', null),
			numberProperty('maxSelection', 'Maximum selected', null),
			checkboxProperty('sortSelection', 'Sort the selection'),
			checkboxProperty('allowCustom', 'Allow custom values'),
		],
	},
	{
		type: 'colorpicker',
		label: 'Color',
		hasDefault: true,
		create: (common) => ({
			...common,
			type: 'colorpicker',
			default: 0xffffff,
			enableAlpha: false,
			returnType: 'number',
		}),
		properties: [],
		advanced: [
			checkboxProperty('enableAlpha', 'Allow transparency'),
			{
				field: {
					type: 'dropdown',
					id: 'returnType',
					label: 'Value format',
					default: 'number',
					choices: [
						{ id: 'number', label: 'Number' },
						{ id: 'string', label: 'CSS string' },
					],
				},
			},
		],
	},
	{
		type: 'expression',
		label: 'Expression',
		hasDefault: true,
		create: (common) => ({ ...common, type: 'expression', default: '' }),
		properties: [],
		advanced: [],
	},
	{
		type: 'static-text',
		label: 'Static text',
		hasDefault: false,
		create: (common) => ({ ...common, type: 'static-text', value: '' }),
		properties: [textProperty('value', 'Text', true)],
		advanced: [],
	},
	{
		type: 'internal:page',
		label: 'Page',
		hasDefault: true,
		create: (common) => ({
			...common,
			type: 'internal:page',
			default: 0,
			includeStartup: false,
			includeDirection: false,
		}),
		properties: [],
		advanced: [
			checkboxProperty('includeStartup', 'Include startup page'),
			checkboxProperty('includeDirection', 'Include back and forward'),
		],
	},
	{
		type: 'internal:custom_variable',
		label: 'Custom variable',
		hasDefault: false,
		create: (common) => ({ ...common, type: 'internal:custom_variable' }),
		properties: [],
		advanced: [checkboxProperty('includeNone', 'Include none')],
	},
	{
		type: 'internal:connection_id',
		label: 'Connection',
		hasDefault: false,
		create: (common) => ({ ...common, type: 'internal:connection_id', multiple: false }),
		properties: [],
		advanced: [checkboxProperty('multiple', 'Allow multiple'), checkboxProperty('includeAll', 'Include all')],
	},
]

/**
 * Find how to edit a field of a type, if it can be authored by a user
 */
export function getInputFieldTypeSpec(type: SomeCompanionInputField['type']): InputFieldTypeSpec | undefined {
	return InputFieldTypeSpecs.find((spec) => spec.type === type)
}

/**
 * Get the value of a property of a field, for its editor
 */
export function getPropertyEditorValue(
	field: SomeCompanionInputField,
	property: InputFieldPropertySpec
): JsonValue | undefined {
	const value = (field as Record<string, unknown>)[property.field.id]
	return property.toEditor ? property.toEditor(value) : (value as JsonValue | undefined)
}

/**
 * Set the value of a property of a field, from its editor
 */
export function setPropertyEditorValue(
	field: SomeCompanionInputField,
	property: InputFieldPropertySpec,
	editorValue: JsonValue | undefined
): SomeCompanionInputField {
	const value = property.fromEditor ? property.fromEditor(editorValue) : editorValue
	const updated: Record<string, unknown> = { ...field, [property.field.id]: value }
	if (value === undefined) delete updated[property.field.id]
	return updated as SomeCompanionInputField
}

/**
 * Change the type of a field, keeping the properties shared by all fields
 */
export function changeInputFieldType(
	field: SomeCompanionInputField,
	type: SomeCompanionInputField['type']
): SomeCompanionInputField {
	const spec = getInputFieldTypeSpec(type)
	if (!spec || field.type === type) return field

	const common: InputFieldCommonProps = { id: field.id, label: field.label }
	if (field.tooltip !== undefined) common.tooltip = field.tooltip
	if (field.description !== undefined) common.description = field.description
	if (field.disableAutoExpression !== undefined) common.disableAutoExpression = field.disableAutoExpression
	if (field.isVisibleUi !== undefined) common.isVisibleUi = field.isVisibleUi

	return spec.create(common)
}

/**
 * Derive the id of a field from its label
 */
export function makeInputFieldIdFromLabel(label: string): string {
	return label
		.trim()
		.toLowerCase()
		.replace(/[^\w-]/g, '_')
}

/**
 * Check if a field id is usable, and is not used by another field
 */
export function isInputFieldIdValid(id: string, otherIds: ReadonlySet<string>): boolean {
	return id !== '' && makeInputFieldIdFromLabel(id) === id && !otherIds.has(id)
}

/**
 * Make an id unique against some other ids, by adding a numeric suffix
 */
export function makeInputFieldIdUnique(id: string, otherIds: ReadonlySet<string>): string {
	if (!otherIds.has(id)) return id

	let i = 2
	while (otherIds.has(`${id}_${i}`)) i++
	return `${id}_${i}`
}

/**
 * Update the label of a field. While the id has not been edited by the user (it still matches the label),
 * it follows the label
 */
export function setInputFieldLabel(
	field: SomeCompanionInputField,
	label: string,
	otherIds: ReadonlySet<string>
): SomeCompanionInputField {
	const idFollowsLabel =
		field.id === '' || field.id === makeInputFieldIdUnique(makeInputFieldIdFromLabel(field.label), otherIds)
	if (!idFollowsLabel) return { ...field, label }

	return { ...field, label, id: makeInputFieldIdUnique(makeInputFieldIdFromLabel(label), otherIds) }
}

/**
 * Create a new field, with an id which is unique against some other ids
 */
export function createInputField(otherIds: ReadonlySet<string>): SomeCompanionInputField {
	const id = makeInputFieldIdUnique('input', otherIds)
	return { type: 'textinput', id, label: id === 'input' ? 'Input' : `Input ${id.slice('input_'.length)}`, default: '' }
}

import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import type {
	CompanionInputFieldBaseExtended,
	CompanionInputFieldBonjourDeviceExtended,
	CompanionInputFieldCheckboxExtended,
	CompanionInputFieldColorExtended,
	CompanionInputFieldCustomVariableExtended,
	CompanionInputFieldDropdownExtended,
	CompanionInputFieldMultiDropdownExtended,
	CompanionInputFieldNumberExtended,
	CompanionInputFieldSecretExtended,
	CompanionInputFieldStaticTextExtended,
	CompanionInputFieldTextInputExtended,
	SomeCompanionInputField,
} from '@companion-app/shared/Model/Options.js'
import { assertNever } from '@companion-app/shared/Util.js'
import type {
	CompanionInputFieldBase,
	CompanionInputFieldCheckbox,
	CompanionInputFieldColor,
	CompanionInputFieldCustomVariable,
	CompanionInputFieldDropdown,
	CompanionInputFieldMultiDropdown,
	CompanionInputFieldNumber,
	CompanionInputFieldStaticText,
	CompanionInputFieldTextInput,
	SomeCompanionActionInputField,
	SomeCompanionConfigField,
	SomeCompanionFeedbackInputField,
	Complete,
} from '@companion-module/base'

export function translateConnectionConfigFields(fields: SomeCompanionConfigField[]): SomeCompanionInputField[] {
	return fields.map((raw) => {
		const o = raw
		switch (o.type) {
			case 'bonjour-device':
				return {
					...translateCommonFields(o),
					type: 'bonjour-device',
					width: o.width,
				} satisfies Complete<CompanionInputFieldBonjourDeviceExtended>
			case 'secret-text':
				return {
					...translateCommonFields(o),
					type: 'secret-text',
					width: o.width,
					default: o.default,
					required: o.required,
					regex: o.regex,
				} satisfies Complete<CompanionInputFieldSecretExtended>

			case 'static-text':
				return translateStaticTextField(o, o.width)
			case 'textinput':
				return translateTextInputField(o, o.width, false)
			case 'checkbox':
				return translateCheckboxField(o, o.width)
			case 'colorpicker':
				return translateColorPickerField(o, o.width)
			case 'number':
				return translateNumberField(o, o.width)
			case 'dropdown':
				return translateDropdownField(o, o.width)
			case 'multidropdown':
				return translateMultiDropdownField(o, o.width)

			default:
				assertNever(o)
				return generateUnsupportedField(raw, raw.width)
		}
	})
}

export function translateEntityInputFields(
	fields: (SomeCompanionActionInputField | SomeCompanionFeedbackInputField)[],
	entityType: EntityModelType
): SomeCompanionInputField[] {
	return fields.map((raw) => {
		const o = raw
		switch (o.type) {
			case 'static-text':
				return translateStaticTextField(o, 0)
			case 'textinput':
				return translateTextInputField(o, 0, true)
			case 'checkbox':
				return translateCheckboxField(o, 0)
			case 'colorpicker':
				return translateColorPickerField(o, 0)
			case 'number':
				return translateNumberField(o, 0)
			case 'dropdown':
				return translateDropdownField(o, 0)
			case 'multidropdown':
				return translateMultiDropdownField(o, 0)
			case 'custom-variable':
				if (entityType === EntityModelType.Action) {
					return translateCustomVariableField(o, 0)
				} else {
					return generateUnsupportedField(raw, 0)
				}

			default:
				assertNever(o)
				return generateUnsupportedField(o, 0)
		}
	})
}

function generateUnsupportedField<T extends CompanionInputFieldBase>(
	field: T,
	width: number
): Complete<CompanionInputFieldStaticTextExtended> {
	return {
		...translateCommonFields(field),
		type: 'static-text',
		width: width,
		value: `Unsupported field type ${field.type}`,
		default: undefined,
	}
}

function translateStaticTextField(
	field: CompanionInputFieldStaticText,
	width: number
): Complete<CompanionInputFieldStaticTextExtended> {
	return {
		...translateCommonFields(field),
		type: 'static-text',
		value: field.value,
		width: width,
		description: field.description,
		default: undefined,
	}
}
function translateTextInputField(
	field: CompanionInputFieldTextInput,
	width: number,
	usesInternalVariableParsing: boolean
): Complete<CompanionInputFieldTextInputExtended> {
	return {
		...translateCommonFields(field),
		type: 'textinput',
		default: field.default,
		regex: field.regex,
		required: field.required,
		width: width,
		useVariables: field.useVariables && usesInternalVariableParsing ? { local: true } : undefined,
		multiline: field.multiline,
		placeholder: undefined, // Not supported from modules
		isExpression: false, // Not supported from modules
	}
}
function translateCheckboxField(
	field: CompanionInputFieldCheckbox,
	width: number
): Complete<CompanionInputFieldCheckboxExtended> {
	return {
		...translateCommonFields(field),
		type: 'checkbox',
		default: field.default,
		width: width,
		displayToggle: false,
	}
}
function translateColorPickerField(
	field: CompanionInputFieldColor,
	width: number
): Complete<CompanionInputFieldColorExtended> {
	return {
		...translateCommonFields(field),
		type: 'colorpicker',
		default: field.default,
		enableAlpha: field.enableAlpha,
		returnType: field.returnType,
		presetColors: field.presetColors,
		width: width,
	}
}
function translateNumberField(
	field: CompanionInputFieldNumber,
	width: number
): Complete<CompanionInputFieldNumberExtended> {
	return {
		...translateCommonFields(field),
		type: 'number',
		default: field.default,
		min: field.min,
		max: field.max,
		step: field.step,
		width: width,
		required: field.required,
		range: field.range,
		showMinAsNegativeInfinity: field.showMinAsNegativeInfinity,
		showMaxAsPositiveInfinity: field.showMaxAsPositiveInfinity,
	}
}
function translateDropdownField(
	field: CompanionInputFieldDropdown,
	width: number
): Complete<CompanionInputFieldDropdownExtended> {
	return {
		...translateCommonFields(field),
		type: 'dropdown',
		width: width,
		default: field.default,
		choices: field.choices,
		allowCustom: field.allowCustom,
		regex: field.regex,
		minChoicesForSearch: field.minChoicesForSearch,
	}
}
function translateMultiDropdownField(
	field: CompanionInputFieldMultiDropdown,
	width: number
): Complete<CompanionInputFieldMultiDropdownExtended> {
	return {
		...translateCommonFields(field),
		type: 'multidropdown',
		width: width,
		default: field.default,
		choices: field.choices,
		allowCustom: false, // Not supported from modules
		regex: undefined, // Not supported from modules
		minChoicesForSearch: field.minChoicesForSearch,
		minSelection: field.minSelection,
		maxSelection: field.maxSelection,
	}
}
function translateCustomVariableField(
	field: CompanionInputFieldCustomVariable,
	width: number
): Complete<CompanionInputFieldCustomVariableExtended> {
	return {
		...translateCommonFields(field),
		type: 'custom-variable',
		width: width,
		default: undefined, // type-check complains otherwise
	}
}

function translateCommonFields(
	field: CompanionInputFieldBase
): Pick<
	Complete<CompanionInputFieldBaseExtended>,
	'id' | 'label' | 'tooltip' | 'description' | 'expressionDescription' | 'isVisibleUi' | 'disableAutoExpression'
> {
	return {
		id: field.id,
		label: field.label,
		tooltip: field.tooltip,
		description: field.description,
		expressionDescription: field.expressionDescription,
		isVisibleUi: field.isVisibleExpression
			? {
					type: 'expression',
					fn: field.isVisibleExpression,
					data: undefined,
				}
			: undefined,
		disableAutoExpression: field.disableAutoExpression ?? false,
	}
}

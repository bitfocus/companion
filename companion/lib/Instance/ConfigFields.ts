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
	IsVisibleUiFn,
	SomeCompanionInputField,
} from '@companion-app/shared/Model/Options.js'
import { assertNever } from '@companion-app/shared/Util.js'
import {
	CompanionFieldVariablesSupport,
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
} from '@companion-module/base'
import type { EncodeIsVisible, SomeEncodedCompanionConfigField } from '@companion-module/base/dist/host-api/api.js'
import { Complete } from '@companion-module/base/dist/util.js'

export function translateConnectionConfigFields(fields: SomeEncodedCompanionConfigField[]): SomeCompanionInputField[] {
	return fields.map((raw) => {
		// Cast to remove the EncodeIsVisible mangling
		const o = raw as SomeCompanionConfigField
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
	fields: EncodeIsVisible<SomeCompanionActionInputField | SomeCompanionFeedbackInputField>[],
	entityType: EntityModelType,
	usesInternalVariableParsing: boolean
): SomeCompanionInputField[] {
	return fields.map((raw) => {
		// Cast to remove the EncodeIsVisible mangling
		const o = raw as SomeCompanionActionInputField | SomeCompanionFeedbackInputField
		switch (o.type) {
			case 'static-text':
				return translateStaticTextField(o, 0)
			case 'textinput':
				return translateTextInputField(o, 0, usesInternalVariableParsing)
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

function generateUnsupportedField<T extends EncodeIsVisible<CompanionInputFieldBase>>(
	field: T,
	width: number
): Complete<CompanionInputFieldStaticTextExtended> {
	return {
		...translateCommonFields(field),
		type: 'static-text',
		width: width,
		value: `Unsupported field type ${field.type}`,
	}
}

function translateStaticTextField(
	field: EncodeIsVisible<CompanionInputFieldStaticText>,
	width: number
): Complete<CompanionInputFieldStaticTextExtended> {
	return {
		...translateCommonFields(field),
		type: 'static-text',
		value: field.value,
		width: width,
		description: field.description,
	}
}
function translateTextInputField(
	field: EncodeIsVisible<CompanionInputFieldTextInput>,
	width: number,
	usesInternalVariableParsing: boolean
): Complete<CompanionInputFieldTextInputExtended> {
	let useVariables: CompanionFieldVariablesSupport | undefined
	if (field.useVariables) {
		useVariables = {
			local: usesInternalVariableParsing || (typeof field.useVariables === 'object' && field.useVariables.local),
		}
	}

	return {
		...translateCommonFields(field),
		type: 'textinput',
		default: field.default,
		regex: field.regex,
		required: field.required,
		width: width,
		useVariables,
		multiline: field.multiline,
		placeholder: undefined, // Not supported from modules
		isExpression: false, // Not supported from modules
	}
}
function translateCheckboxField(
	field: EncodeIsVisible<CompanionInputFieldCheckbox>,
	width: number
): Complete<CompanionInputFieldCheckboxExtended> {
	return {
		...translateCommonFields(field),
		type: 'checkbox',
		default: field.default,
		width: width,
	}
}
function translateColorPickerField(
	field: EncodeIsVisible<CompanionInputFieldColor>,
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
	field: EncodeIsVisible<CompanionInputFieldNumber>,
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
	field: EncodeIsVisible<CompanionInputFieldDropdown>,
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
	field: EncodeIsVisible<CompanionInputFieldMultiDropdown>,
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
	field: EncodeIsVisible<CompanionInputFieldCustomVariable>,
	width: number
): Complete<CompanionInputFieldCustomVariableExtended> {
	return {
		...translateCommonFields(field),
		type: 'custom-variable',
		width: width,
	}
}

function translateCommonFields(
	field: EncodeIsVisible<CompanionInputFieldBase>
): Pick<Complete<CompanionInputFieldBaseExtended>, 'id' | 'label' | 'tooltip' | 'description' | 'isVisibleUi'> {
	return {
		id: field.id,
		label: field.label,
		tooltip: field.tooltip,
		description: field.description,
		isVisibleUi: translateIsVisibleFn(field),
	}
}

function translateIsVisibleFn<T extends EncodeIsVisible<CompanionInputFieldBase>>(field: T): IsVisibleUiFn | undefined {
	let isVisibleUi: SomeCompanionInputField['isVisibleUi'] | undefined = undefined
	if (field.isVisibleFn && field.isVisibleFnType === 'expression') {
		isVisibleUi = {
			type: 'expression',
			fn: field.isVisibleFn,
			data: undefined,
		}
	} else if (field.isVisibleFn) {
		// Either type: 'function' or undefined (backwards compat)
		isVisibleUi = {
			type: 'function',
			fn: field.isVisibleFn,
			data: field.isVisibleData,
		}
	}

	return isVisibleUi
}

import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import type {
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
					id: o.id,
					type: 'bonjour-device',
					label: o.label,
					tooltip: o.tooltip,
					isVisibleUi: translateIsVisibleFn(o),
					width: o.width,
				} satisfies Complete<CompanionInputFieldBonjourDeviceExtended>
			case 'secret-text':
				return {
					id: o.id,
					type: 'secret-text',
					label: o.label,
					tooltip: o.tooltip,
					isVisibleUi: translateIsVisibleFn(o),
					width: o.width,
					default: o.default,
					required: o.required,
				} satisfies Complete<CompanionInputFieldSecretExtended>

			case 'static-text':
				return translateStaticTextField(o, o.width)
			case 'textinput':
				return translateTextInputField(o, 0, false)
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
		type: 'static-text',
		id: field.id,
		label: field.label,
		isVisibleUi: translateIsVisibleFn(field),
		width: width,
		value: `Unsupported field type ${field.type}`,
		tooltip: undefined,
	}
}

function translateStaticTextField(
	field: EncodeIsVisible<CompanionInputFieldStaticText>,
	width: number
): Complete<CompanionInputFieldStaticTextExtended> {
	return {
		id: field.id,
		type: 'static-text',
		label: field.label,
		tooltip: field.tooltip,
		isVisibleUi: translateIsVisibleFn(field),
		value: field.value,
		width: width,
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
		id: field.id,
		type: 'textinput',
		label: field.label,
		tooltip: field.tooltip,
		isVisibleUi: translateIsVisibleFn(field),
		default: field.default,
		regex: field.regex,
		required: field.required,
		width: width,
		useVariables,
		placeholder: undefined, // Not supported from modules
		isExpression: false, // Not supported from modules
	}
}
function translateCheckboxField(
	field: EncodeIsVisible<CompanionInputFieldCheckbox>,
	width: number
): Complete<CompanionInputFieldCheckboxExtended> {
	return {
		id: field.id,
		type: 'checkbox',
		label: field.label,
		tooltip: field.tooltip,
		isVisibleUi: translateIsVisibleFn(field),
		default: field.default,
		width: width,
	}
}
function translateColorPickerField(
	field: EncodeIsVisible<CompanionInputFieldColor>,
	width: number
): Complete<CompanionInputFieldColorExtended> {
	return {
		id: field.id,
		type: 'colorpicker',
		label: field.label,
		tooltip: field.tooltip,
		isVisibleUi: translateIsVisibleFn(field),
		default: field.default,
		enableAlpha: field.enableAlpha,
		returnType: 'string',
		presetColors: field.presetColors,
		width: width,
	}
}
function translateNumberField(
	field: EncodeIsVisible<CompanionInputFieldNumber>,
	width: number
): Complete<CompanionInputFieldNumberExtended> {
	return {
		id: field.id,
		type: 'number',
		label: field.label,
		tooltip: field.tooltip,
		isVisibleUi: translateIsVisibleFn(field),
		default: field.default,
		min: field.min,
		max: field.max,
		step: field.step,
		width: width,
		required: field.required,
		range: field.range,
	}
}
function translateDropdownField(
	field: EncodeIsVisible<CompanionInputFieldDropdown>,
	width: number
): Complete<CompanionInputFieldDropdownExtended> {
	return {
		id: field.id,
		type: 'dropdown',
		label: field.label,
		tooltip: field.tooltip,
		isVisibleUi: translateIsVisibleFn(field),
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
		id: field.id,
		type: 'multidropdown',
		label: field.label,
		tooltip: field.tooltip,
		isVisibleUi: translateIsVisibleFn(field),
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
		id: field.id,
		type: 'custom-variable',
		label: field.label,
		tooltip: field.tooltip,
		isVisibleUi: translateIsVisibleFn(field),
		width: width,
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

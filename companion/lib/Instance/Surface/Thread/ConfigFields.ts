import type {
	CompanionInputFieldBaseExtended,
	CompanionInputFieldCheckboxExtended,
	CompanionInputFieldDropdownExtended,
	CompanionInputFieldNumberExtended,
	CompanionInputFieldStaticTextExtended,
} from '@companion-app/shared/Model/Options.js'
import { assertNever } from '@companion-app/shared/Util.js'
import type {
	SomeCompanionInputField as SurfaceInputField,
	CompanionInputFieldBase,
	CompanionInputFieldCheckbox,
	CompanionInputFieldDropdown,
	CompanionInputFieldNumber,
	CompanionInputFieldStaticText,
	CompanionInputFieldTextInput,
} from '@companion-surface/base'
import type { Complete } from '@companion-module/base'
import type {
	CompanionSurfaceConfigField,
	CompanionSurfaceInputFieldTextInput,
} from '@companion-app/shared/Model/Surfaces.js'

export function translateSurfaceConfigFields(fields: SurfaceInputField[]): CompanionSurfaceConfigField[] {
	return fields.map((o) => {
		switch (o.type) {
			case 'static-text':
				return translateStaticTextField(o)
			case 'textinput':
				return translateTextInputField(o)
			case 'checkbox':
				return translateCheckboxField(o)
			case 'number':
				return translateNumberField(o)
			case 'dropdown':
				return translateDropdownField(o)

			default:
				assertNever(o)
				return generateUnsupportedField(o)
		}
	})
}

function generateUnsupportedField<T extends CompanionInputFieldBase>(
	field: T
): Complete<CompanionInputFieldStaticTextExtended> {
	return {
		...translateCommonFields(field),
		type: 'static-text',
		value: `Unsupported field type ${field.type}`,
		default: undefined,
	}
}

function translateStaticTextField(
	field: CompanionInputFieldStaticText
): Complete<CompanionInputFieldStaticTextExtended> {
	return {
		...translateCommonFields(field),
		type: 'static-text',
		value: field.value,
		description: field.description,
		default: undefined,
	}
}
function translateTextInputField(field: CompanionInputFieldTextInput): Complete<CompanionSurfaceInputFieldTextInput> {
	return {
		...translateCommonFields(field),
		type: 'textinput',
		default: field.default,
		regex: field.regex,
		required: undefined,
		multiline: false,
		placeholder: undefined, // Not supported from modules
		isExpression: false, // Not supported from modules
	}
}
function translateCheckboxField(field: CompanionInputFieldCheckbox): Complete<CompanionInputFieldCheckboxExtended> {
	return {
		...translateCommonFields(field),
		type: 'checkbox',
		default: field.default,
	}
}
function translateNumberField(field: CompanionInputFieldNumber): Complete<CompanionInputFieldNumberExtended> {
	return {
		...translateCommonFields(field),
		type: 'number',
		default: field.default,
		min: field.min,
		max: field.max,
		step: field.step,
		required: undefined,
		range: undefined,
		showMinAsNegativeInfinity: undefined,
		showMaxAsPositiveInfinity: undefined,
	}
}
function translateDropdownField(field: CompanionInputFieldDropdown): Complete<CompanionInputFieldDropdownExtended> {
	return {
		...translateCommonFields(field),
		type: 'dropdown',
		default: field.default,
		choices: field.choices,
		allowCustom: undefined,
		regex: undefined,
		minChoicesForSearch: undefined,
	}
}

function translateCommonFields(
	field: CompanionInputFieldBase
): Pick<
	Complete<CompanionInputFieldBaseExtended>,
	| 'id'
	| 'label'
	| 'tooltip'
	| 'description'
	| 'expressionDescription'
	| 'isVisibleUi'
	| 'width'
	| 'disableAutoExpression'
> {
	return {
		id: field.id,
		label: field.label,
		tooltip: field.tooltip,
		description: field.description,
		isVisibleUi: field.isVisibleExpression
			? {
					type: 'expression',
					fn: field.isVisibleExpression,
					data: undefined,
				}
			: undefined,
		// Note valid for surface configs:
		expressionDescription: undefined,
		width: undefined,
		disableAutoExpression: true,
	}
}

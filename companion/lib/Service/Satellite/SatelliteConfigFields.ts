import { BANNED_PROPS } from '@companion-app/shared/Expression/ExpressionResolve.js'
import type {
	CompanionInputFieldBaseExtended,
	CompanionInputFieldCheckboxExtended,
	CompanionInputFieldDropdownExtended,
	CompanionInputFieldNumberExtended,
	CompanionInputFieldStaticTextExtended,
} from '@companion-app/shared/Model/Options.js'
import type {
	CompanionSurfaceConfigField,
	CompanionSurfaceInputFieldTextInput,
} from '@companion-app/shared/Model/Surfaces.js'
import { assertNever } from '@companion-app/shared/Util.js'
import type { Complete } from '@companion-module/base'
import type {
	CheckboxField,
	CommonFields,
	ConfigField,
	DropdownField,
	NumberField,
	StaticTextField,
	TextInputField,
} from './SatelliteConfigFieldsSchema.js'

export function translateSatelliteConfigFields(fields: ConfigField[]): CompanionSurfaceConfigField[] {
	return fields
		.filter((f) => !BANNED_PROPS.has(f.id))
		.map((f) => {
			switch (f.type) {
				case 'static-text':
					return translateStaticTextField(f)
				case 'textinput':
					return translateTextInputField(f)
				case 'checkbox':
					return translateCheckboxField(f)
				case 'number':
					return translateNumberField(f)
				case 'dropdown':
					return translateDropdownField(f)
				default:
					assertNever(f)
					return generateUnsupportedField(f)
			}
		})
}

function generateUnsupportedField(field: CommonFields): Complete<CompanionInputFieldStaticTextExtended> {
	return {
		...translateCommonFields(field),
		type: 'static-text',
		value: `Unsupported field type`,
		default: undefined,
	}
}

function translateStaticTextField(field: StaticTextField): Complete<CompanionInputFieldStaticTextExtended> {
	return {
		...translateCommonFields(field),
		type: 'static-text',
		value: field.value,
		description: undefined,
		default: undefined,
	}
}

function translateTextInputField(field: TextInputField): Complete<CompanionSurfaceInputFieldTextInput> {
	return {
		...translateCommonFields(field),
		type: 'textinput',
		default: field.default,
		regex: field.regex,
		minLength: undefined,
		multiline: field.multiline ?? false,
		placeholder: undefined,
		disableSanitisation: false,
	}
}

function translateCheckboxField(field: CheckboxField): Complete<CompanionInputFieldCheckboxExtended> {
	return {
		...translateCommonFields(field),
		type: 'checkbox',
		default: field.default ?? false,
		displayToggle: false,
	}
}

function translateNumberField(field: NumberField): Complete<CompanionInputFieldNumberExtended> {
	return {
		...translateCommonFields(field),
		type: 'number',
		default: field.default ?? field.min,
		min: field.min,
		max: field.max,
		step: field.step,
		range: undefined,
		showMinAsNegativeInfinity: undefined,
		showMaxAsPositiveInfinity: undefined,
		clampValues: false,
		asInteger: false,
	}
}

function translateDropdownField(field: DropdownField): Complete<CompanionInputFieldDropdownExtended> {
	return {
		...translateCommonFields(field),
		type: 'dropdown',
		default: field.default ?? field.choices[0].id,
		choices: field.choices,
		allowCustom: field.allowCustom,
		regex: undefined,
		minChoicesForSearch: undefined,
	}
}

function translateCommonFields(
	field: CommonFields
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
	| 'allowInvalidValues'
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
		expressionDescription: undefined,
		width: undefined,
		disableAutoExpression: true,
		allowInvalidValues: false,
	}
}

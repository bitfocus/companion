import type { JsonValue } from 'type-fest'
import {
	validateCheckboxValue,
	validateColorValue,
	validateDropdownValue,
	validateMultiDropdownValue,
	validateNumberValue,
	validateTextValue,
	type ColorValidationOptions,
	type DropdownValidationOptions,
	type MultiDropdownValidationOptions,
	type NumberValidationOptions,
	type TextValidationOptions,
	type ValueValidationResult,
} from '@companion-module/host/validate'
import { ParseExpression } from './Expressions.js'
import { isExpressionOrValue, type SomeCompanionInputField } from './Model/Options.js'
import { stringifyVariableValue } from './Model/Variables.js'
import { assertNever } from './Util.js'

export interface ValidateInputValueOptions {
	/** If true, skip validating expression fields */
	skipValidateExpression?: boolean
}

/**
 * Require every property of `T` to be present. Optional properties become required (with `undefined`
 * still an allowed value), so when an upstream options interface gains a new field, the call site
 * that builds it fails to compile until the new option is threaded through.
 */
type Completed<T> = { [K in keyof Required<T>]: T[K] }

/** Adapt a primitive validator result into a {@link ValidateInputValueResult}. */
function adaptResult(result: ValueValidationResult): ValidateInputValueResult {
	return {
		sanitisedValue: result.sanitisedValue,
		validationError: result.validationError,
		validationWarnings: result.validationWarnings,
		validity: result.validity,
	}
}

/**
 * Check if a value is valid for a given input field definition, returning true/false
 * @param definition The input field definition
 * @param value The value to validate
 * @param options Optional validation options
 * @returns True if the value is valid for the given input field definition, false otherwise
 */
export function checkInputValueIsGood(
	definition: SomeCompanionInputField,
	value: JsonValue | undefined,
	options?: ValidateInputValueOptions
): boolean {
	const result = validateInputValue(definition, value, options)
	return result.validationError === undefined && result.validationWarnings.length === 0
}

export interface ValidateInputValueResult {
	sanitisedValue: JsonValue | undefined
	validationError: string | undefined
	validationWarnings: string[]
	/**
	 * Tri-state validity for the UI indicator: `true` (valid), `false` (invalid), or `undefined` when
	 * there is no rule to check the value against (e.g. a text field with no regex/minLength), or for
	 * field types that don't show an indicator. Set by the relevant `switch` case below.
	 */
	validity?: boolean | undefined
}

/**
 * Validate a value for a given input field definition.
 * @param definition The input field definition
 * @param value The value to validate
 * @param options Optional validation options
 * @returns The sanitised value, an optional error message, any warnings, and the tri-state `validity`.
 */
export function validateInputValue(
	definition: SomeCompanionInputField,
	value: JsonValue | undefined,
	options?: ValidateInputValueOptions
): ValidateInputValueResult {
	const validationWarnings: string[] = []

	// Build a result, deriving the display `validity` in one place: invalid when validation failed,
	// valid when it passed, and unknown (undefined) when there was nothing to check. Each case passes
	// `hasValidation` to say whether it actually validated anything.
	const makeResult = (
		sanitisedValue: JsonValue | undefined,
		validationError: string | undefined,
		hasValidation = true
	): ValidateInputValueResult => ({
		sanitisedValue,
		validationError,
		validationWarnings,
		validity: validationError !== undefined ? false : hasValidation ? true : undefined,
	})

	switch (definition.type) {
		case 'static-text':
			// Not editable - nothing to validate
			return makeResult(undefined, undefined, false)

		case 'textinput':
		case 'secret-text': {
			// textinput can opt out of all sanitisation, and therefore all validation
			if (definition.type === 'textinput' && definition.disableSanitisation) return makeResult(value, undefined, false)

			return adaptResult(
				validateTextValue(value, {
					minLength: definition.minLength,
					regex: definition.regex,
				} satisfies Completed<TextValidationOptions>)
			)
		}

		case 'expression': {
			// Skip validating the expression as it has already been parsed - nothing to check
			if (options?.skipValidateExpression) return makeResult(value, undefined, false)

			const sanitisedValue = stringifyVariableValue(value ?? '') ?? ''

			try {
				ParseExpression(sanitisedValue)
			} catch (_e) {
				return makeResult(sanitisedValue, 'Expression is not valid')
			}

			// An expression could be wanting any return type, so we can't continue with further checks.
			return makeResult(sanitisedValue, undefined)
		}

		case 'number':
			return adaptResult(
				validateNumberValue(value, {
					min: definition.min,
					max: definition.max,
					asInteger: definition.asInteger,
					clampValues: definition.clampValues,
					allowInvalidValues: definition.allowInvalidValues,
				} satisfies Completed<NumberValidationOptions>)
			)

		case 'checkbox':
			// Coerce to boolean - always acceptable, nothing to check
			return adaptResult(validateCheckboxValue(value))

		case 'colorpicker':
			// A color field accepts any color representation - a number, a numeric string, or a css color string -
			// and normalises it to the type the field declares (so the value handed onward always matches returnType
			// and is consumable by a module's splitRgb()). Companion stores colours as companion-ttrrggbb numbers, so
			// the input encoding is always the default.
			return adaptResult(
				validateColorValue(value, {
					returnType: definition.returnType,
					encoding: undefined,
					enableAlpha: definition.enableAlpha,
				} satisfies Completed<ColorValidationOptions>)
			)

		case 'bonjour-device':
		case 'custom-variable':
			// Nothing to check
			return makeResult(value, undefined, false)

		case 'dropdown':
			return adaptResult(
				validateDropdownValue(value, {
					choices: definition.choices,
					allowCustom: definition.allowCustom,
					regex: definition.regex,
				} satisfies Completed<DropdownValidationOptions>)
			)

		case 'multidropdown':
			return adaptResult(
				validateMultiDropdownValue(value, {
					choices: definition.choices,
					allowCustom: definition.allowCustom,
					regex: definition.regex,
					minSelection: definition.minSelection,
					maxSelection: definition.maxSelection,
				} satisfies Completed<MultiDropdownValidationOptions>)
			)

		case 'internal:table': {
			if (!Array.isArray(value)) {
				return makeResult(value, 'Value must be an array')
			}

			const sanitisedRows: JsonValue[] = []
			for (let rowIndex = 0; rowIndex < value.length; rowIndex++) {
				const row = value[rowIndex]
				if (typeof row !== 'object' || row === null || Array.isArray(row)) {
					return makeResult(value, `Row ${rowIndex} must be an object`)
				}

				const sanitisedRow: Record<string, JsonValue> = {}
				for (const col of definition.columns) {
					const cellValue = (row as Record<string, JsonValue>)[col.id]
					const result = validateInputValue(col, cellValue, options)
					if (result.validationError) {
						return makeResult(value, `Row ${rowIndex}, column "${col.label}": ${result.validationError}`)
					}
					validationWarnings.push(
						...result.validationWarnings.map((w) => `Row ${rowIndex}, column "${col.label}": ${w}`)
					)
					sanitisedRow[col.id] = result.sanitisedValue as JsonValue
				}
				sanitisedRows.push(sanitisedRow)
			}

			return makeResult(sanitisedRows, undefined)
		}

		case 'internal:list': {
			if (!Array.isArray(value)) {
				return makeResult(value, 'Value must be an array')
			}

			const sanitisedRows: JsonValue[] = []
			for (let rowIndex = 0; rowIndex < value.length; rowIndex++) {
				const row = value[rowIndex]
				if (typeof row !== 'object' || row === null || Array.isArray(row)) {
					return makeResult(value, `Row ${rowIndex} must be an object`)
				}

				const sanitisedRow: Record<string, JsonValue> = {}
				for (const field of definition.fields) {
					const cellRaw = (row as Record<string, JsonValue>)[field.id]
					// Auto-wrap bare JsonValue for saved data predating expression support
					const cell = isExpressionOrValue(cellRaw) ? cellRaw : { isExpression: false, value: cellRaw }

					if (cell.isExpression) {
						if (typeof cell.value !== 'string') {
							return makeResult(value, `Row ${rowIndex}, field "${field.label}": Expression must be a string`)
						}
						sanitisedRow[field.id] = cell
					} else {
						const result = validateInputValue(field, cell.value, options)
						if (result.validationError) {
							return makeResult(value, `Row ${rowIndex}, field "${field.label}": ${result.validationError}`)
						}
						validationWarnings.push(
							...result.validationWarnings.map((w) => `Row ${rowIndex}, field "${field.label}": ${w}`)
						)
						sanitisedRow[field.id] = { isExpression: false, value: result.sanitisedValue } as unknown as JsonValue
					}
				}
				sanitisedRows.push(sanitisedRow)
			}

			return makeResult(sanitisedRows, undefined)
		}

		case 'internal:connection_id':
		case 'internal:connection_collection':
		case 'internal:custom_variable':
		case 'internal:variable_value':
		case 'internal:date':
		case 'internal:page':
		case 'internal:surface_serial':
		case 'internal:outbound_surface_id':
		case 'internal:time':
		case 'internal:variable':
		case 'internal:trigger':
		case 'internal:trigger_collection':
		case 'internal:horizontal-alignment':
		case 'internal:vertical-alignment':
		case 'internal:text-styles':
		case 'internal:image-file':
			// Not supported - nothing to validate
			return makeResult(value, undefined, false)

		default:
			assertNever(definition)
			return makeResult(value, 'Unknown input field type')
	}
}

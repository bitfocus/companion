import { colord } from 'colord'
import isEqual from 'fast-deep-equal'
import type { JsonValue } from 'type-fest'
import { ParseExpression } from './Expressions.js'
import { colorToNumber, parseColor } from './Graphics/Util.js'
import { isExpressionOrValue, type SomeCompanionInputField } from './Model/Options.js'
import { stringifyVariableValue } from './Model/Variables.js'
import { assertNever } from './Util.js'

export interface ValidateInputValueOptions {
	/** If true, skip validating expression fields */
	skipValidateExpression?: boolean
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

			const sanitisedValue = stringifyVariableValue(value ?? '') ?? ''

			const compiledRegex = compileRegex(definition.regex)
			// hasValidation: whether a rule is actually configured (drives unknown vs valid when it passes)
			const hasValidation = definition.minLength !== undefined || compiledRegex !== null

			if (definition.minLength !== undefined && sanitisedValue.length < definition.minLength) {
				return makeResult(sanitisedValue, `Value must be at least ${definition.minLength} characters long`)
			}
			if (compiledRegex && !compiledRegex.exec(sanitisedValue)) {
				return makeResult(sanitisedValue, `Value does not match regex: ${definition.regex}`)
			}

			return makeResult(sanitisedValue, undefined, hasValidation)
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

		case 'number': {
			if (value === undefined || value === '' || value === null) {
				return makeResult(value, 'A value must be provided')
			}

			// Coerce to number
			let sanitisedValue = typeof value === 'number' ? value : Number(value)
			if (isNaN(sanitisedValue)) {
				return makeResult(value, 'Value must be a number')
			}

			// Round to integer if required
			const isNotInteger = definition.asInteger && !Number.isInteger(sanitisedValue)
			if (isNotInteger) {
				validationWarnings.push('Value was rounded to nearest integer')
				sanitisedValue = Math.round(sanitisedValue)
			}

			// Verify the value range - allowInvalidValues takes priority over clampValues
			if (definition.min !== undefined && sanitisedValue < definition.min) {
				if (definition.allowInvalidValues) {
					validationWarnings.push(`Value is below ${definition.min}`)
				} else if (definition.clampValues) {
					sanitisedValue = definition.min
					validationWarnings.push(`Value was clamped to ${definition.min}`)
				} else {
					return makeResult(sanitisedValue, `Value must be greater than or equal to ${definition.min}`)
				}
			}
			if (definition.max !== undefined && sanitisedValue > definition.max) {
				if (definition.allowInvalidValues) {
					validationWarnings.push(`Value is above ${definition.max}`)
				} else if (definition.clampValues) {
					sanitisedValue = definition.max
					validationWarnings.push(`Value was clamped to ${definition.max}`)
				} else {
					return makeResult(sanitisedValue, `Value must be less than or equal to ${definition.max}`)
				}
			}

			return makeResult(sanitisedValue, undefined)
		}

		case 'checkbox':
			// Coerce to boolean - always acceptable, nothing to check
			return makeResult(!!value, undefined, false)

		case 'colorpicker': {
			// A colour field accepts any colour representation - a number, a numeric string, or a css colour string -
			// and normalises it to the type the field declares (so the value handed onward always matches returnType
			// and is consumable by a module's splitRgb()).
			const isColour =
				typeof value === 'number' ||
				(typeof value === 'string' && ((value.trim() !== '' && !isNaN(Number(value))) || colord(value).isValid()))
			if (!isColour) {
				return makeResult(value, 'Value must be a colour number or a css colour string')
			}

			// isColour guarantees value is a number or string here
			const colourValue = value as number | string
			return definition.returnType === 'string'
				? makeResult(parseColor(colourValue), undefined)
				: makeResult(colorToNumber(colourValue), undefined)
		}

		case 'bonjour-device':
		case 'custom-variable':
			// Nothing to check
			return makeResult(value, undefined, false)

		case 'dropdown': {
			// Check if value is in choices
			const isInChoices = definition.choices.find((c) => isEqual(c.id, value) || c.id == value) // intentionally loose for backwards compatibility
			if (isInChoices) return makeResult(isInChoices.id, undefined)

			const stringValue = stringifyVariableValue(value) ?? ''

			if (!definition.allowCustom) {
				return makeResult(stringValue, 'Value is not in the list of choices')
			}

			// If allowCustom is true, and the value is not in the choices, check the regex
			const strValue = stringifyVariableValue(value) ?? ''
			const compiledRegex = compileRegex(definition.regex)
			if (compiledRegex && !compiledRegex.exec(strValue)) {
				return makeResult(stringValue, `Value does not match regex: ${definition.regex}`)
			}

			return makeResult(stringValue, undefined)
		}

		case 'multidropdown': {
			if (value === undefined) return makeResult([], undefined)

			if (!Array.isArray(value)) {
				// Try to help modules which relied on old behaviour where non-array values were coerced into an array, by coercing strings/numbers/booleans into an array with a warning
				if (
					(typeof value === 'string' && value.trim() !== '') ||
					typeof value === 'number' ||
					typeof value === 'boolean'
				) {
					validationWarnings.push('Value was coerced into an array')
					value = [value]
				} else {
					return makeResult(value, 'Value must be an array')
				}
			}

			const sanitisedValue: JsonValue[] = []
			const invalidValues: JsonValue[] = []

			// Validate each value
			for (const val of value) {
				// Check if value is in choices
				const isInChoices = definition.choices.find((c) => isEqual(c.id, val) || c.id == val) // intentionally loose for backwards compatibility
				if (isInChoices) {
					sanitisedValue.push(isInChoices.id)
					continue
				}

				if (!definition.allowCustom) {
					invalidValues.push(val)
					continue
				}

				// If allowCustom is true, and the value is not in the choices, check the regex
				const strVal = stringifyVariableValue(val) ?? ''
				const compiledRegex = compileRegex(definition.regex)
				if (compiledRegex && !compiledRegex.exec(strVal)) {
					invalidValues.push(val)
					continue
				}

				sanitisedValue.push(strVal)
			}

			if (invalidValues.length > 0) {
				return makeResult(
					value,
					`The following selected values are not valid: ${invalidValues.map(stringifyVariableValue).join(', ')}`
				)
			}

			// Check min/max selection
			if (definition.minSelection !== undefined && value.length < definition.minSelection) {
				return makeResult(sanitisedValue, `Must select at least ${definition.minSelection} items`)
			}
			if (definition.maxSelection !== undefined && value.length > definition.maxSelection) {
				return makeResult(sanitisedValue, `Must select at most ${definition.maxSelection} items`)
			}

			return makeResult(sanitisedValue, undefined)
		}

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
		case 'internal:image-file':
			// Not supported - nothing to validate
			return makeResult(value, undefined, false)

		default:
			assertNever(definition)
			return makeResult(value, 'Unknown input field type')
	}
}

export function compileRegex(regex: string | undefined): RegExp | null {
	if (!regex) return null

	try {
		// Compile the regex string
		const match = /^\/(.*)\/(.*)$/.exec(regex)
		if (match) {
			return new RegExp(match[1], match[2])
		} else {
			return null
		}
	} catch {
		return null
	}
}

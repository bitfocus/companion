import isEqual from 'fast-deep-equal'
import type { JsonValue } from 'type-fest'
import { ParseExpression } from './Expression/ExpressionParse.js'
import type { SomeCompanionInputField } from './Model/Options.js'
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

/**
 * Check if a value is valid for a given input field definition
 * @param definition The input field definition
 * @param value The value to validate
 * @param options Optional validation options
 * @returns An object with the sanitised value, an optional error message, and an array of warnings
 */
export function validateInputValue(
	definition: SomeCompanionInputField,
	value: JsonValue | undefined,
	options?: ValidateInputValueOptions
): {
	sanitisedValue: JsonValue | undefined
	validationError: string | undefined
	validationWarnings: string[]
} {
	const validationWarnings: string[] = []

	switch (definition.type) {
		case 'static-text':
			// Not editable
			return { sanitisedValue: undefined, validationError: undefined, validationWarnings }

		case 'textinput': {
			if (definition.disableSanitisation)
				return { sanitisedValue: value, validationError: undefined, validationWarnings }

			const sanitisedValue = stringifyVariableValue(value ?? '') ?? ''

			if (definition.minLength !== undefined && sanitisedValue.length < definition.minLength) {
				return {
					sanitisedValue,
					validationError: `Value must be at least ${definition.minLength} characters long`,
					validationWarnings,
				}
			}

			const compiledRegex = compileRegex(definition.regex)
			if (compiledRegex) {
				if (!compiledRegex.exec(sanitisedValue)) {
					return {
						sanitisedValue,
						validationError: `Value does not match regex: ${definition.regex}`,
						validationWarnings,
					}
				}
			}

			return { sanitisedValue, validationError: undefined, validationWarnings }
		}

		case 'expression': {
			// Skip validating the expression as it has already been parsed
			if (options?.skipValidateExpression)
				return { sanitisedValue: value, validationError: undefined, validationWarnings }

			const sanitisedValue = stringifyVariableValue(value ?? '') ?? ''

			try {
				ParseExpression(sanitisedValue)
			} catch (_e) {
				return { sanitisedValue, validationError: 'Expression is not valid', validationWarnings }
			}

			// An expression could be wanting any return type, so we can't continue with further checks.
			return { sanitisedValue, validationError: undefined, validationWarnings }
		}

		case 'secret-text': {
			const sanitisedValue = stringifyVariableValue(value ?? '') ?? ''

			if (definition.minLength !== undefined && sanitisedValue.length < definition.minLength) {
				return {
					sanitisedValue,
					validationError: `Value must be at least ${definition.minLength} characters long`,
					validationWarnings,
				}
			}

			const compiledRegex = compileRegex(definition.regex)
			if (compiledRegex) {
				if (!compiledRegex.exec(sanitisedValue)) {
					return {
						sanitisedValue,
						validationError: `Value does not match regex: ${definition.regex}`,
						validationWarnings,
					}
				}
			}

			return { sanitisedValue, validationError: undefined, validationWarnings }
		}

		case 'number': {
			if (value === undefined || value === '' || value === null) {
				return { sanitisedValue: value, validationError: 'A value must be provided', validationWarnings }
			}

			// Coerce to number
			let sanitisedValue = typeof value === 'number' ? value : Number(value)
			if (isNaN(sanitisedValue)) {
				return { sanitisedValue: value, validationError: 'Value must be a number', validationWarnings }
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
					return {
						sanitisedValue,
						validationError: `Value must be greater than or equal to ${definition.min}`,
						validationWarnings,
					}
				}
			}
			if (definition.max !== undefined && sanitisedValue > definition.max) {
				if (definition.allowInvalidValues) {
					validationWarnings.push(`Value is above ${definition.max}`)
				} else if (definition.clampValues) {
					sanitisedValue = definition.max
					validationWarnings.push(`Value was clamped to ${definition.max}`)
				} else {
					return {
						sanitisedValue,
						validationError: `Value must be less than or equal to ${definition.max}`,
						validationWarnings,
					}
				}
			}

			return { sanitisedValue, validationError: undefined, validationWarnings }
		}

		case 'checkbox': {
			// Coerce to boolean
			const sanitisedValue = !!value

			return { sanitisedValue, validationError: undefined, validationWarnings }
		}

		case 'colorpicker': {
			const sanitisedValue = value

			// Validate based on returnType
			if (definition.returnType === 'number') {
				const numValue = typeof value === 'number' ? value : Number(value)
				if (isNaN(numValue)) {
					return { sanitisedValue, validationError: 'Value must be a number', validationWarnings }
				}
			} else {
				if (typeof value !== 'string' && typeof value !== 'number') {
					return { sanitisedValue, validationError: 'Value must be a string or number', validationWarnings }
				}
			}
			return { sanitisedValue, validationError: undefined, validationWarnings }
		}

		case 'bonjour-device':
		case 'custom-variable':
			// Nothing to check
			return { sanitisedValue: value, validationError: undefined, validationWarnings }

		case 'dropdown': {
			// Check if value is in choices
			const isInChoices = definition.choices.find((c) => isEqual(c.id, value) || c.id == value) // intentionally loose for backwards compatibility
			if (isInChoices) return { sanitisedValue: isInChoices.id, validationError: undefined, validationWarnings }

			const stringValue = stringifyVariableValue(value) ?? ''

			if (!definition.allowCustom) {
				return {
					sanitisedValue: stringValue,
					validationError: 'Value is not in the list of choices',
					validationWarnings,
				}
			}

			// If allowCustom is true, and the value is not in the choices, check the regex
			const strValue = stringifyVariableValue(value) ?? ''
			const compiledRegex = compileRegex(definition.regex)
			if (compiledRegex && !compiledRegex.exec(strValue)) {
				return {
					sanitisedValue: stringValue,
					validationError: `Value does not match regex: ${definition.regex}`,
					validationWarnings,
				}
			}

			return { sanitisedValue: stringValue, validationError: undefined, validationWarnings }
		}

		case 'multidropdown': {
			if (value === undefined) return { sanitisedValue: [], validationError: undefined, validationWarnings }

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
					return { sanitisedValue: value, validationError: 'Value must be an array', validationWarnings }
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
				return {
					sanitisedValue: value,
					validationError: `The following selected values are not valid: ${invalidValues.map(stringifyVariableValue).join(', ')}`,
					validationWarnings,
				}
			}

			// Check min/max selection
			if (definition.minSelection !== undefined && value.length < definition.minSelection) {
				return {
					sanitisedValue,
					validationError: `Must select at least ${definition.minSelection} items`,
					validationWarnings,
				}
			}
			if (definition.maxSelection !== undefined && value.length > definition.maxSelection) {
				return {
					sanitisedValue,
					validationError: `Must select at most ${definition.maxSelection} items`,
					validationWarnings,
				}
			}

			return { sanitisedValue, validationError: undefined, validationWarnings }
		}

		case 'internal:connection_id':
		case 'internal:connection_collection':
		case 'internal:custom_variable':
		case 'internal:date':
		case 'internal:page':
		case 'internal:surface_serial':
		case 'internal:time':
		case 'internal:variable':
		case 'internal:trigger':
		case 'internal:trigger_collection':
		case 'internal:horizontal-alignment':
		case 'internal:vertical-alignment':
		case 'internal:png-image':
			// Not supported
			return { sanitisedValue: value, validationError: undefined, validationWarnings }

		default:
			assertNever(definition)
			return { sanitisedValue: value, validationError: 'Unknown input field type', validationWarnings }
	}
}

function compileRegex(regex: string | undefined): RegExp | null {
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

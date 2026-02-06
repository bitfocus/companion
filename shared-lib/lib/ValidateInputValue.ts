import type { JsonValue } from 'type-fest'
import type { SomeCompanionInputField } from './Model/Options.js'
import { ParseExpression } from './Expression/ExpressionParse.js'
import { assertNever } from './Util.js'
import { stringifyVariableValue } from './Model/Variables.js'
import isEqual from 'fast-deep-equal'

/**
 * Check if a value is valid for a given input field definition
 * @param definition The input field definition
 * @param value The value to validate
 * @param skipValidateExpression If true, skip validating expression fields
 * @returns An error message if invalid, or undefined if valid
 */
export function validateInputValue(
	definition: SomeCompanionInputField,
	value: JsonValue | undefined,
	skipValidateExpression: boolean = false
): {
	sanitisedValue: JsonValue | undefined
	validationError: string | undefined
} {
	switch (definition.type) {
		case 'static-text':
			// Not editable
			return { sanitisedValue: undefined, validationError: undefined }

		case 'textinput': {
			const sanitisedValue = stringifyVariableValue(value ?? '') ?? ''

			if (definition.minLength !== undefined && sanitisedValue.length < definition.minLength) {
				return { sanitisedValue, validationError: `Value must be at least ${definition.minLength} characters long` }
			}

			const compiledRegex = compileRegex(definition.regex)
			if (compiledRegex) {
				if (!compiledRegex.exec(sanitisedValue)) {
					return { sanitisedValue, validationError: `Value does not match regex: ${definition.regex}` }
				}
			}

			return { sanitisedValue, validationError: undefined }
		}

		case 'expression': {
			// Skip validating the expression as it has already been parsed
			if (skipValidateExpression) return { sanitisedValue: value, validationError: undefined }

			const sanitisedValue = stringifyVariableValue(value ?? '') ?? ''

			try {
				ParseExpression(sanitisedValue)
			} catch (_e) {
				return { sanitisedValue, validationError: 'Expression is not valid' }
			}

			// An expression could be wanting any return type, so we can't continue with further checks.
			return { sanitisedValue, validationError: undefined }
		}

		case 'secret-text': {
			const sanitisedValue = stringifyVariableValue(value ?? '') ?? ''

			if (definition.minLength !== undefined && sanitisedValue.length < definition.minLength) {
				return { sanitisedValue, validationError: `Value must be at least ${definition.minLength} characters long` }
			}

			const compiledRegex = compileRegex(definition.regex)
			if (compiledRegex) {
				if (!compiledRegex.exec(sanitisedValue)) {
					return { sanitisedValue, validationError: `Value does not match regex: ${definition.regex}` }
				}
			}

			return { sanitisedValue, validationError: undefined }
		}

		case 'number': {
			if (value === undefined || value === '' || value === null) {
				return { sanitisedValue: value, validationError: 'A value must be provided' }
			}

			// Coerce to number
			const sanitisedValue = typeof value === 'number' ? value : Number(value)
			if (isNaN(sanitisedValue)) {
				return { sanitisedValue: value, validationError: 'Value must be a number' }
			}

			// Verify the value range
			if (definition.min !== undefined && sanitisedValue < definition.min) {
				return { sanitisedValue, validationError: `Value must be greater than or equal to ${definition.min}` }
			}
			if (definition.max !== undefined && sanitisedValue > definition.max) {
				return { sanitisedValue, validationError: `Value must be less than or equal to ${definition.max}` }
			}

			return { sanitisedValue, validationError: undefined }
		}

		case 'checkbox': {
			// Coerce to boolean
			const sanitisedValue = !!value

			return { sanitisedValue, validationError: undefined }
		}

		case 'colorpicker': {
			const sanitisedValue = value

			// Validate based on returnType
			if (definition.returnType === 'number') {
				const numValue = typeof value === 'number' ? value : Number(value)
				if (isNaN(numValue)) {
					return { sanitisedValue, validationError: 'Value must be a number' }
				}
			} else {
				if (typeof value !== 'string' && typeof value !== 'number') {
					return { sanitisedValue, validationError: 'Value must be a string or number' }
				}
			}
			return { sanitisedValue, validationError: undefined }
		}

		case 'bonjour-device':
		case 'custom-variable':
			// Nothing to check
			return { sanitisedValue: value, validationError: undefined }

		case 'dropdown': {
			// Check if value is in choices
			const isInChoices = definition.choices.find((c) => isEqual(c.id, value) || c.id == value) // intentionally loose for backwards compatibility
			if (isInChoices) return { sanitisedValue: isInChoices.id, validationError: undefined }

			const stringValue = stringifyVariableValue(value) ?? ''

			if (!definition.allowCustom) {
				return { sanitisedValue: stringValue, validationError: 'Value is not in the list of choices' }
			}

			// If allowCustom is true, and the value is not in the choices, check the regex
			const strValue = stringifyVariableValue(value) ?? ''
			const compiledRegex = compileRegex(definition.regex)
			if (compiledRegex && !compiledRegex.exec(strValue)) {
				return { sanitisedValue: stringValue, validationError: `Value does not match regex: ${definition.regex}` }
			}

			return { sanitisedValue: stringValue, validationError: undefined }
		}

		case 'multidropdown': {
			if (value === undefined) return { sanitisedValue: [], validationError: undefined }

			if (!Array.isArray(value)) {
				return { sanitisedValue: value, validationError: 'Value must be an array' }
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
				}
			}

			// Check min/max selection
			if (definition.minSelection !== undefined && value.length < definition.minSelection) {
				return { sanitisedValue, validationError: `Must select at least ${definition.minSelection} items` }
			}
			if (definition.maxSelection !== undefined && value.length > definition.maxSelection) {
				return { sanitisedValue, validationError: `Must select at most ${definition.maxSelection} items` }
			}

			return { sanitisedValue, validationError: undefined }
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
			// Not supported
			return { sanitisedValue: value, validationError: undefined }

		default:
			assertNever(definition)
			return { sanitisedValue: value, validationError: 'Unknown input field type' }
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

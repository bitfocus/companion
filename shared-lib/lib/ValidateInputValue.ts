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
 * @returns An error message if invalid, or undefined if valid
 */
export function validateInputValue(
	definition: SomeCompanionInputField,
	value: JsonValue | undefined
): string | undefined {
	switch (definition.type) {
		case 'static-text':
			// Not editable
			return undefined

		case 'textinput': {
			if (definition.required && (value === undefined || value === null || value === '')) {
				return 'A value must be provided'
			}

			const valueStr = value === undefined || value === null ? '' : (stringifyVariableValue(value) ?? '')

			if (definition.isExpression) {
				try {
					ParseExpression(valueStr)
				} catch (_e) {
					return 'Expression is not valid'
				}
			}

			const compiledRegex = compileRegex(definition.regex)
			if (compiledRegex) {
				if (!compiledRegex.exec(valueStr)) {
					return `Value does not match regex: ${definition.regex}`
				}
			}

			return undefined
		}

		case 'secret-text': {
			if (definition.required && !value) {
				return 'A value must be provided'
			}

			const valueStr = value === undefined || value === null ? '' : (stringifyVariableValue(value) ?? '')

			const compiledRegex = compileRegex(definition.regex)
			if (compiledRegex) {
				if (!compiledRegex.exec(valueStr)) {
					return `Value does not match regex: ${definition.regex}`
				}
			}

			return undefined
		}

		case 'number': {
			if (definition.required && (value === undefined || value === '')) {
				return 'A value must be provided'
			}

			if (value === undefined || value === '' || value === null) {
				return undefined
			}

			// Coerce to number
			const numValue = typeof value === 'number' ? value : Number(value)
			if (isNaN(numValue)) {
				return 'Value must be a number'
			}

			// Verify the value range
			if (definition.min !== undefined && numValue < definition.min) {
				return `Value must be greater than or equal to ${definition.min}`
			}
			if (definition.max !== undefined && numValue > definition.max) {
				return `Value must be less than or equal to ${definition.max}`
			}

			return undefined
		}

		case 'checkbox':
			// Coerce to boolean
			if (value !== undefined && typeof value !== 'boolean') {
				return 'Value must be a boolean'
			}
			return undefined

		case 'colorpicker':
			if (value === undefined) return undefined

			// Validate based on returnType
			if (definition.returnType === 'number') {
				const numValue = typeof value === 'number' ? value : Number(value)
				if (isNaN(numValue)) {
					return 'Value must be a number'
				}
			} else {
				if (typeof value !== 'string' && typeof value !== 'number') {
					return 'Value must be a string or number'
				}
			}
			return undefined

		case 'bonjour-device':
		case 'custom-variable':
			// Nothing to check
			return undefined

		case 'dropdown': {
			// Check if value is in choices
			const isInChoices = definition.choices.some((c) => isEqual(c.id, value))
			if (isInChoices) return undefined

			if (!definition.allowCustom) {
				return 'Value is not in the list of choices'
			}

			// If allowCustom is true, and the value is not in the choices, check the regex
			const strValue = stringifyVariableValue(value) ?? ''
			const compiledRegex = compileRegex(definition.regex)
			if (compiledRegex && !compiledRegex.exec(strValue)) {
				return `Value does not match regex: ${definition.regex}`
			}

			return undefined
		}

		case 'multidropdown': {
			if (value === undefined) return undefined

			if (!Array.isArray(value)) {
				return 'Value must be an array'
			}

			// Check min/max selection
			if (definition.minSelection !== undefined && value.length < definition.minSelection) {
				return `Must select at least ${definition.minSelection} items`
			}
			if (definition.maxSelection !== undefined && value.length > definition.maxSelection) {
				return `Must select at most ${definition.maxSelection} items`
			}

			// Validate each value
			for (const val of value) {
				// Check if value is in choices
				const isInChoices = definition.choices.some((c) => isEqual(c.id, val))
				if (isInChoices) continue

				if (!definition.allowCustom) return 'Value is not in the list of choices'

				// If allowCustom is true, and the value is not in the choices, check the regex
				const strVal = stringifyVariableValue(val) ?? ''
				const compiledRegex = compileRegex(definition.regex)
				if (compiledRegex && !compiledRegex.exec(strVal)) {
					return `Value does not match regex: ${definition.regex}`
				}
			}

			return undefined
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
			return undefined

		default:
			assertNever(definition)
			return undefined
	}
}

function compileRegex(regex: string | undefined): RegExp | null {
	if (regex) {
		// Compile the regex string
		const match = /^\/(.*)\/(.*)$/.exec(regex)
		if (match) {
			return new RegExp(match[1], match[2])
		}
	}
	return null
}

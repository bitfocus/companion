import { ParseExpression } from '@companion-app/shared/Expression/ExpressionParse.js'
import type {
	ExtendedConfigField,
	ExtendedInputField,
	InternalInputField,
} from '@companion-app/shared/Model/Options.js'
import { assertNever } from '~/util.js'

export function validateInputValue(
	definition: ExtendedInputField | InternalInputField | ExtendedConfigField,
	value: any
): string | undefined {
	switch (definition.type) {
		case 'static-text':
			// Not editable
			return undefined

		case 'textinput': {
			if (definition.required && !value) {
				return 'A value must be provided'
			}

			if (definition.isExpression) {
				try {
					ParseExpression(value)
					return 'Expression is not valid'
				} catch (e) {}
			}

			const compiledRegex = compileRegex(definition.regex)
			if (compiledRegex) {
				if (typeof value !== 'string') {
					return 'Value must be a string'
				}

				if (!compiledRegex.exec(value)) {
					return `Value does not match regex: ${definition.regex}`
				}
			}

			return undefined
		}

		case 'secret-text': {
			if (definition.required && !value) {
				return 'A value must be provided'
			}

			return undefined
		}

		case 'number': {
			if (definition.required && (value === undefined || value === '')) {
				return 'A value must be provided'
			}

			if (value !== undefined && value !== '' && isNaN(value)) {
				return 'Value must be a number'
			}

			// Verify the value range
			if (definition.min !== undefined && value < definition.min) {
				return `Value must be greater than or equal to ${definition.min}`
			}
			if (definition.max !== undefined && value > definition.max) {
				return `Value must be less than or equal to ${definition.max}`
			}

			return undefined
		}

		case 'checkbox':
		case 'colorpicker':
		case 'bonjour-device':
		case 'custom-variable':
			// Nothing to check
			return undefined

		case 'dropdown': {
			if (definition.allowCustom && !definition.choices.find((c) => c.id === value)) {
				// If allowCustom is true, and the value is not in the choices, check the regex
				const compiledRegex = compileRegex(definition.regex)
				if (compiledRegex && !compiledRegex.exec(String(value))) {
					return `Value does not match regex: ${definition.regex}`
				}
			}

			return undefined
		}

		case 'multidropdown': {
			const newValueArr = Array.isArray(value) ? value : [value]

			if (definition.allowCustom) {
				// If allowCustom is true, and the value is not in the choices, check the regex
				const compiledRegex = compileRegex(definition.regex)
				for (const val of newValueArr) {
					if (compiledRegex && !definition.choices.find((c) => c.id === val) && !compiledRegex.exec(String(val))) {
						return `Value does not match regex: ${definition.regex}`
					}
				}
			}

			return undefined
		}

		case 'internal:connection_id':
		case 'internal:custom_variable':
		case 'internal:date':
		case 'internal:page':
		case 'internal:surface_serial':
		case 'internal:time':
		case 'internal:variable':
		case 'internal:trigger':
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

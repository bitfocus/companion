import type { JsonValue } from 'type-fest'
import type { LinkTransportConfigField } from './Model/Link.js'
import { validateInputValue } from './ValidateInputValue.js'

/** The default config of a transport type, built from the defaults of its fields */
export function getDefaultLinkTransportConfig(
	fields: readonly LinkTransportConfigField[]
): Record<string, JsonValue | undefined> {
	const config: Record<string, JsonValue | undefined> = {}
	for (const field of fields) {
		if ('default' in field && field.default !== undefined) config[field.id] = field.default
	}
	return config
}

/**
 * Validate a transport config against the fields of its type, dropping unknown keys and filling in defaults
 * for missing values.
 * @returns the sanitised config, and the validation error of each invalid field keyed by field id
 */
export function resolveLinkTransportConfig(
	fields: readonly LinkTransportConfigField[],
	rawConfig: Record<string, JsonValue | undefined>
): { config: Record<string, JsonValue | undefined>; errors: Record<string, string> } {
	const config: Record<string, JsonValue | undefined> = {}
	const errors: Record<string, string> = {}

	for (const field of fields) {
		if (field.type === 'static-text') continue

		const rawValue = rawConfig[field.id] === undefined ? field.default : rawConfig[field.id]
		const result = validateInputValue(field, rawValue)
		if (result.validationError !== undefined) errors[field.id] = result.validationError
		config[field.id] = result.sanitisedValue
	}

	return { config, errors }
}

/* eslint-disable @typescript-eslint/no-base-to-string */
import type { LaunchOption } from '@companion-app/shared/LaunchOptions.js'

/** The value written to a fresh config file for an option (its default, or null when unset). */
export function optionFileDefault(option: LaunchOption): string | number | boolean | null {
	return option.default ?? null
}

export interface CoerceResult {
	value: string | number | boolean | null
	error?: string
}

/**
 * Coerce a raw value (from the yaml file or a prompt) into the option's declared type.
 * On failure `value` is null and `error` describes the problem.
 */
export function coerceValue(option: LaunchOption, raw: unknown): CoerceResult {
	if (raw === null || raw === undefined || raw === '') return { value: null }

	// No option accepts a structured value; reject lists/objects rather than stringifying them
	// into nonsense like "[object Object]" that would silently become an invalid launch argument.
	if (typeof raw === 'object') return { value: null, error: `Expected a single value, not a list or object` }

	switch (option.type) {
		case 'boolean': {
			if (typeof raw === 'boolean') return { value: raw }
			const str = String(raw).toLowerCase().trim()
			if (['1', 'true', 'yes', 'on'].includes(str)) return { value: true }
			if (['0', 'false', 'no', 'off'].includes(str)) return { value: false }
			return { value: null, error: `Expected a boolean (true/false)` }
		}
		case 'number': {
			const num = Number(raw)
			if (!Number.isFinite(num)) return { value: null, error: `Expected a number` }
			return { value: num }
		}
		case 'enum': {
			const str = String(raw)
			if (option.enumValues && !option.enumValues.includes(str)) {
				return { value: null, error: `Expected one of: ${option.enumValues.join(', ')}` }
			}
			return { value: str }
		}
		case 'string':
		default:
			return { value: String(raw) }
	}
}

/**
 * Validate a coerced value against the option's optional validator.
 * Returns an error message, or undefined when valid.
 */
export function validateValue(option: LaunchOption, value: string | number | boolean | null): string | undefined {
	if (value === null) return undefined
	return option.validate?.(value)
}

/** The effective value used to launch: the file value when set, otherwise the option default. */
export function resolveValue(option: LaunchOption, fileValue: unknown): string | number | boolean | null {
	const coerced = coerceValue(option, fileValue)
	if (coerced.error) throw new Error(`Invalid value for "${option.key}": ${coerced.error}`)
	if (coerced.value !== null) return coerced.value
	return option.default ?? null
}

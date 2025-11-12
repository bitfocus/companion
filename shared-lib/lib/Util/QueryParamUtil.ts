/**
 * Converts a nested object to flat dot-notation query params
 * Example: { surfaces: { known: true } } → { 'surfaces.known': 'true' }
 *
 * @param obj The object to flatten
 * @param prefix Internal prefix for recursion
 * @returns Flattened object with dot-notation keys and string values
 */
export function flattenToQueryParams(obj: Record<string, any>, prefix = ''): Record<string, string> {
	const result: Record<string, string> = {}

	for (const [key, value] of Object.entries(obj)) {
		const fullKey = prefix ? `${prefix}.${key}` : key

		if (value === undefined) {
			// Skip undefined values
			continue
		} else if (value === null) {
			// Convert null to an empty string
			result[fullKey] = ''
		} else if (typeof value === 'object' && !Array.isArray(value)) {
			// Recursively flatten nested objects
			Object.assign(result, flattenToQueryParams(value, fullKey))
		} else {
			// Convert primitives to strings
			result[fullKey] = String(value)
		}
	}

	return result
}

/**
 * Converts flat dot-notation query params back to nested object
 * Example: { 'surfaces.known': 'true' } → { surfaces: { known: 'true' } }
 *
 * Note: Values remain as strings - Zod will handle type coercion
 *
 * @param params Query parameters object with dot-notation keys
 * @returns Nested object with restored structure
 */
export function unflattenQueryParams(params: Record<string, any>): Record<string, any> {
	const result: Record<string, any> = {}

	for (const [key, value] of Object.entries(params)) {
		if (value === undefined) continue

		const parts = key.split('.')
		let current = result

		// Navigate/create nested structure
		for (let i = 0; i < parts.length - 1; i++) {
			const part = parts[i]
			if (!(part in current) || typeof current[part] !== 'object') {
				current[part] = {}
			}
			current = current[part]
		}

		// Set the final value
		current[parts[parts.length - 1]] = value
	}

	return result
}

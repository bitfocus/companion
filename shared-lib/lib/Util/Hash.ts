/**
 * Creates a deterministic hash string from an object by sorting keys alphabetically.
 * This ensures that objects with the same key-value pairs but different property order
 * produce the same hash.
 *
 * @param obj - The object to hash
 * @returns A deterministic string representation of the object
 */
export function createStableObjectHash(obj: Record<string, any>): string {
	const sortedKeys = Object.keys(obj).sort()
	const sortedPairs = sortedKeys.map((key) => `${key}=${JSON.stringify(obj[key])}`)
	return sortedPairs.join('|')
}

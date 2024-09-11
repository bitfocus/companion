/**
 * Make a customvariable 'safe' according to the valid regex
 * @param name Custom variable to check
 * @returns 'safe' version of the customvariable
 */
export function makeCustomVariableSafe(name: string): string {
	return name.replace(/[^\w]/gi, '_')
}

/**
 * Check if a customvariable is valid
 * @param name Custom variable to check
 */
export function isCustomVariableValid(name: string): boolean {
	if (!name || typeof name !== 'string') return false

	const safeLabel = makeCustomVariableSafe(name)
	return safeLabel === name
}

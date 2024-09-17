/**
 * Make a label 'safe' according to the valid regex
 * @param label Label to check
 * @returns 'safe' version of the label
 */
export function makeLabelSafe(label: string): string {
	return label.replace(/[^\w-]/gi, '_')
}

/**
 * Check if a label is valid
 * @param label Label to check
 */
export function isLabelValid(label: string): boolean {
	if (!label || typeof label !== 'string') return false

	// Check a few reserved words
	if (
		label.toLowerCase() === 'internal' ||
		label.toLowerCase() === 'this' ||
		label.toLowerCase() === 'local' ||
		label.toLowerCase() === 'companion' ||
		label.toLowerCase() === 'custom'
	)
		return false

	const safeLabel = makeLabelSafe(label)
	return safeLabel === label
}

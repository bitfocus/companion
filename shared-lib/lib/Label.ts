/**
 * Make a label 'safe' according to the valid regex
 * @param label Label to check
 * @returns 'safe' version of the label
 */
export function makeLabelSafe(label: string): string {
	return label.trim().replace(/[^\w-]/gi, '_')
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
		label.toLowerCase() === 'image' ||
		label.toLowerCase() === 'custom' ||
		label.toLowerCase() === 'expression' ||
		label.toLowerCase() === 'page'
	)
		return false

	const safeLabel = makeLabelSafe(label)
	return safeLabel === label
}

export function isEmulatorIdValid(id: string): boolean {
	if (!id || typeof id !== 'string') return false

	const safeId = makeLabelSafe(id)
	return safeId === id
}

export function isSurfaceGroupIdValid(id: string): boolean {
	if (!id || typeof id !== 'string') return false

	const safeId = makeLabelSafe(id)
	return safeId === id
}

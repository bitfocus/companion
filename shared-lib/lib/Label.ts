/**
 * Make a label 'safe' according to the valid regex
 * @param label Label to check
 * @returns 'safe' version of the label
 */
export function makeLabelSafe(label: string): string {
	return label.trim().replace(/[^\w-]/gi, '_')
}

/** Reserved words, which can't be used as a label */
const RESERVED_LABELS: ReadonlySet<string> = new Set([
	'internal',
	'this',
	'local',
	'companion',
	'image',
	'custom',
	'expression',
	'page',
	'options',
])

/**
 * Check if a label is valid
 * @param label Label to check
 */
export function isLabelValid(label: string): boolean {
	if (!label || typeof label !== 'string') return false

	if (RESERVED_LABELS.has(label.toLowerCase())) return false

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

import { ParseControlId } from '@companion-app/shared/ControlId.js'

/**
 * Verify a controlId is valid for the current id scheme and grid size
 */
export function validateBankControlId(controlId: string): boolean {
	const parsed = ParseControlId(controlId)
	if (parsed?.type !== 'bank') return false

	return true
}

/**
 * Verify a controlId is valid for the current id scheme and grid size
 */
export function validateTriggerControlId(controlId: string): boolean {
	const parsed = ParseControlId(controlId)
	if (parsed?.type !== 'trigger') return false

	return true
}

import { ActionSetId } from './Model/ActionModel.js'
import type { ControlLocation } from './Model/Common.js'
import { assertNever } from './Util.js'

/**
 * Present a location as a string
 */
export function formatLocation(location: ControlLocation): string {
	return `${location.pageNumber ?? '?'}/${location.row ?? '?'}/${location.column ?? '?'}`
}

/**
 * Convert old bank index to xy
 */
export function oldBankIndexToXY(bank: number): [number, number] | null {
	bank = Number(bank)
	if (isNaN(bank) || bank <= 0 || bank > 32) return null
	bank -= 1

	const perRow = 8

	const x = bank % perRow
	const y = Math.floor(bank / perRow)
	return [x, y]
}
/**

/**
 * Combine xy values into old bank index
 */
export function xyToOldBankIndex(x: number, y: number): number | null {
	const perRow = 8
	if (x < 0 || y < 0 || x >= perRow || y >= 4) return null

	return y * perRow + x + 1
}

/**
 * Create full bank control id
 */
export function CreateBankControlId(id: string): string {
	return `bank:${id}`
}

/**
 * Create full trigger control id
 */
export function CreateTriggerControlId(triggerId: string): string {
	return `trigger:${triggerId}`
}

export interface ParsedControlIdBank {
	type: 'bank'
	control: string
}
export interface ParsedControlIdTrigger {
	type: 'trigger'
	trigger: string
}
export type ParsedControlIdType = ParsedControlIdBank | ParsedControlIdTrigger

/**
 * Parse a controlId
 */
export function ParseControlId(controlId: string): ParsedControlIdType | undefined {
	if (typeof controlId === 'string') {
		const match = controlId.match(/^bank:(.*)$/)
		if (match) {
			return {
				type: 'bank',
				control: match[1],
			}
		}

		const match2 = controlId.match(/^trigger:(.*)$/)
		if (match2) {
			return {
				type: 'trigger',
				trigger: match2[1],
			}
		}
	}

	return undefined
}

export function validateActionSetId(setId: ActionSetId): ActionSetId | undefined {
	if (typeof setId === 'string') {
		switch (setId) {
			case 'down':
			case 'up':
			case 'rotate_left':
			case 'rotate_right':
				return setId
			default:
				assertNever(setId)
				break
		}

		// In case its a number as a string
		const setNumber = Number(setId)
		if (!isNaN(setNumber)) return setNumber

		return undefined
	} else if (typeof setId === 'number') {
		return setId
	} else {
		return undefined
	}
}

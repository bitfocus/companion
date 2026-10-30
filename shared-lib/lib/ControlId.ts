import type { ActionSetId } from './Model/ActionModel.js'
import type { ControlLocation } from './Model/Common.js'
import type { UserConfigGridSize } from './Model/UserConfigModel.js'
import { assertNever } from './Util.js'

/**
 * Present a location as a string
 */
export function formatLocation(location: ControlLocation): string {
	return `${location.pageNumber ?? '?'}/${location.row ?? '?'}/${location.column ?? '?'}`
}

/**
 * Whether a location's row and column fall inside the grid bounds
 */
export function isLocationOnGrid(gridSize: UserConfigGridSize, location: ControlLocation): boolean {
	return (
		location.row >= gridSize.minRow &&
		location.row <= gridSize.maxRow &&
		location.column >= gridSize.minColumn &&
		location.column <= gridSize.maxColumn
	)
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

/**
 * Create full expression variable control id
 */
export function CreateExpressionVariableControlId(variableId: string): string {
	return `expression-variable:${variableId}`
}

/**
 * Create full custom action control id
 */
export function CreateCustomActionControlId(customActionId: string): string {
	return `custom-action:${customActionId}`
}

/**
 * Create full custom feedback control id
 */
export function CreateCustomFeedbackControlId(customFeedbackId: string): string {
	return `custom-feedback:${customFeedbackId}`
}

/**
 * Create the full control id for a page's local-variables control (one per page, keyed by page id).
 */
export function CreatePageControlId(pageId: string): string {
	return `page:${pageId}`
}

/**
 * Create preset control id
 */
export function CreatePresetControlId(connectionId: string, presetId: string, variablesHash: string): string {
	return `preset:${connectionId}:${presetId}:${variablesHash}`
}

export interface ParsedControlIdBank {
	type: 'bank'
	control: string
}
export interface ParsedControlIdTrigger {
	type: 'trigger'
	trigger: string
}
export interface ParsedControlIdExpressionVariable {
	type: 'expression-variable'
	variableId: string
}
export interface ParsedControlIdCustomAction {
	type: 'custom-action'
	customActionId: string
}
export interface ParsedControlIdCustomFeedback {
	type: 'custom-feedback'
	customFeedbackId: string
}
export interface ParsedControlIdPage {
	type: 'page'
	pageId: string
}
export interface ParsedControlIdPreset {
	type: 'preset'
	connectionId: string
	presetId: string
	variablesHash: string
}
export type ParsedControlIdType =
	| ParsedControlIdBank
	| ParsedControlIdTrigger
	| ParsedControlIdExpressionVariable
	| ParsedControlIdCustomAction
	| ParsedControlIdCustomFeedback
	| ParsedControlIdPage
	| ParsedControlIdPreset

export type ControlIdKind = ParsedControlIdType['type']

/** Every kind of control id. Typed as a record so that a new kind must be added here */
const CONTROL_ID_KINDS: Record<ControlIdKind, true> = {
	bank: true,
	trigger: true,
	'expression-variable': true,
	'custom-action': true,
	'custom-feedback': true,
	page: true,
	preset: true,
}

/**
 * All of the kinds of control id
 */
export const ALL_CONTROL_ID_KINDS = Object.keys(CONTROL_ID_KINDS) as [ControlIdKind, ...ControlIdKind[]]

/**
 * Parse a controlId
 */
export function ParseControlId(controlId: string): ParsedControlIdType | undefined {
	if (typeof controlId === 'string') {
		const matchBank = controlId.match(/^bank:(.*)$/)
		if (matchBank) {
			return {
				type: 'bank',
				control: matchBank[1],
			}
		}

		const matchTrigger = controlId.match(/^trigger:(.*)$/)
		if (matchTrigger) {
			return {
				type: 'trigger',
				trigger: matchTrigger[1],
			}
		}

		const matchCv = controlId.match(/^expression-variable:(.*)$/)
		if (matchCv) {
			return {
				type: 'expression-variable',
				variableId: matchCv[1],
			}
		}

		const matchCustomAction = controlId.match(/^custom-action:(.*)$/)
		if (matchCustomAction) {
			return {
				type: 'custom-action',
				customActionId: matchCustomAction[1],
			}
		}

		const matchCustomFeedback = controlId.match(/^custom-feedback:(.*)$/)
		if (matchCustomFeedback) {
			return {
				type: 'custom-feedback',
				customFeedbackId: matchCustomFeedback[1],
			}
		}

		const matchPage = controlId.match(/^page:(.*)$/)
		if (matchPage) {
			return {
				type: 'page',
				pageId: matchPage[1],
			}
		}

		const matchPreset = controlId.match(/^preset:(.*?):(.*):(.*)$/)
		if (matchPreset) {
			return {
				type: 'preset',
				connectionId: matchPreset[1],
				presetId: matchPreset[2],
				variablesHash: matchPreset[3],
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

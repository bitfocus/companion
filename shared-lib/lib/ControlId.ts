import z from 'zod'
import type { ActionSetId } from './Model/ActionModel.js'
import type { ControlLocation, ControlLocationString } from './Model/Common.js'
import type { UserConfigGridSize } from './Model/UserConfigModel.js'
import { assertNever } from './Util.js'

/**
 * Present a location as a string
 */
export function formatLocation(location: ControlLocation): ControlLocationString {
	// The only place a location string is made without being checked
	return `${location.pageNumber ?? '?'}/${location.row ?? '?'}/${location.column ?? '?'}` as ControlLocationString
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
export function CreateBankControlId(id: string): BankControlId {
	// The creators are the only place a control id is made without being checked
	return `bank:${id}` as BankControlId
}

/**
 * Create full trigger control id
 */
export function CreateTriggerControlId(triggerId: string): TriggerControlId {
	return `trigger:${triggerId}` as TriggerControlId
}

/**
 * Create full expression variable control id
 */
export function CreateExpressionVariableControlId(variableId: string): ExpressionVariableControlId {
	return `expression-variable:${variableId}` as ExpressionVariableControlId
}

/**
 * Create full custom action control id
 */
export function CreateCustomActionControlId(customActionId: string): CustomActionControlId {
	return `custom-action:${customActionId}` as CustomActionControlId
}

/**
 * Create full custom feedback control id
 */
export function CreateCustomFeedbackControlId(customFeedbackId: string): CustomFeedbackControlId {
	return `custom-feedback:${customFeedbackId}` as CustomFeedbackControlId
}

/**
 * Create full custom preset control id
 */
export function CreateCustomPresetControlId(customPresetId: string): CustomPresetControlId {
	return `custom-preset:${customPresetId}` as CustomPresetControlId
}

/**
 * Create the full control id for a page's local-variables control (one per page, keyed by page id).
 */
export function CreatePageControlId(pageId: string): PageControlId {
	return `page:${pageId}` as PageControlId
}

/**
 * Create preset control id
 */
export function CreatePresetControlId(connectionId: string, presetId: string, variablesHash: string): PresetControlId {
	return `preset:${connectionId}:${presetId}:${variablesHash}` as PresetControlId
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
export interface ParsedControlIdCustomPreset {
	type: 'custom-preset'
	customPresetId: string
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
	| ParsedControlIdCustomPreset
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
	'custom-preset': true,
	page: true,
	preset: true,
}

/**
 * All of the kinds of control id
 */
export const ALL_CONTROL_ID_KINDS = Object.keys(CONTROL_ID_KINDS) as [ControlIdKind, ...ControlIdKind[]]

/** The schema for the control ids of one kind, checked with {@link getControlIdKind} */
function controlIdSchema<TKind extends ControlIdKind, TId extends `${TKind}:${string}` = `${TKind}:${string}`>(
	kind: TKind
) {
	return z
		.custom<TId>((value) => typeof value === 'string' && getControlIdKind(value) === kind, `Invalid ${kind} control id`)
		.brand<TKind, 'inout'>()
}

/**
 * The schema for the control ids of each kind, which their types come from. A preset id has the connection, preset
 * and variables hash. The ids are branded, so that one can only be made by a `Create*ControlId` function, or by
 * checking a string with {@link isSomeControlId}, {@link isControlIdOfKind} or a schema, rather than written by hand
 */
export const zodControlIds = {
	bank: controlIdSchema('bank'),
	trigger: controlIdSchema('trigger'),
	'expression-variable': controlIdSchema('expression-variable'),
	'custom-action': controlIdSchema('custom-action'),
	'custom-feedback': controlIdSchema('custom-feedback'),
	'custom-preset': controlIdSchema('custom-preset'),
	page: controlIdSchema('page'),
	preset: controlIdSchema<'preset', `preset:${string}:${string}:${string}`>('preset'),
} satisfies Record<ControlIdKind, z.ZodType>

/** A control id of a specific kind */
export type ControlIdOfKind<TKind extends ControlIdKind> = z.output<(typeof zodControlIds)[TKind]>

export type BankControlId = ControlIdOfKind<'bank'>
export type TriggerControlId = ControlIdOfKind<'trigger'>
export type ExpressionVariableControlId = ControlIdOfKind<'expression-variable'>
export type CustomActionControlId = ControlIdOfKind<'custom-action'>
export type CustomFeedbackControlId = ControlIdOfKind<'custom-feedback'>
export type CustomPresetControlId = ControlIdOfKind<'custom-preset'>
export type PageControlId = ControlIdOfKind<'page'>
export type PresetControlId = ControlIdOfKind<'preset'>

export type SomeControlId = ControlIdOfKind<ControlIdKind>

/**
 * The kind of a control id, or undefined if it is not a control id.
 * This is the one place a control id is checked, everything else is built on it
 */
export function getControlIdKind(controlId: string): ControlIdKind | undefined {
	if (typeof controlId !== 'string') return undefined

	const separator = controlId.indexOf(':')
	if (separator === -1) return undefined

	const kind = controlId.slice(0, separator)
	if (!Object.hasOwn(CONTROL_ID_KINDS, kind)) return undefined

	// A preset id has two more parts after its connection id
	if (kind === 'preset') {
		const presetSeparator = controlId.indexOf(':', separator + 1)
		if (presetSeparator === -1 || presetSeparator === controlId.lastIndexOf(':')) return undefined
	}

	return kind as ControlIdKind
}

/**
 * Check whether a string is a control id of any kind
 */
export function isSomeControlId(controlId: string): controlId is SomeControlId {
	return getControlIdKind(controlId) !== undefined
}

/**
 * Check whether a string is a control id of a specific kind
 */
export function isControlIdOfKind<TKind extends ControlIdKind>(
	controlId: string,
	kind: TKind
): controlId is ControlIdOfKind<TKind> {
	return getControlIdKind(controlId) === kind
}

export const zodSomeControlId = z.custom<SomeControlId>(
	(value) => typeof value === 'string' && isSomeControlId(value),
	'Invalid control id'
)

/**
 * Parse a controlId
 */
export function ParseControlId(controlId: string): ParsedControlIdType | undefined {
	const kind = getControlIdKind(controlId)
	if (!kind) return undefined

	const value = controlId.slice(kind.length + 1)
	switch (kind) {
		case 'bank':
			return { type: 'bank', control: value }
		case 'trigger':
			return { type: 'trigger', trigger: value }
		case 'expression-variable':
			return { type: 'expression-variable', variableId: value }
		case 'custom-action':
			return { type: 'custom-action', customActionId: value }
		case 'custom-feedback':
			return { type: 'custom-feedback', customFeedbackId: value }
		case 'custom-preset':
			return { type: 'custom-preset', customPresetId: value }
		case 'page':
			return { type: 'page', pageId: value }
		case 'preset': {
			// The connectionId stops at the first colon, and the variablesHash starts after the last
			const first = value.indexOf(':')
			const last = value.lastIndexOf(':')
			return {
				type: 'preset',
				connectionId: value.slice(0, first),
				presetId: value.slice(first + 1, last),
				variablesHash: value.slice(last + 1),
			}
		}
		default:
			assertNever(kind)
			return undefined
	}
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

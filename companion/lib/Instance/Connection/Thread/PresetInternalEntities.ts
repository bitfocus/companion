import { nanoid } from 'nanoid'
import type { JsonValue } from 'type-fest'
import { ControlLocationOption } from '@companion-app/shared/ControlLocation.js'
import {
	EntityModelType,
	type ActionEntityModel,
	type FeedbackEntityModel,
	type SomeEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import {
	exprExpr,
	exprVal,
	isExpressionOrValue,
	optionsObjectToExpressionOptions,
	type ExpressionableOptionsObject,
	type ExpressionOrValue,
} from '@companion-app/shared/Model/Options.js'
import type {
	CompanionInternalActionSchemas,
	CompanionInternalFeedbackSchemas,
	CompanionInternalLogicActionSchemas,
	CompanionInternalLogicFeedbackSchemas,
	CompanionPresetAction,
	CompanionPresetFeedback,
	ModuleLogger,
	SomePresetActionEntry,
	SomePresetConditionEntry,
	SomePresetLayeredFeedbackEntry,
	SomePresetSimpleFeedbackEntry,
} from '@companion-module/host'

/**
 * Translation of the reserved `internal:*` preset action/feedback ids (defined by `@companion-module/base`)
 * into entities on the `internal` connection.
 *
 * The catalog in module-base is a stable vocabulary; this file owns the mapping to the current internal
 * definition ids and option keys. When an internal action/feedback is refactored, update the translation
 * here and existing module presets keep working.
 *
 * The host has already dropped any internal ids the module is too old to use or that the host doesn't
 * know. Unknown ids are still skipped (with a warning) here, in case a newer module-base/host forwards
 * ids this build doesn't know yet.
 */

/** A logger that can emit warnings. Satisfied by both ModuleLogger (thread) and winston Logger (legacy) */
export type PresetEntryWarnLogger = Pick<ModuleLogger, 'warn'>

export interface PresetEntryConversionContext {
	logger: PresetEntryWarnLogger
	connectionId: string
	connectionUpgradeIndex: number | undefined
	/**
	 * Whether `internal:*` entries may be translated to internal entities. Only allowed for new-api
	 * modules, whose host has validated and version-gated the entries. For legacy modules this must be
	 * false: their entries are converted as plain module entities, as they were before this existed.
	 */
	allowInternalEntities: boolean
}

/** Matches MAX_PRESET_NESTING_DEPTH enforced by @companion-module/host (not exported there) */
const MAX_PRESET_ENTRY_DEPTH = 10

/**
 * How a wire option value is converted for the internal field it targets:
 * - `passthrough`: literals are wrapped as plain values, ExpressionOrValue wrappers are kept as-is
 * - `expression`: the value is always stored as an expression ('expression'-type internal fields
 *   evaluate their value as an expression regardless of the isExpression flag)
 * - `noExpression`: the internal field has disableAutoExpression and is read without expression
 *   evaluation, so an expression wrapper is replaced (with a warning) by the field default
 */
type OptionConversion =
	| { mode: 'passthrough' }
	| { mode: 'expression' }
	| { mode: 'noExpression'; defaultValue: JsonValue }

interface InternalEntityTranslation {
	definitionId: string
	/** Wire option key -> internal option id + value conversion */
	options: Record<string, { id: string; convert: OptionConversion }>
	/** Internal options not present on the wire, injected unconditionally */
	injectOptions?: Record<string, () => ExpressionOrValue<any>>
	/** For building blocks: wire child slot -> internal child group */
	childGroups?: Record<string, { groupId: string; kind: 'actions' | 'conditions' }>
}

/** The "this button" location, resolving to wherever the preset is imported */
const selfLocation = (): ExpressionOrValue<string> => exprVal(ControlLocationOption.default)

type InternalPresetActionId = keyof CompanionInternalActionSchemas | keyof CompanionInternalLogicActionSchemas
type InternalPresetFeedbackId = keyof CompanionInternalFeedbackSchemas | keyof CompanionInternalLogicFeedbackSchemas

// The `satisfies` clauses make these tables exhaustive against the module-base catalog:
// adding an id to the catalog fails compilation here until a translation is added.

const InternalActionTranslations = {
	'internal:wait': {
		definitionId: 'wait',
		options: { time: { id: 'time', convert: { mode: 'expression' } } },
	},
	'internal:customLog': {
		definitionId: 'custom_log',
		options: { message: { id: 'message', convert: { mode: 'passthrough' } } },
	},
	'internal:abortButton': {
		definitionId: 'panic_bank',
		options: { skipReleaseActions: { id: 'unlatch', convert: { mode: 'noExpression', defaultValue: false } } },
		injectOptions: { location: selfLocation },
	},
	'internal:localVariableSet': {
		definitionId: 'local_variable_set_value',
		options: {
			name: { id: 'name', convert: { mode: 'passthrough' } },
			value: { id: 'value', convert: { mode: 'passthrough' } },
		},
		injectOptions: { location: selfLocation },
	},
	'internal:actionGroup': {
		definitionId: 'action_group',
		options: {
			executionMode: { id: 'execution_mode', convert: { mode: 'noExpression', defaultValue: 'inherit' } },
		},
		childGroups: { default: { groupId: 'default', kind: 'actions' } },
	},
	'internal:logicIf': {
		definitionId: 'logic_if',
		options: {},
		childGroups: {
			condition: { groupId: 'condition', kind: 'conditions' },
			actions: { groupId: 'actions', kind: 'actions' },
			elseActions: { groupId: 'else_actions', kind: 'actions' },
		},
	},
	'internal:logicWhile': {
		definitionId: 'logic_while',
		options: {},
		childGroups: {
			condition: { groupId: 'condition', kind: 'conditions' },
			actions: { groupId: 'actions', kind: 'actions' },
		},
	},
} satisfies Record<InternalPresetActionId, InternalEntityTranslation>

const InternalFeedbackTranslations = {
	'internal:checkExpression': {
		definitionId: 'check_expression',
		options: { expression: { id: 'expression', convert: { mode: 'expression' } } },
	},
	'internal:buttonPushed': {
		definitionId: 'bank_pushed',
		options: {
			treatSteppedAsPressed: { id: 'latch_compatability', convert: { mode: 'noExpression', defaultValue: false } },
		},
		injectOptions: { location: selfLocation },
	},
	'internal:buttonCurrentStep': {
		definitionId: 'bank_current_step',
		options: { step: { id: 'step', convert: { mode: 'passthrough' } } },
		injectOptions: { location: selfLocation },
	},
	'internal:logicOperator': {
		definitionId: 'logic_operator',
		options: { operation: { id: 'operation', convert: { mode: 'noExpression', defaultValue: 'and' } } },
		childGroups: { default: { groupId: 'default', kind: 'conditions' } },
	},
} satisfies Record<InternalPresetFeedbackId, InternalEntityTranslation>

/** Whether an action/feedback id references one of Companion's built-in internal definitions */
export function isInternalPresetEntryId(id: unknown): id is string {
	return typeof id === 'string' && id.startsWith('internal:')
}

/**
 * Structural view of an `internal:*` preset entry. The wire unions don't narrow on the id prefix,
 * so internal entries are handled structurally after the `isInternalPresetEntryId` dispatch; the
 * `satisfies` exhaustiveness on the translation tables provides the catalog-level type safety.
 */
interface RawInternalEntry {
	options?: Record<string, unknown>
	children?: Record<string, unknown>
	headline?: string
	isInverted?: boolean
}

function convertOptionValue(
	rawValue: unknown,
	convert: OptionConversion,
	wireKey: string,
	entryDescription: string,
	ctx: PresetEntryConversionContext
): ExpressionOrValue<any> | undefined {
	switch (convert.mode) {
		case 'passthrough':
			if (rawValue === undefined) return undefined
			return isExpressionOrValue(rawValue) ? structuredClone(rawValue) : exprVal(rawValue as JsonValue)
		case 'expression': {
			if (rawValue === undefined) return undefined
			const value = isExpressionOrValue(rawValue) ? rawValue.value : rawValue
			return exprExpr(String(value ?? ''))
		}
		case 'noExpression': {
			if (isExpressionOrValue(rawValue)) {
				if (rawValue.isExpression) {
					ctx.logger.warn(
						`Option "${wireKey}" of preset ${entryDescription} does not support expressions, using the default value`
					)
					return exprVal(structuredClone(convert.defaultValue))
				}
				return exprVal(structuredClone(rawValue.value))
			}
			if (rawValue === undefined) return exprVal(structuredClone(convert.defaultValue))
			return exprVal(rawValue as JsonValue)
		}
	}
}

function buildInternalEntityOptions(
	translation: InternalEntityTranslation,
	rawOptions: Record<string, unknown> | undefined,
	entryDescription: string,
	ctx: PresetEntryConversionContext
): ExpressionableOptionsObject {
	const options: ExpressionableOptionsObject = {}

	for (const [wireKey, field] of Object.entries(translation.options)) {
		const converted = convertOptionValue(rawOptions?.[wireKey], field.convert, wireKey, entryDescription, ctx)
		if (converted !== undefined) options[field.id] = converted
	}

	// Wire option keys not in the translation table map 1:1, in case a newer module-base
	// added an option to an existing id that this build doesn't know yet
	for (const [wireKey, rawValue] of Object.entries(rawOptions ?? {})) {
		if (wireKey in translation.options || wireKey in options) continue
		const converted = convertOptionValue(rawValue, { mode: 'passthrough' }, wireKey, entryDescription, ctx)
		if (converted !== undefined) options[wireKey] = converted
	}

	for (const [id, makeValue] of Object.entries(translation.injectOptions ?? {})) {
		options[id] = makeValue()
	}

	return options
}

/**
 * Build the children groups for a building-block entry, translating each wire child slot to its
 * internal group id and recursing into the entries. Returns null when nested too deeply.
 */
function buildInternalEntityChildren(
	translation: InternalEntityTranslation,
	rawChildren: Record<string, unknown> | undefined,
	entryDescription: string,
	ctx: PresetEntryConversionContext,
	depth: number
): Record<string, SomeEntityModel[]> | null {
	if (depth >= MAX_PRESET_ENTRY_DEPTH) {
		ctx.logger.warn(`Ignoring preset ${entryDescription}: nested too deeply`)
		return null
	}

	const children: Record<string, SomeEntityModel[]> = {}
	for (const [wireSlot, group] of Object.entries(translation.childGroups ?? {})) {
		const rawEntries = rawChildren?.[wireSlot]
		const childEntries = Array.isArray(rawEntries) ? rawEntries : []

		children[group.groupId] =
			group.kind === 'actions'
				? convertPresetActionEntries(childEntries as SomePresetActionEntry[], ctx, depth + 1)
				: convertPresetConditionEntries(childEntries as SomePresetConditionEntry[], ctx, depth + 1)
	}
	return children
}

function tryConvertInternalActionEntry(
	actionId: string,
	entry: RawInternalEntry,
	ctx: PresetEntryConversionContext,
	depth: number
): ActionEntityModel | null {
	const translation: InternalEntityTranslation | undefined =
		InternalActionTranslations[actionId as InternalPresetActionId]
	if (!translation) {
		ctx.logger.warn(`Ignoring unknown internal action "${actionId}" in preset`)
		return null
	}

	const entryDescription = `action "${actionId}"`

	const entity: ActionEntityModel = {
		type: EntityModelType.Action,
		id: nanoid(),
		connectionId: 'internal',
		definitionId: translation.definitionId,
		options: buildInternalEntityOptions(translation, entry.options, entryDescription, ctx),
		headline: entry.headline,
		upgradeIndex: undefined,
	}

	if (translation.childGroups) {
		const children = buildInternalEntityChildren(translation, entry.children, entryDescription, ctx, depth)
		if (!children) return null
		entity.children = children
	}

	return entity
}

/**
 * Convert an `internal:*` feedback entry to an entity, without any style payload.
 * The simple/layered wrappers below attach `style`/`styleOverrides`; condition children use this as-is.
 */
function tryConvertInternalFeedbackEntry(
	feedbackId: string,
	entry: RawInternalEntry,
	ctx: PresetEntryConversionContext,
	depth: number
): FeedbackEntityModel | null {
	const translation: InternalEntityTranslation | undefined =
		InternalFeedbackTranslations[feedbackId as InternalPresetFeedbackId]
	if (!translation) {
		ctx.logger.warn(`Ignoring unknown internal feedback "${feedbackId}" in preset`)
		return null
	}

	const entryDescription = `feedback "${feedbackId}"`

	const entity: FeedbackEntityModel = {
		type: EntityModelType.Feedback,
		id: nanoid(),
		connectionId: 'internal',
		definitionId: translation.definitionId,
		options: buildInternalEntityOptions(translation, entry.options, entryDescription, ctx),
		isInverted: exprVal(!!entry.isInverted),
		headline: entry.headline,
		upgradeIndex: undefined,
	}

	if (translation.childGroups) {
		const children = buildInternalEntityChildren(translation, entry.children, entryDescription, ctx, depth)
		if (!children) return null
		entity.children = children
	}

	return entity
}

/** Moved from PresetUtils (was toActionInstance): convert a module-defined preset action to an entity */
export function convertModulePresetAction(
	action: CompanionPresetAction,
	connectionId: string,
	connectionUpgradeIndex: number | undefined
): ActionEntityModel {
	return {
		type: EntityModelType.Action,
		id: nanoid(),
		connectionId: connectionId,
		definitionId: action.actionId,
		options: structuredClone(optionsObjectToExpressionOptions(action.options ?? {}, true)),
		headline: action.headline,
		upgradeIndex: connectionUpgradeIndex,
	}
}

export function createWaitAction(delay: number): ActionEntityModel {
	return {
		type: EntityModelType.Action,
		id: nanoid(),
		connectionId: 'internal',
		definitionId: 'wait',
		options: {
			time: exprExpr(delay + ''),
		},
		upgradeIndex: undefined,
	}
}

/**
 * Convert a list of preset action entries (module actions, internal actions and building blocks) to
 * entities, expanding the relative `delay` of each entry into a preceding internal `wait` action.
 * Also the recursion entry point for the action child groups of building blocks.
 */
export function convertPresetActionEntries(
	entries: SomePresetActionEntry[],
	ctx: PresetEntryConversionContext,
	depth = 0
): ActionEntityModel[] {
	const newActions: ActionEntityModel[] = []

	for (const entry of entries) {
		if (!entry || typeof entry !== 'object') continue

		const delay = Number(entry.delay)
		if (!isNaN(delay) && delay > 0) {
			newActions.push(createWaitAction(delay))
		}

		if (ctx.allowInternalEntities && isInternalPresetEntryId(entry.actionId)) {
			const entity = tryConvertInternalActionEntry(entry.actionId, entry, ctx, depth)
			if (entity) newActions.push(entity)
		} else {
			newActions.push(convertModulePresetAction(entry, ctx.connectionId, ctx.connectionUpgradeIndex))
		}
	}

	return newActions
}

/**
 * Convert the condition children of a building block: boolean feedbacks (module or internal,
 * including nested logic operators), which never carry a style payload.
 */
export function convertPresetConditionEntries(
	entries: SomePresetConditionEntry[],
	ctx: PresetEntryConversionContext,
	depth: number
): FeedbackEntityModel[] {
	const feedbacks: FeedbackEntityModel[] = []

	for (const entry of entries) {
		if (!entry || typeof entry !== 'object') continue

		if (ctx.allowInternalEntities && isInternalPresetEntryId(entry.feedbackId)) {
			const entity = tryConvertInternalFeedbackEntry(entry.feedbackId, entry, ctx, depth)
			if (entity) feedbacks.push(entity)
		} else {
			feedbacks.push({
				type: EntityModelType.Feedback,
				id: nanoid(),
				connectionId: ctx.connectionId,
				definitionId: entry.feedbackId,
				options: structuredClone(optionsObjectToExpressionOptions(entry.options ?? {}, true)),
				isInverted: exprVal(!!entry.isInverted),
				headline: entry.headline,
				upgradeIndex: ctx.connectionUpgradeIndex,
			})
		}
	}

	return feedbacks
}

/**
 * Convert an `internal:*` feedback at the top level of a simple preset, attaching its boolean style.
 * Returns null when the entry was skipped (already warned).
 */
export function tryConvertInternalSimpleFeedbackEntry(
	entry: SomePresetSimpleFeedbackEntry & { feedbackId: string },
	ctx: PresetEntryConversionContext
): FeedbackEntityModel | null {
	const entity = tryConvertInternalFeedbackEntry(entry.feedbackId, entry, ctx, 0)
	if (!entity) return null

	// `style` is carried outside the FeedbackEntityModel type, to be converted to style overrides
	// by ConvertLegacyStyleToElements - same as module feedbacks in convertPresetFeedbacksToEntities
	return {
		...entity,
		style: structuredClone((entry as CompanionPresetFeedback).style),
	} as FeedbackEntityModel
}

/**
 * Convert an `internal:*` feedback at the top level of a layered preset. The caller computes and
 * filters the style overrides (and skips the entry entirely when none are valid, as for module feedbacks).
 */
export function tryConvertInternalLayeredFeedbackEntry(
	entry: SomePresetLayeredFeedbackEntry & { feedbackId: string },
	styleOverrides: FeedbackEntityModel['styleOverrides'],
	ctx: PresetEntryConversionContext
): FeedbackEntityModel | null {
	const entity = tryConvertInternalFeedbackEntry(entry.feedbackId, entry, ctx, 0)
	if (!entity) return null

	return {
		...entity,
		styleOverrides: structuredClone(styleOverrides),
	}
}

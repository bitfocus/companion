import type { JsonValue } from 'type-fest'
import z from 'zod'
import type { CompanionOptionValues, CompanionPresetOptionValues } from '@companion-module/host'
import type { ControlIdKind } from '../ControlId.js'
import type { DropdownChoice, DropdownChoiceId } from './Common.js'

export const JsonValueSchema: z.ZodType<JsonValue> = z.json()

export const JsonObjectSchema = z.record(z.string(), JsonValueSchema.optional())

export function createExpressionOrValueSchema<T extends JsonValue | undefined>(
	schema: z.ZodType<T>
): z.ZodType<ExpressionOrValue<T>> {
	return z.union([
		z.object({
			value: schema,
			isExpression: z.literal(false),
		}),
		z.object({
			value: z.string(),
			isExpression: z.literal(true),
		}),
	])
}
export const ExpressionOrJsonValueSchema = createExpressionOrValueSchema(JsonValueSchema.optional())

export const ExpressionableOptionsObjectSchema: z.ZodType<ExpressionableOptionsObject> = z.record(
	z.string(),
	ExpressionOrJsonValueSchema.optional()
)

export type CompanionColorPresetValue =
	| string
	| {
			color: string
			title: string
	  }

export enum CompanionFieldVariablesSupport {
	/** Uses the internal parser, and supports all the features */
	InternalParser = 'internalParser',
	/** Old style parsing, with limited local variables */
	LocalVariables = 'local',
	/** Old style parsing, with no local variables */
	Basic = 'basic',
}

/**
 * The base of every input field. `default` is required unless `TDefault` includes `undefined`
 * @typeParam TDefault - the type of the field's `default` value, `undefined` for fields without one
 */
export type CompanionInputFieldBaseExtended<TDefault extends JsonValue | undefined> =
	CompanionInputFieldCommonExtended<TDefault> &
		(undefined extends TDefault
			? {
					/** The default value */
					default?: TDefault
				}
			: {
					/** The default value */
					default: TDefault
				})

interface CompanionInputFieldCommonExtended<TDefault extends JsonValue | undefined> {
	/** The unique id of this input field within the input group */
	id: string
	/** The type of this input field */
	type:
		| 'static-text'
		| 'textinput'
		| 'expression'
		| 'dropdown'
		| 'multidropdown'
		| 'colorpicker'
		| 'number'
		| 'checkbox'
		| 'custom-variable'
		| 'bonjour-device'
		| 'secret-text'
		| 'internal:time'
		| 'internal:date'
		| 'internal:variable'
		| 'internal:variable_value'
		| 'internal:custom_variable'
		| 'internal:trigger'
		| 'internal:trigger_collection'
		| 'internal:connection_id'
		| 'internal:connection_collection'
		| 'internal:surface_serial'
		| 'internal:outbound_surface_id'
		| 'internal:page'
		| 'internal:horizontal-alignment'
		| 'internal:vertical-alignment'
		| 'internal:text-styles'
		| 'internal:image-file'
		| 'internal:table'
		| 'internal:list'
	/** The label of the field */
	label: string
	/** A hover tooltip for this field */
	tooltip?: string
	/** A description for this field */
	description?: string
	/** A description for this field when in expression mode. This will replace the normal description */
	expressionDescription?: string

	isVisibleUi?: IsVisibleUiFn

	width?: number // For connection config

	/**
	 * Whether to disable support for toggling this field to be an expression
	 * Note: This is only available for internal connections
	 */
	disableAutoExpression?: boolean

	/**
	 * Whether to allow 'invalid' values to be passed to the module when an expression is used in this field.
	 * If false, the default value will be used instead.
	 */
	allowInvalidValues?: boolean

	/**
	 * If true, this field is skipped during the standard parseEntityOptions pass.
	 * The action handler must parse the raw value itself via action.rawEntity.rawOptions using an enhanced parser.
	 * Only valid for internal actions that need runtime context (e.g. current variable value) before parsing.
	 */
	deferParsing?: boolean

	/**
	 * Describes which sibling option fields identify the target variable for a deferred-parsing
	 * field. Drives both the variable picker (showing $(this:current)) and the live expression preview.
	 * Only valid alongside deferParsing: true.
	 */
	contextVariableResolution?: ContextVariableResolution

	/**
	 * Replaces `default` when creating an entity on the given kinds of control, eg a trigger has no grid location.
	 * Only available for internal connections
	 */
	defaultForControlType?: Partial<Record<ControlIdKind, Exclude<TDefault, undefined>>>
}

export type ContextVariableResolution =
	| { type: 'localVariable'; locationFieldId: string; nameFieldId: string }
	| { type: 'pageVariable'; pageFieldId: string; nameFieldId: string }
	| { type: 'customVariable'; nameFieldId: string }

export interface InternalInputFieldTime extends CompanionInputFieldBaseExtended<undefined> {
	type: 'internal:time'
}
export interface InternalInputFieldDate extends CompanionInputFieldBaseExtended<undefined> {
	type: 'internal:date'
}
export interface InternalInputFieldVariable extends CompanionInputFieldBaseExtended<undefined> {
	type: 'internal:variable'
	supportsLocal: boolean
}
export interface InternalInputFieldCustomVariable extends CompanionInputFieldBaseExtended<undefined> {
	type: 'internal:custom_variable'
	includeNone?: boolean
}
export interface InternalInputFieldVariableValue extends CompanionInputFieldBaseExtended<JsonValue> {
	type: 'internal:variable_value'
}
export interface InternalInputFieldTrigger extends CompanionInputFieldBaseExtended<string | undefined> {
	type: 'internal:trigger'
	includeSelf?: boolean | 'abort'
}
export interface InternalInputFieldTriggerCollection extends CompanionInputFieldBaseExtended<string | undefined> {
	type: 'internal:trigger_collection'
}
export interface InternalInputFieldConnectionCollection extends CompanionInputFieldBaseExtended<string | undefined> {
	type: 'internal:connection_collection'
}
export interface InternalInputFieldConnectionId extends CompanionInputFieldBaseExtended<string[] | undefined> {
	type: 'internal:connection_id'
	multiple: boolean
	includeAll?: boolean
	filterActionsRecorder?: boolean
}
export interface InternalInputFieldSurfaceSerial extends CompanionInputFieldBaseExtended<string> {
	type: 'internal:surface_serial'
	includeSelf: boolean
	/**
	 * Which entries to offer in the picker:
	 * - `groups`: surface groups only (group-level actions, e.g. lock, set page)
	 * - `surfaces`: individual surfaces only (per-surface actions where a group makes no sense)
	 * - `groups-and-surfaces`: both, so either a whole group or a single surface can be targeted
	 */
	listMode: 'groups' | 'surfaces' | 'groups-and-surfaces'
}
export interface InternalInputFieldOutboundSurfaceId extends CompanionInputFieldBaseExtended<undefined> {
	type: 'internal:outbound_surface_id'
}
export interface InternalInputFieldPage extends CompanionInputFieldBaseExtended<number> {
	type: 'internal:page'
	includeStartup: boolean
	includeDirection: boolean
}
export interface InternalInputFieldHorizontalAlignment extends CompanionInputFieldBaseExtended<
	'left' | 'center' | 'right'
> {
	type: 'internal:horizontal-alignment'
}
export interface InternalInputFieldVerticalAlignment extends CompanionInputFieldBaseExtended<
	'top' | 'center' | 'bottom'
> {
	type: 'internal:vertical-alignment'
}
export interface InternalInputFieldTextStyles extends CompanionInputFieldBaseExtended<
	('italic' | 'underline' | 'strikethrough')[]
> {
	type: 'internal:text-styles'
}
export interface InternalInputFieldPngImage extends CompanionInputFieldBaseExtended<string | null> {
	type: 'internal:image-file'
	/** Minimum image dimensions */
	min?: { width: number; height: number }
	/** Maximum image dimensions */
	max?: { width: number; height: number }
}

export interface InternalInputFieldTable extends CompanionInputFieldBaseExtended<Record<string, JsonValue>[]> {
	type: 'internal:table'
	columns: SomeCompanionInputField[]
}

export interface InternalInputFieldList extends CompanionInputFieldBaseExtended<Record<string, JsonValue>[]> {
	type: 'internal:list'
	fields: SomeCompanionInputField[]
	addLabel?: string
	minItems?: number
}

export type InternalInputField =
	| InternalInputFieldTime
	| InternalInputFieldDate
	| InternalInputFieldVariable
	| InternalInputFieldVariableValue
	| InternalInputFieldCustomVariable
	| InternalInputFieldTrigger
	| InternalInputFieldTriggerCollection
	| InternalInputFieldConnectionId
	| InternalInputFieldConnectionCollection
	| InternalInputFieldSurfaceSerial
	| InternalInputFieldOutboundSurfaceId
	| InternalInputFieldPage
	| InternalInputFieldHorizontalAlignment
	| InternalInputFieldVerticalAlignment
	| InternalInputFieldTextStyles
	| InternalInputFieldPngImage
	| InternalInputFieldTable
	| InternalInputFieldList

export interface CompanionInputFieldStaticTextExtended extends CompanionInputFieldBaseExtended<undefined> {
	type: 'static-text'

	value: string
}
export interface CompanionInputFieldColorExtended extends CompanionInputFieldBaseExtended<string | number> {
	type: 'colorpicker'

	enableAlpha: boolean
	returnType: 'string' | 'number'

	presetColors?: CompanionColorPresetValue[]
}

/**
 * Default expression-mode hint for a color field. Any color field accepts either form and normalizes it to
 * the field's returnType, so the guidance is the same regardless of returnType.
 */
export const DEFAULT_COLOR_EXPRESSION_DESCRIPTION =
	"Return a color number (e.g. 16711680 or 0xff0000) or a css color string (e.g. '#ff0000' or 'rgb(255, 0, 0))'"

/**
 * The default expression-mode hint for a color field, or undefined for non-color fields.
 */
export function colorFieldExpressionHint(field: SomeCompanionInputField): string | undefined {
	return field.type === 'colorpicker' ? DEFAULT_COLOR_EXPRESSION_DESCRIPTION : undefined
}
export interface CompanionInputFieldTextInputExtended extends CompanionInputFieldBaseExtended<string | undefined> {
	type: 'textinput'

	minLength?: number

	regex?: string

	useVariables?: CompanionFieldVariablesSupport

	placeholder?: string
	multiline?: boolean

	/**
	 * Internal use only: disable the sanitisation and validation rules defined above, and allow any value to be passed to the execution
	 * This is so that expression results don't get mangled
	 */
	disableSanitisation?: boolean

	/**
	 * Internal use only: when a `$(...)` variable reference is pasted into this field (in value mode), unwrap it to
	 * just the inner name. Set to a namespace (e.g. `local`) to also strip a matching `namespace:` prefix, so pasting
	 * `$(local:foo)` yields `foo`. Used by the local/page variable name fields.
	 */
	unwrapPastedVariableNamespace?: string
}
export interface CompanionInputFieldExpressionExtended extends CompanionInputFieldBaseExtended<string | undefined> {
	type: 'expression'

	// placeholder?: string
}
export interface CompanionInputFieldDropdownExtended extends CompanionInputFieldBaseExtended<DropdownChoiceId> {
	type: 'dropdown'
	choices: DropdownChoice[]
	allowCustom?: boolean
	regex?: string
}
export interface CompanionInputFieldMultiDropdownExtended extends CompanionInputFieldBaseExtended<DropdownChoiceId[]> {
	type: 'multidropdown'
	/** The possible choices */
	choices: DropdownChoice[]
	/** The minimum number of selected values */
	minSelection?: number
	/** The maximum number of selected values */
	maxSelection?: number
	/**
	 * If true, the ui should sort the selected values by the order they appear in the choices array
	 * Any custom values will be sorted alphabetically at the end of the list
	 */
	sortSelection?: boolean

	allowCustom?: boolean
	regex?: string
}
export interface CompanionInputFieldNumberExtended extends CompanionInputFieldBaseExtended<number | null> {
	type: 'number'
	/**
	 * The minimum value to allow
	 * Note: values may not conform to this
	 */
	min: number
	/**
	 * The maximum value to allow
	 * Note: values may not conform to this
	 */
	max: number
	/** The stepping of the arrows */
	step?: number
	/** Whether to show a slider for the input */
	range?: boolean
	/** When true, show the min value as a visual -∞ when value <= min */
	showMinAsNegativeInfinity?: boolean
	/** When true, show the max value as a visual ∞ when value >= max */
	showMaxAsPositiveInfinity?: boolean

	/** When value validation occurs, clamp values to the min/max instead of rejecting them as invalid */
	clampValues?: boolean
	/** Whether to only allow integer values */
	asInteger?: boolean
	/**
	 * When true, the field can be cleared to `null`, shown in the UI as "auto". The consumer decides what
	 * "auto" resolves to. Requires the value type to permit `null`. A `null` default is only valid with this set.
	 */
	allowNull?: boolean
}
export interface CompanionInputFieldCheckboxExtended extends CompanionInputFieldBaseExtended<boolean> {
	type: 'checkbox'
	/** Display as a toggle */
	displayToggle?: boolean
}
export interface CompanionInputFieldCustomVariableExtended extends CompanionInputFieldBaseExtended<undefined> {
	type: 'custom-variable'
}

export type ExtendedInputField =
	| CompanionInputFieldStaticTextExtended
	| CompanionInputFieldColorExtended
	| CompanionInputFieldTextInputExtended
	| CompanionInputFieldExpressionExtended
	| CompanionInputFieldDropdownExtended
	| CompanionInputFieldMultiDropdownExtended
	| CompanionInputFieldNumberExtended
	| CompanionInputFieldCheckboxExtended
	| CompanionInputFieldCustomVariableExtended

export interface CompanionInputFieldBonjourDeviceExtended extends CompanionInputFieldBaseExtended<undefined> {
	type: 'bonjour-device'
}
export interface CompanionInputFieldSecretExtended extends CompanionInputFieldBaseExtended<string | undefined> {
	type: 'secret-text'
	/**
	 * Whether a value is required
	 */
	minLength?: number

	regex?: string
}
export type SomeCompanionConfigInputField = CompanionInputFieldBonjourDeviceExtended | CompanionInputFieldSecretExtended

export interface IsVisibleUiFn {
	type: 'function' | 'expression'
	fn: string
	data?: any
}

export type SomeCompanionInputField = ExtendedInputField | SomeCompanionConfigInputField | InternalInputField

export type ExpressionOrValue<T> = { value: T; isExpression: false } | { value: string; isExpression: true }
export type ExpressionableOptionsObject = {
	[key: string]: ExpressionOrValue<JsonValue | undefined> | undefined
}

export type ExpressionValueType<ExprOrValue extends ExpressionOrValue<unknown>> = [ExprOrValue] extends [
	ExpressionOrValue<infer Value>,
]
	? Value
	: never

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function isExpressionOrValue(input: any): input is ExpressionOrValue<any> {
	return !!input && typeof input === 'object' && 'isExpression' in input && typeof input.isExpression === 'boolean'
}

export function optionsObjectToExpressionOptions(
	options: CompanionOptionValues | CompanionPresetOptionValues<any>,
	allowExpressions = true
): ExpressionableOptionsObject {
	const res: ExpressionableOptionsObject = {}

	for (const [key, val] of Object.entries(options)) {
		res[key] = allowExpressions && isExpressionOrValue(val) ? val : { value: val, isExpression: false }
	}

	return res
}

export function convertExpressionOptionsWithoutParsing(options: ExpressionableOptionsObject): CompanionOptionValues {
	const res: CompanionOptionValues = {}

	for (const [key, val] of Object.entries(options)) {
		res[key] = val?.value
	}

	return res
}

/** The values a field's default can take, including any per-control-type override */
type FieldDefaultValue<TField extends SomeCompanionInputField> = TField extends unknown
	? | TField['default']
		| ('defaultForControlType' extends keyof TField
				? NonNullable<TField['defaultForControlType']>[keyof NonNullable<TField['defaultForControlType']>]
				: never)
	: never

/**
 * The default value of a field, for a new entity on a control of the given kind
 */
export function getFieldDefaultForControl<TField extends SomeCompanionInputField>(
	field: TField,
	controlKind: ControlIdKind | null
): FieldDefaultValue<TField> {
	// An undefined override counts as unset, as it would be dropped when the definition is sent as JSON
	const override = controlKind ? field.defaultForControlType?.[controlKind] : undefined
	if (override !== undefined) return override as FieldDefaultValue<TField>
	return field.default as FieldDefaultValue<TField>
}

export function exprVal<T extends JsonValue | undefined>(value: T): ExpressionOrValue<T> {
	return { value: value, isExpression: false }
}
export function exprExpr(value: string): ExpressionOrValue<any> {
	return { value: value, isExpression: true }
}

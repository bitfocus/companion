import type { JsonValue } from 'type-fest'
import z from 'zod'
import type { CompanionOptionValues, CompanionPresetOptionValues } from '@companion-module/host'
import { ALL_CONTROL_ID_KINDS, type ControlIdKind } from '../ControlId.js'
import type { DropdownChoice } from './Common.js'

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

export const CompanionColorPresetValueSchema = z.union([
	z.string(),
	z.object({
		color: z.string(),
		title: z.string(),
	}),
])
export type CompanionColorPresetValue = z.infer<typeof CompanionColorPresetValueSchema>

export enum CompanionFieldVariablesSupport {
	/** Uses the internal parser, and supports all the features */
	InternalParser = 'internalParser',
	/** Old style parsing, with limited local variables */
	LocalVariables = 'local',
	/** Old style parsing, with no local variables */
	Basic = 'basic',
}

export const DropdownChoiceSchema: z.ZodType<DropdownChoice> = z.object({
	id: z.union([z.string(), z.number()]),
	label: z.string(),
	disabled: z.boolean().optional(),
})

export const IsVisibleUiFnSchema = z.object({
	type: z.enum(['function', 'expression']),
	fn: z.string(),
	data: z.any().optional(),
})
export type IsVisibleUiFn = z.infer<typeof IsVisibleUiFnSchema>

export const ContextVariableResolutionSchema = z.discriminatedUnion('type', [
	z.object({ type: z.literal('localVariable'), locationFieldId: z.string(), nameFieldId: z.string() }),
	z.object({ type: z.literal('pageVariable'), pageFieldId: z.string(), nameFieldId: z.string() }),
	z.object({ type: z.literal('customVariable'), nameFieldId: z.string() }),
])
export type ContextVariableResolution = z.infer<typeof ContextVariableResolutionSchema>

const ControlIdKindSchema = z.enum(ALL_CONTROL_ID_KINDS)

/**
 * The properties shared by every input field, except for `type`, `default` and `defaultForControlType`
 */
const CompanionInputFieldCommonShape = {
	/** The unique id of this input field within the input group */
	id: z.string(),
	/** The label of the field */
	label: z.string(),
	/** A hover tooltip for this field */
	tooltip: z.string().optional(),
	/** A description for this field */
	description: z.string().optional(),
	/** A description for this field when in expression mode. This will replace the normal description */
	expressionDescription: z.string().optional(),

	isVisibleUi: IsVisibleUiFnSchema.optional(),

	/** For connection config */
	width: z.number().optional(),

	/**
	 * Whether to disable support for toggling this field to be an expression
	 * Note: This is only available for internal connections
	 */
	disableAutoExpression: z.boolean().optional(),

	/**
	 * Whether to allow 'invalid' values to be passed to the module when an expression is used in this field.
	 * If false, the default value will be used instead.
	 */
	allowInvalidValues: z.boolean().optional(),

	/**
	 * If true, this field is skipped during the standard parseEntityOptions pass.
	 * The action handler must parse the raw value itself via action.rawEntity.rawOptions using an enhanced parser.
	 * Only valid for internal actions that need runtime context (e.g. current variable value) before parsing.
	 */
	deferParsing: z.boolean().optional(),

	/**
	 * Describes which sibling option fields identify the target variable for a deferred-parsing
	 * field. Drives both the variable picker (showing $(this:current)) and the live expression preview.
	 * Only valid alongside deferParsing: true.
	 */
	contextVariableResolution: ContextVariableResolutionSchema.optional(),

	/**
	 * Disable this field when the entity is on one of the given kinds of control, as it has no meaning there.
	 * It is hidden in the editor, and parsed as its `defaultForControlType` (or `default`) instead of its value.
	 * Only available for internal connections
	 */
	disabledForControlTypes: z.array(ControlIdKindSchema).optional(),
}

/**
 * Build the properties of a field relating to its default value
 * @param valueSchema The schema of a value of the field (excluding `undefined`)
 * @param required Whether the default value is required
 */
function defaultShape<TValue extends z.ZodType<JsonValue>, TRequired extends boolean>(
	valueSchema: TValue,
	required: TRequired
) {
	return {
		/** The default value */
		default: (required ? valueSchema : valueSchema.optional()) as TRequired extends true
			? TValue
			: z.ZodOptional<TValue>,
		/**
		 * Replaces `default` when creating an entity on the given kinds of control, eg a trigger has no grid location.
		 * Only available for internal connections
		 */
		defaultForControlType: z.partialRecord(ControlIdKindSchema, valueSchema).optional(),
	}
}

/**
 * Build the properties shared by every input field
 * @param type The type of the field
 * @param valueSchema The schema of a value of the field (excluding `undefined`)
 * @param required Whether the default value is required
 */
function fieldShape<const TType extends string, TValue extends z.ZodType<JsonValue>, TRequired extends boolean>(
	type: TType,
	valueSchema: TValue,
	required: TRequired
) {
	return {
		...CompanionInputFieldCommonShape,
		/** The type of this input field */
		type: z.literal(type),
		...defaultShape(valueSchema, required),
	}
}

/**
 * The base of every input field. `default` is required unless `TDefault` includes `undefined`
 * @typeParam TDefault - the type of the field's `default` value, `undefined` for fields without one
 */
export type CompanionInputFieldBaseExtended<TDefault extends JsonValue | undefined> = z.infer<
	z.ZodObject<typeof CompanionInputFieldCommonShape>
> & {
	/**
	 * Replaces `default` when creating an entity on the given kinds of control, eg a trigger has no grid location.
	 * Only available for internal connections
	 */
	defaultForControlType?: Partial<Record<ControlIdKind, Exclude<TDefault, undefined>>>
} & (undefined extends TDefault
		? {
				/** The default value */
				default?: TDefault
			}
		: {
				/** The default value */
				default: TDefault
			})

/** A field without a value */
const NoValueSchema = z.never() as unknown as z.ZodType<never>

const DropdownChoiceIdSchema = z.union([z.string(), z.number()])

export const InternalInputFieldTimeSchema = z.object(fieldShape('internal:time', NoValueSchema, false))
export type InternalInputFieldTime = z.infer<typeof InternalInputFieldTimeSchema>

export const InternalInputFieldDateSchema = z.object(fieldShape('internal:date', NoValueSchema, false))
export type InternalInputFieldDate = z.infer<typeof InternalInputFieldDateSchema>

export const InternalInputFieldVariableSchema = z.object({
	...fieldShape('internal:variable', NoValueSchema, false),
	supportsLocal: z.boolean(),
})
export type InternalInputFieldVariable = z.infer<typeof InternalInputFieldVariableSchema>

export const InternalInputFieldCustomVariableSchema = z.object({
	...fieldShape('internal:custom_variable', NoValueSchema, false),
	includeNone: z.boolean().optional(),
})
export type InternalInputFieldCustomVariable = z.infer<typeof InternalInputFieldCustomVariableSchema>

export const InternalInputFieldVariableValueSchema = z.object(
	fieldShape('internal:variable_value', JsonValueSchema, true)
)
export type InternalInputFieldVariableValue = z.infer<typeof InternalInputFieldVariableValueSchema>

export const InternalInputFieldTriggerSchema = z.object({
	...fieldShape('internal:trigger', z.string(), false),
	includeSelf: z.union([z.boolean(), z.literal('abort')]).optional(),
})
export type InternalInputFieldTrigger = z.infer<typeof InternalInputFieldTriggerSchema>

export const InternalInputFieldTriggerCollectionSchema = z.object(
	fieldShape('internal:trigger_collection', z.string(), false)
)
export type InternalInputFieldTriggerCollection = z.infer<typeof InternalInputFieldTriggerCollectionSchema>

export const InternalInputFieldConnectionCollectionSchema = z.object(
	fieldShape('internal:connection_collection', z.string(), false)
)
export type InternalInputFieldConnectionCollection = z.infer<typeof InternalInputFieldConnectionCollectionSchema>

export const InternalInputFieldConnectionIdSchema = z.object({
	...fieldShape('internal:connection_id', z.array(z.string()), false),
	multiple: z.boolean(),
	includeAll: z.boolean().optional(),
	filterActionsRecorder: z.boolean().optional(),
})
export type InternalInputFieldConnectionId = z.infer<typeof InternalInputFieldConnectionIdSchema>

export const InternalInputFieldSurfaceSerialSchema = z.object({
	...fieldShape('internal:surface_serial', z.string(), true),
	includeSelf: z.boolean(),
	/**
	 * Which entries to offer in the picker:
	 * - `groups`: surface groups only (group-level actions, e.g. lock, set page)
	 * - `surfaces`: individual surfaces only (per-surface actions where a group makes no sense)
	 * - `groups-and-surfaces`: both, so either a whole group or a single surface can be targeted
	 */
	listMode: z.enum(['groups', 'surfaces', 'groups-and-surfaces']),
})
export type InternalInputFieldSurfaceSerial = z.infer<typeof InternalInputFieldSurfaceSerialSchema>

export const InternalInputFieldOutboundSurfaceIdSchema = z.object(
	fieldShape('internal:outbound_surface_id', NoValueSchema, false)
)
export type InternalInputFieldOutboundSurfaceId = z.infer<typeof InternalInputFieldOutboundSurfaceIdSchema>

export const InternalInputFieldPageSchema = z.object({
	...fieldShape('internal:page', z.number(), true),
	includeStartup: z.boolean(),
	includeDirection: z.boolean(),
})
export type InternalInputFieldPage = z.infer<typeof InternalInputFieldPageSchema>

export const InternalInputFieldHorizontalAlignmentSchema = z.object(
	fieldShape('internal:horizontal-alignment', z.enum(['left', 'center', 'right']), true)
)
export type InternalInputFieldHorizontalAlignment = z.infer<typeof InternalInputFieldHorizontalAlignmentSchema>

export const InternalInputFieldVerticalAlignmentSchema = z.object(
	fieldShape('internal:vertical-alignment', z.enum(['top', 'center', 'bottom']), true)
)
export type InternalInputFieldVerticalAlignment = z.infer<typeof InternalInputFieldVerticalAlignmentSchema>

export const InternalInputFieldTextStylesSchema = z.object(
	fieldShape('internal:text-styles', z.array(z.enum(['italic', 'underline', 'strikethrough'])), true)
)
export type InternalInputFieldTextStyles = z.infer<typeof InternalInputFieldTextStylesSchema>

export const InternalInputFieldPngImageSchema = z.object({
	...fieldShape('internal:image-file', z.string().nullable(), true),
	/** Minimum image dimensions */
	min: z.object({ width: z.number(), height: z.number() }).optional(),
})
export type InternalInputFieldPngImage = z.infer<typeof InternalInputFieldPngImageSchema>

const TableRowSchema = z.record(z.string(), JsonValueSchema)

const InternalInputFieldTableBaseSchema = z.object(fieldShape('internal:table', z.array(TableRowSchema), true))
export type InternalInputFieldTable = z.infer<typeof InternalInputFieldTableBaseSchema> & {
	columns: SomeCompanionInputField[]
}
export const InternalInputFieldTableSchema = InternalInputFieldTableBaseSchema.extend({
	columns: z.array(z.lazy(() => SomeCompanionInputFieldSchema)),
})

const InternalInputFieldListBaseSchema = z.object({
	...fieldShape('internal:list', z.array(TableRowSchema), true),
	addLabel: z.string().optional(),
	minItems: z.number().optional(),
})
export type InternalInputFieldList = z.infer<typeof InternalInputFieldListBaseSchema> & {
	fields: SomeCompanionInputField[]
}
export const InternalInputFieldListSchema = InternalInputFieldListBaseSchema.extend({
	fields: z.array(z.lazy(() => SomeCompanionInputFieldSchema)),
})

export const CompanionInputFieldStaticTextExtendedSchema = z.object({
	...fieldShape('static-text', NoValueSchema, false),
	value: z.string(),
})
export type CompanionInputFieldStaticTextExtended = z.infer<typeof CompanionInputFieldStaticTextExtendedSchema>

export const CompanionInputFieldColorExtendedSchema = z.object({
	...fieldShape('colorpicker', z.union([z.string(), z.number()]), true),
	enableAlpha: z.boolean(),
	returnType: z.enum(['string', 'number']),
	presetColors: z.array(CompanionColorPresetValueSchema).optional(),
})
export type CompanionInputFieldColorExtended = z.infer<typeof CompanionInputFieldColorExtendedSchema>

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

export const CompanionInputFieldTextInputExtendedSchema = z.object({
	...fieldShape('textinput', z.string(), false),

	minLength: z.number().optional(),

	regex: z.string().optional(),

	useVariables: z.enum(CompanionFieldVariablesSupport).optional(),

	placeholder: z.string().optional(),
	multiline: z.boolean().optional(),

	/**
	 * Internal use only: disable the sanitisation and validation rules defined above, and allow any value to be passed to the execution
	 * This is so that expression results don't get mangled
	 */
	disableSanitisation: z.boolean().optional(),

	/**
	 * Internal use only: when a `$(...)` variable reference is pasted into this field (in value mode), unwrap it to
	 * just the inner name. Set to a namespace (e.g. `local`) to also strip a matching `namespace:` prefix, so pasting
	 * `$(local:foo)` yields `foo`. Used by the local/page variable name fields.
	 */
	unwrapPastedVariableNamespace: z.string().optional(),
})
export type CompanionInputFieldTextInputExtended = z.infer<typeof CompanionInputFieldTextInputExtendedSchema>

export const CompanionInputFieldExpressionExtendedSchema = z.object(fieldShape('expression', z.string(), false))
export type CompanionInputFieldExpressionExtended = z.infer<typeof CompanionInputFieldExpressionExtendedSchema>

export const CompanionInputFieldDropdownExtendedSchema = z.object({
	...fieldShape('dropdown', DropdownChoiceIdSchema, true),
	choices: z.array(DropdownChoiceSchema),
	allowCustom: z.boolean().optional(),
	regex: z.string().optional(),
})
export type CompanionInputFieldDropdownExtended = z.infer<typeof CompanionInputFieldDropdownExtendedSchema>

export const CompanionInputFieldMultiDropdownExtendedSchema = z.object({
	...fieldShape('multidropdown', z.array(DropdownChoiceIdSchema), true),
	/** The possible choices */
	choices: z.array(DropdownChoiceSchema),
	/** The minimum number of selected values */
	minSelection: z.number().optional(),
	/** The maximum number of selected values */
	maxSelection: z.number().optional(),
	/**
	 * If true, the ui should sort the selected values by the order they appear in the choices array
	 * Any custom values will be sorted alphabetically at the end of the list
	 */
	sortSelection: z.boolean().optional(),

	allowCustom: z.boolean().optional(),
	regex: z.string().optional(),
})
export type CompanionInputFieldMultiDropdownExtended = z.infer<typeof CompanionInputFieldMultiDropdownExtendedSchema>

export const CompanionInputFieldNumberExtendedSchema = z.object({
	...fieldShape('number', z.number().nullable(), true),
	/**
	 * The minimum value to allow
	 * Note: values may not conform to this
	 */
	min: z.number(),
	/**
	 * The maximum value to allow
	 * Note: values may not conform to this
	 */
	max: z.number(),
	/** The stepping of the arrows */
	step: z.number().optional(),
	/** Whether to show a slider for the input */
	range: z.boolean().optional(),
	/** When true, show the min value as a visual -∞ when value <= min */
	showMinAsNegativeInfinity: z.boolean().optional(),
	/** When true, show the max value as a visual ∞ when value >= max */
	showMaxAsPositiveInfinity: z.boolean().optional(),

	/** When value validation occurs, clamp values to the min/max instead of rejecting them as invalid */
	clampValues: z.boolean().optional(),
	/** Whether to only allow integer values */
	asInteger: z.boolean().optional(),
	/**
	 * When true, the field can be cleared to `null`, shown in the UI as "auto". The consumer decides what
	 * "auto" resolves to. Requires the value type to permit `null`. A `null` default is only valid with this set.
	 */
	allowNull: z.boolean().optional(),
})
export type CompanionInputFieldNumberExtended = z.infer<typeof CompanionInputFieldNumberExtendedSchema>

export const CompanionInputFieldCheckboxExtendedSchema = z.object({
	...fieldShape('checkbox', z.boolean(), true),
	/** Display as a toggle */
	displayToggle: z.boolean().optional(),
})
export type CompanionInputFieldCheckboxExtended = z.infer<typeof CompanionInputFieldCheckboxExtendedSchema>

export const CompanionInputFieldCustomVariableExtendedSchema = z.object(
	fieldShape('custom-variable', NoValueSchema, false)
)
export type CompanionInputFieldCustomVariableExtended = z.infer<typeof CompanionInputFieldCustomVariableExtendedSchema>

export const CompanionInputFieldBonjourDeviceExtendedSchema = z.object(
	fieldShape('bonjour-device', NoValueSchema, false)
)
export type CompanionInputFieldBonjourDeviceExtended = z.infer<typeof CompanionInputFieldBonjourDeviceExtendedSchema>

export const CompanionInputFieldSecretExtendedSchema = z.object({
	...fieldShape('secret-text', z.string(), false),
	/**
	 * Whether a value is required
	 */
	minLength: z.number().optional(),

	regex: z.string().optional(),
})
export type CompanionInputFieldSecretExtended = z.infer<typeof CompanionInputFieldSecretExtendedSchema>

/** The input fields available to modules */
export const ExtendedInputFieldSchemas = [
	CompanionInputFieldStaticTextExtendedSchema,
	CompanionInputFieldColorExtendedSchema,
	CompanionInputFieldTextInputExtendedSchema,
	CompanionInputFieldExpressionExtendedSchema,
	CompanionInputFieldDropdownExtendedSchema,
	CompanionInputFieldMultiDropdownExtendedSchema,
	CompanionInputFieldNumberExtendedSchema,
	CompanionInputFieldCheckboxExtendedSchema,
	CompanionInputFieldCustomVariableExtendedSchema,
] as const
export type ExtendedInputField = z.infer<(typeof ExtendedInputFieldSchemas)[number]>

/** The input fields only available for connection config */
export const SomeCompanionConfigInputFieldSchemas = [
	CompanionInputFieldBonjourDeviceExtendedSchema,
	CompanionInputFieldSecretExtendedSchema,
] as const
export type SomeCompanionConfigInputField = z.infer<(typeof SomeCompanionConfigInputFieldSchemas)[number]>

/** The input fields only available to the internal module, which are not recursive */
const InternalInputFieldSimpleSchemas = [
	InternalInputFieldTimeSchema,
	InternalInputFieldDateSchema,
	InternalInputFieldVariableSchema,
	InternalInputFieldVariableValueSchema,
	InternalInputFieldCustomVariableSchema,
	InternalInputFieldTriggerSchema,
	InternalInputFieldTriggerCollectionSchema,
	InternalInputFieldConnectionIdSchema,
	InternalInputFieldConnectionCollectionSchema,
	InternalInputFieldSurfaceSerialSchema,
	InternalInputFieldOutboundSurfaceIdSchema,
	InternalInputFieldPageSchema,
	InternalInputFieldHorizontalAlignmentSchema,
	InternalInputFieldVerticalAlignmentSchema,
	InternalInputFieldTextStylesSchema,
	InternalInputFieldPngImageSchema,
] as const
export type InternalInputField =
	z.infer<(typeof InternalInputFieldSimpleSchemas)[number]> | InternalInputFieldTable | InternalInputFieldList

export type SomeCompanionInputField = ExtendedInputField | SomeCompanionConfigInputField | InternalInputField

/**
 * Schema of any input field definition
 */
export const SomeCompanionInputFieldSchema: z.ZodType<SomeCompanionInputField> = z.discriminatedUnion('type', [
	...ExtendedInputFieldSchemas,
	...SomeCompanionConfigInputFieldSchemas,
	...InternalInputFieldSimpleSchemas,
	InternalInputFieldTableSchema,
	InternalInputFieldListSchema,
])

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

/**
 * Whether a field is disabled for an entity on a control of the given kind
 */
export function isFieldDisabledForControl(field: SomeCompanionInputField, controlKind: ControlIdKind | null): boolean {
	return !!controlKind && !!field.disabledForControlTypes?.includes(controlKind)
}

export function exprVal<T extends JsonValue | undefined>(value: T): ExpressionOrValue<T> {
	return { value: value, isExpression: false }
}
export function exprExpr(value: string): ExpressionOrValue<any> {
	return { value: value, isExpression: true }
}

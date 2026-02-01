import type { DropdownChoice, DropdownChoiceId } from './Common.js'
import type { JsonValue } from 'type-fest'
import type { CompanionOptionValues } from '@companion-module/host'
import z from 'zod'

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

export interface CompanionInputFieldBaseExtended {
	/** The unique id of this input field within the input group */
	id: string
	/** The type of this input field */
	type:
		| 'static-text'
		| 'textinput'
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
		| 'internal:custom_variable'
		| 'internal:trigger'
		| 'internal:trigger_collection'
		| 'internal:connection_id'
		| 'internal:connection_collection'
		| 'internal:surface_serial'
		| 'internal:page'
		| 'internal:horizontal-alignment'
		| 'internal:vertical-alignment'
		| 'internal:png-image'
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
}

export interface InternalInputFieldTime extends CompanionInputFieldBaseExtended {
	type: 'internal:time'
}
export interface InternalInputFieldDate extends CompanionInputFieldBaseExtended {
	type: 'internal:date'
}
export interface InternalInputFieldVariable extends CompanionInputFieldBaseExtended {
	type: 'internal:variable'
	// default: string
	supportsLocal: boolean
}
export interface InternalInputFieldCustomVariable extends CompanionInputFieldBaseExtended {
	type: 'internal:custom_variable'
	includeNone?: boolean
}
export interface InternalInputFieldTrigger extends CompanionInputFieldBaseExtended {
	type: 'internal:trigger'
	includeSelf?: boolean | 'abort'
	default?: string
}
export interface InternalInputFieldTriggerCollection extends CompanionInputFieldBaseExtended {
	type: 'internal:trigger_collection'
	default?: string
}
export interface InternalInputFieldConnectionCollection extends CompanionInputFieldBaseExtended {
	type: 'internal:connection_collection'
	default?: string
}
export interface InternalInputFieldConnectionId extends CompanionInputFieldBaseExtended {
	type: 'internal:connection_id'
	multiple: boolean
	includeAll?: boolean
	filterActionsRecorder?: boolean
	default?: string[]
}
export interface InternalInputFieldSurfaceSerial extends CompanionInputFieldBaseExtended {
	type: 'internal:surface_serial'
	includeSelf: boolean
	default: string
	useRawSurfaces?: boolean
}
export interface InternalInputFieldPage extends CompanionInputFieldBaseExtended {
	type: 'internal:page'
	includeStartup: boolean
	includeDirection: boolean
	default: number
}
export interface InternalInputFieldHorizontalAlignment extends CompanionInputFieldBaseExtended {
	type: 'internal:horizontal-alignment'
	/** The default value */
	default: 'left' | 'center' | 'right'
}
export interface InternalInputFieldVerticalAlignment extends CompanionInputFieldBaseExtended {
	type: 'internal:vertical-alignment'
	/** The default value */
	default: 'top' | 'center' | 'bottom'
}
export interface InternalInputFieldPngImage extends CompanionInputFieldBaseExtended {
	type: 'internal:png-image'
	/** The default value */
	default: string | null
	/** Minimum image dimensions */
	min?: { width: number; height: number }
	/** Maximum image dimensions */
	max?: { width: number; height: number }
	/** Allow non-PNG image formats */
	allowNonPng?: boolean
}

export type InternalInputField =
	| InternalInputFieldTime
	| InternalInputFieldDate
	| InternalInputFieldVariable
	| InternalInputFieldCustomVariable
	| InternalInputFieldTrigger
	| InternalInputFieldTriggerCollection
	| InternalInputFieldConnectionId
	| InternalInputFieldConnectionCollection
	| InternalInputFieldSurfaceSerial
	| InternalInputFieldPage
	| InternalInputFieldHorizontalAlignment
	| InternalInputFieldVerticalAlignment
	| InternalInputFieldPngImage

export interface CompanionInputFieldStaticTextExtended extends CompanionInputFieldBaseExtended {
	type: 'static-text'

	value: string
	default?: never
}
export interface CompanionInputFieldColorExtended extends CompanionInputFieldBaseExtended {
	type: 'colorpicker'

	default: string | number
	enableAlpha: boolean
	returnType: 'string' | 'number'

	presetColors?: CompanionColorPresetValue[]
}
export interface CompanionInputFieldTextInputExtended extends CompanionInputFieldBaseExtended {
	type: 'textinput'

	default?: string
	minLength?: number

	regex?: string

	useVariables?: CompanionFieldVariablesSupport

	placeholder?: string
	/** A UI hint indicating the field is an expression */
	isExpression?: boolean
	multiline?: boolean
}
export interface CompanionInputFieldDropdownExtended extends CompanionInputFieldBaseExtended {
	type: 'dropdown'
	choices: DropdownChoice[]
	default: DropdownChoiceId
	allowCustom?: boolean
	regex?: string
	minChoicesForSearch?: number
}
export interface CompanionInputFieldMultiDropdownExtended extends CompanionInputFieldBaseExtended {
	type: 'multidropdown'
	/** The possible choices */
	choices: DropdownChoice[]
	/** The default selected values */
	default: DropdownChoiceId[]
	/** The minimum number of entries the dropdown must have before it allows searching */
	minChoicesForSearch?: number
	/** The minimum number of selected values */
	minSelection?: number
	/** The maximum number of selected values */
	maxSelection?: number

	allowCustom?: boolean
	regex?: string
}
export interface CompanionInputFieldNumberExtended extends CompanionInputFieldBaseExtended {
	type: 'number'
	/** The default value */
	default: number
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
}
export interface CompanionInputFieldCheckboxExtended extends CompanionInputFieldBaseExtended {
	type: 'checkbox'
	/** The default value */
	default: boolean
	/** Display as a toggle */
	displayToggle?: boolean
}
export interface CompanionInputFieldCustomVariableExtended extends CompanionInputFieldBaseExtended {
	type: 'custom-variable'
	default?: never // needed to avoid TypeScript errors (all other input fields have default props)
}

export type ExtendedInputField =
	| CompanionInputFieldStaticTextExtended
	| CompanionInputFieldColorExtended
	| CompanionInputFieldTextInputExtended
	| CompanionInputFieldDropdownExtended
	| CompanionInputFieldMultiDropdownExtended
	| CompanionInputFieldNumberExtended
	| CompanionInputFieldCheckboxExtended
	| CompanionInputFieldCustomVariableExtended

export interface CompanionInputFieldBonjourDeviceExtended extends CompanionInputFieldBaseExtended {
	type: 'bonjour-device'
}
export interface CompanionInputFieldSecretExtended extends CompanionInputFieldBaseExtended {
	type: 'secret-text'
	/**
	 * The default text value
	 */
	default?: string
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

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function isExpressionOrValue(input: any): input is ExpressionOrValue<any> {
	return !!input && typeof input === 'object' && 'isExpression' in input && typeof input.isExpression === 'boolean'
}

export function optionsObjectToExpressionOptions(
	options: CompanionOptionValues,
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

export function exprVal<T extends JsonValue>(value: T): ExpressionOrValue<T> {
	return { value: value, isExpression: false }
}
export function exprExpr(value: string): ExpressionOrValue<any> {
	return { value: value, isExpression: true }
}

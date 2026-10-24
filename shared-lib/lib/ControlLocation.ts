import { CompanionFieldVariablesSupport, type CompanionInputFieldTextInputExtended } from './Model/Options.js'

export const ControlLocationOption = {
	type: 'textinput',
	label: 'Location',
	description:
		'eg 1/0/0 or $(this:page)/$(this:row)/$(this:column). "this" can also be used to reference the current control',
	expressionDescription: 'eg `1/0/0`, `${$(this:page) + 1}/${$(this:row)}/${$(this:column)}`, `this`',
	id: 'location',
	default: '$(this:page)/$(this:row)/$(this:column)',
	useVariables: CompanionFieldVariablesSupport.InternalParser,
} as const satisfies CompanionInputFieldTextInputExtended

/**
 * The location of a local variable. Controls without a grid location default to themselves
 */
export const LocalVariableLocationOption = {
	...ControlLocationOption,
	defaultForControlType: {
		trigger: 'this',
		'expression-variable': 'this',
		page: 'this',
	},
} as const satisfies CompanionInputFieldTextInputExtended

export type ThisLocationVariable =
	| 'this:page'
	| 'this:column'
	| 'this:row'
	| 'this:location'
	| 'this:page_name'
	| 'this:active'
	| 'this:step'
	| 'this:step_count'
	| 'this:actions_running'
	| 'this:button_status'

/**
 * The `this:*` variables a button's step progression expression may not reference, as it defines them
 */
export const StepExpressionBlockedVariables: ReadonlySet<string> = new Set<ThisLocationVariable>(['this:step'])

/**
 * The builtin variables that are available for page variables
 */
export type ThisPageVariable = 'this:page' | 'this:page_name'

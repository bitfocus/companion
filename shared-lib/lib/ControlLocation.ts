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
 * The builtin variables that are available for page variables
 */
export type ThisPageVariable = 'this:page' | 'this:page_name'

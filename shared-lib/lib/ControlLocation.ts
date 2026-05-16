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

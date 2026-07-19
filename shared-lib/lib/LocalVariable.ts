import { type CompanionInputFieldTextInputExtended } from './Model/Options.js'

export const LocalVariableNameOption = {
	type: 'textinput',
	label: 'Local variable',
	id: 'name',
	default: '',
} as const satisfies CompanionInputFieldTextInputExtended

export const PageVariableNameOption = {
	type: 'textinput',
	label: 'Page variable',
	id: 'name',
	default: '',
} as const satisfies CompanionInputFieldTextInputExtended

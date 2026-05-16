import { type CompanionInputFieldTextInputExtended } from './Model/Options.js'

export const LocalVariableNameOption = {
	type: 'textinput',
	label: 'Local variable',
	id: 'name',
	default: '',
} as const satisfies CompanionInputFieldTextInputExtended

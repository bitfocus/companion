import { type CompanionInputFieldTextInputExtended } from './Model/Options.js'

/**
 * The characters permitted in a local or page variable name (the portion after the `local:`/`page:`
 * prefix). This is the single source of truth for the rule - the entity-side validity check
 * ({@link EntityInstance.localVariableName}) and the name fields below both derive from it.
 */
const LocalVariableNamePattern = '^[a-zA-Z0-9-_.]+$'
export const LocalVariableNameRegex = new RegExp(LocalVariableNamePattern)

export const LocalVariableNameOption = {
	type: 'textinput',
	label: 'Local variable',
	id: 'name',
	default: '',
	description: 'The name of the local variable. Just the portion after the "local:" prefix.',
	expressionDescription:
		'The name of the local variable. Just the portion after the "local:" prefix. Make sure to wrap it in quotes!',
	regex: `/${LocalVariableNamePattern}/`,
	unwrapPastedVariableNamespace: 'local',
} as const satisfies CompanionInputFieldTextInputExtended

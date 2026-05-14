import type { CompanionInputFieldCheckboxExtended, InternalInputFieldCustomVariable } from './Model/Options.js'

/**
 * Make a customvariable 'safe' according to the valid regex
 * @param name Custom variable to check
 * @returns 'safe' version of the customvariable
 */
export function makeCustomVariableSafe(name: string): string {
	return name.replace(/[^\w]/gi, '_')
}

/**
 * Check if a customvariable is valid
 * @param name Custom variable to check
 */
export function isCustomVariableValid(name: string): boolean {
	if (!name || typeof name !== 'string') return false

	const safeLabel = makeCustomVariableSafe(name)
	return safeLabel === name
}

export const CustomVariableSelectorOption = {
	type: 'internal:custom_variable',
	label: 'Custom variable',
	id: 'name',
	expressionDescription:
		'The name of the custom variable. Just the portion after the "custom:" prefix. Make sure to wrap it in quotes!',
} as const satisfies InternalInputFieldCustomVariable

export const CustomVariableCreateIfNotExistsOption = {
	type: 'checkbox',
	label: 'Create if not exists',
	id: 'create',
	default: false,
	disableAutoExpression: true,
} as const satisfies CompanionInputFieldCheckboxExtended

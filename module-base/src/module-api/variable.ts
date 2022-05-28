/**
 * The definition of a variable
 */
export interface CompanionVariableDefinition {
	variableId: string
	name: string
}

/**
 * A set of values of some variables
 */
export interface CompanionVariableValues {
	[variableId: string]: CompanionVariableValue | undefined
}

/**
 * The value of a variable
 */
export type CompanionVariableValue = string | number | boolean

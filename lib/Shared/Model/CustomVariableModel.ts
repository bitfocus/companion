import type { CompanionVariableValue } from '@companion-module/base'

export interface CustomVariableDefinition {
	description: string
	defaultValue: CompanionVariableValue
	persistCurrentValue: boolean
	sortOrder: number
}

export type CustomVariablesModel = Record<string, CustomVariableDefinition>

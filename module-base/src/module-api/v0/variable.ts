export interface CompanionVariable {
	variableId: string
	name: string
}

export interface CompanionVariableValue2 {
	variableId: string
	value: CompanionVariableValue | undefined
}

export type CompanionVariableValue = string

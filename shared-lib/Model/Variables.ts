export interface VariableDefinition {
	label: string
}

export type ModuleVariableDefinitions = Record<string, VariableDefinition | undefined>

export type AllVariableDefinitions = Record<string, ModuleVariableDefinitions | undefined>

import type { Operation as JsonPatchOperation } from 'fast-json-patch'

export interface VariableDefinition {
	label: string
}

export type ModuleVariableDefinitions = Record<string, VariableDefinition>

export type AllVariableDefinitions = Record<string, ModuleVariableDefinitions | undefined>

export type VariableDefinitionUpdate = VariableDefinitionUpdateSetOp | VariableDefinitionUpdatePatchOp

export interface VariableDefinitionUpdateSetOp {
	type: 'set'

	variables: ModuleVariableDefinitions
}
export interface VariableDefinitionUpdatePatchOp {
	type: 'patch'
	patch: JsonPatchOperation<ModuleVariableDefinitions>[]
}

import type { Operation as JsonPatchOperation } from 'fast-json-patch'

export interface VariableDefinition {
	label: string
}

export type ModuleVariableDefinitions = Record<string, VariableDefinition>

export type AllVariableDefinitions = Record<string, ModuleVariableDefinitions | undefined>

export type VariableDefinitionUpdate =
	| VariableDefinitionUpdateInitOp
	| VariableDefinitionUpdateSetOp
	| VariableDefinitionUpdatePatchOp
	| VariableDefinitionUpdateRemoveOp

export interface VariableDefinitionUpdateInitOp {
	type: 'init'
	variables: AllVariableDefinitions
}
export interface VariableDefinitionUpdateSetOp {
	type: 'set'
	label: string
	variables: ModuleVariableDefinitions
}
export interface VariableDefinitionUpdatePatchOp {
	type: 'patch'
	label: string
	patch: JsonPatchOperation<ModuleVariableDefinitions>[]
}
export interface VariableDefinitionUpdateRemoveOp {
	type: 'remove'
	label: string
}

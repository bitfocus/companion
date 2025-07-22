import type { ObjectsDiff } from './Common.js'

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
export interface VariableDefinitionUpdatePatchOp extends ObjectsDiff<VariableDefinition> {
	type: 'patch'
	label: string
}
export interface VariableDefinitionUpdateRemoveOp {
	type: 'remove'
	label: string
}

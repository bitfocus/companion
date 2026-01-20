import type { JsonValue } from 'type-fest'
import type { ObjectsDiff } from './Common.js'

export interface VariableDefinition {
	name: string
	description: string
}

export type VariableValue = JsonValue | undefined
export type VariableValues = Record<string, VariableValue | undefined>

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

export function stringifyVariableValue(value: VariableValue): string | null | undefined {
	if (typeof value === 'string') {
		return value
	} else if (typeof value === 'number' || typeof value === 'boolean') {
		return value.toString()
	} else {
		return JSON.stringify(value)
	}
}

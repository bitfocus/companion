import type jsonPatch from 'fast-json-patch'
import type { CompanionButtonStyleProps } from '@companion-module/base'
import type { NormalButtonModel } from './ButtonModel.js'
import type { VariableValue, VariableValues } from './Variables.js'

export interface PresetDefinition {
	id: string
	name: string
	type: 'button'
	model: NormalButtonModel
	previewStyle: Partial<CompanionButtonStyleProps> | undefined
}

export interface UIPresetSection {
	id: string
	name: string
	order: number
	description?: string
	definitions: Record<string, UIPresetGroup>
	tags?: string[]
}

export interface UIPresetGroupBase {
	id: string
	name: string
	order: number
	description?: string
	tags?: string[]
}
export interface UIPresetGroupCustom extends UIPresetGroupBase {
	type: 'custom'
	presets: Record<string, UIPresetDefinition>
}
export interface UIPresetGroupMatrix extends UIPresetGroupBase {
	type: 'matrix'

	definition: UIPresetDefinition

	// Matrix for combinations
	matrix: Record<string, VariableValue[]>
	matrixInclude?: VariableValues[]
	matrixExclude?: VariableValues[]
}

export type UIPresetGroup = UIPresetGroupCustom | UIPresetGroupMatrix

export interface UIPresetDefinition {
	id: string
	order: number
	label: string
}

export type UIPresetDefinitionUpdate =
	| UIPresetDefinitionUpdateInit
	| UIPresetDefinitionUpdateAdd
	| UIPresetDefinitionUpdateRemove
	| UIPresetDefinitionUpdatePatch

export interface UIPresetDefinitionUpdateInit {
	type: 'init'
	definitions: Record<string, Record<string, UIPresetSection>>
}
export interface UIPresetDefinitionUpdateAdd {
	type: 'add'
	connectionId: string
	definitions: Record<string, UIPresetSection>
}
export interface UIPresetDefinitionUpdateRemove {
	type: 'remove'
	connectionId: string
}
export interface UIPresetDefinitionUpdatePatch {
	type: 'patch'
	connectionId: string
	patch: jsonPatch.Operation<Record<string, UIPresetSection>>[]
}

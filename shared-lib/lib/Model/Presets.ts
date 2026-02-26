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
	keywords: string[] | undefined
}

export interface UIPresetSection {
	id: string
	name: string
	order: number
	description?: string
	definitions: Record<string, UIPresetGroup>
	keywords?: string[]
}

export interface UIPresetGroupBase {
	id: string
	name: string
	order: number
	description?: string
	keywords?: string[]
}
export interface UIPresetGroupSimple extends UIPresetGroupBase {
	type: 'simple'
	presets: Record<string, UIPresetDefinition>
}
export interface UIPresetGroupTemplate extends UIPresetGroupBase {
	type: 'template'

	definition: UIPresetDefinition

	// Templating
	templateVariableName: string
	templateValues: {
		label: string | null
		value?: VariableValue
	}[]

	commonVariableValues: VariableValues | null
}

export type UIPresetGroup = UIPresetGroupSimple | UIPresetGroupTemplate

export interface UIPresetDefinition {
	id: string
	order: number
	label: string
	keywords?: string[]
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

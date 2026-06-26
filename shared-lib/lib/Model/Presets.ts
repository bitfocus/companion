import type jsonPatch from 'fast-json-patch'
import type { LayeredButtonModel } from './ButtonModel.js'
import type { SomeEntityModel } from './EntityModel.js'
import type { VariableValue, VariableValues } from './Variables.js'

export interface PresetDefinition {
	id: string
	name: string
	type: 'button'
	model: LayeredButtonModel
	presetExtraFeedbacks: SomeEntityModel[]
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

/**
 * The presets for a single connection, as viewed by the ui.
 * Carries connection-level metadata alongside the sections so the ui/backend don't have to look up the
 * module manifest to know what the connection supports.
 */
export interface UIPresetSections {
	/** Whether this connection's module supports being placed as a live preset reference (linked preset) */
	supportsReferences: boolean
	sections: Record<string, UIPresetSection>
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
	definitions: Record<string, UIPresetSections>
}
export interface UIPresetDefinitionUpdateAdd {
	type: 'add'
	connectionId: string
	definitions: UIPresetSections
}
export interface UIPresetDefinitionUpdateRemove {
	type: 'remove'
	connectionId: string
}
export interface UIPresetDefinitionUpdatePatch {
	type: 'patch'
	connectionId: string
	patch: jsonPatch.Operation<UIPresetSections>[]
}

import type { CompanionButtonStyleProps } from '@companion-module/base'
import type { ObjectsDiff } from './Common.js'
import { NormalButtonModel } from './ButtonModel.js'

export type PresetDefinition = PresetDefinitionButton | PresetDefinitionText

export interface PresetDefinitionButton {
	id: string
	name: string
	category: string
	type: 'button'
	model: NormalButtonModel
	previewStyle: Partial<CompanionButtonStyleProps> | undefined
}

export interface PresetDefinitionText {
	id: string
	name: string
	category: string
	type: 'text'
	text: string
}

export type UIPresetDefinition = UIPresetDefinitionButton | UIPresetDefinitionText

export interface UIPresetDefinitionBase {
	id: string
	order: number
	label: string
	category: string
}

export interface UIPresetDefinitionButton extends UIPresetDefinitionBase {
	type: 'button'
}

export interface UIPresetDefinitionText extends UIPresetDefinitionBase {
	type: 'text'
	text: string
}

export type UIPresetDefinitionUpdate =
	| UIPresetDefinitionUpdateInit
	| UIPresetDefinitionUpdateAdd
	| UIPresetDefinitionUpdateRemove
	| UIPresetDefinitionUpdatePatch

export interface UIPresetDefinitionUpdateInit {
	type: 'init'
	definitions: Record<string, Record<string, UIPresetDefinition>>
}
export interface UIPresetDefinitionUpdateAdd {
	type: 'add'
	connectionId: string
	definitions: Record<string, UIPresetDefinition>
}
export interface UIPresetDefinitionUpdateRemove {
	type: 'remove'
	connectionId: string
}
export interface UIPresetDefinitionUpdatePatch extends ObjectsDiff<UIPresetDefinition> {
	type: 'patch'
	connectionId: string
}

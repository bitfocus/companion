import type {
	CompanionButtonPresetOptions,
	CompanionButtonStyleProps,
	CompanionOptionValues,
} from '@companion-module/base'
import type { ActionStepOptions } from './ActionModel.js'
import type { Operation as JsonPatchOperation } from 'fast-json-patch'

export interface PresetFeedbackInstance {
	type: string
	options: CompanionOptionValues
	style: Partial<CompanionButtonStyleProps> | undefined
	isInverted?: boolean
	headline?: string
}

export interface PresetActionInstance {
	action: string
	options: CompanionOptionValues
	delay: number
	headline?: string
}

export interface PresetActionSets {
	down: PresetActionInstance[]
	up: PresetActionInstance[]
	[delay: number]: PresetActionInstance[]
}

export interface PresetActionSteps {
	options?: ActionStepOptions
	action_sets: PresetActionSets
}

export type PresetDefinition = PresetDefinitionButton | PresetDefinitionText

export interface PresetDefinitionButton {
	id: string
	name: string
	category: string
	type: 'button'
	style: CompanionButtonStyleProps
	previewStyle: CompanionButtonStyleProps | undefined
	options: CompanionButtonPresetOptions | undefined
	feedbacks: PresetFeedbackInstance[]
	steps: PresetActionSteps[]
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
export interface UIPresetDefinitionUpdatePatch {
	type: 'patch'
	connectionId: string
	patch: JsonPatchOperation<Record<string, UIPresetDefinition>>[]
}

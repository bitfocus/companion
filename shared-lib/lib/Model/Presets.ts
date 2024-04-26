import type {
	CompanionButtonPresetOptions,
	CompanionButtonStyleProps,
	CompanionOptionValues,
} from '@companion-module/base'
import { ActionStepOptions } from './ActionModel.js'

export interface PresetFeedbackInstance {
	type: string
	options: CompanionOptionValues
	style: Partial<CompanionButtonStyleProps> | undefined
	isInverted?: boolean
}

export interface PresetActionInstance {
	action: string
	options: CompanionOptionValues
	delay: number
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

export interface UIPresetDefinitionButton {
	id: string
	label: string
	category: string
	type: 'button'
}

export interface UIPresetDefinitionText {
	id: string
	label: string
	category: string
	type: 'text'
	text: string
}

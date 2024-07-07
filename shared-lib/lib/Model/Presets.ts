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

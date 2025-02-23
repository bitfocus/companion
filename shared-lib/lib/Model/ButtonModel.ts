import type { ActionSetsModel, ActionStepOptions } from './ActionModel.js'
import { SomeEntityModel } from './EntityModel.js'
import type { ButtonStyleProperties } from './StyleModel.js'

export type SomeButtonModel = PageNumberButtonModel | PageUpButtonModel | PageDownButtonModel | NormalButtonModel

export interface PageNumberButtonModel {
	readonly type: 'pagenum'
}
export interface PageUpButtonModel {
	readonly type: 'pageup'
}

export interface PageDownButtonModel {
	readonly type: 'pagedown'
}

export interface NormalButtonModel {
	readonly type: 'button'

	options: NormalButtonOptions

	style: ButtonStyleProperties

	feedbacks: SomeEntityModel[]

	steps: NormalButtonSteps

	localVariables: Record<string, LocalVariableDefinition>
}

export type NormalButtonSteps = Record<
	string,
	{
		action_sets: ActionSetsModel
		options: ActionStepOptions
	}
>

export interface ButtonOptionsBase {}

export interface NormalButtonOptions extends ButtonOptionsBase {
	rotaryActions: boolean
	stepAutoProgress: boolean
}

export type ButtonStatus = 'good' | 'warning' | 'error'

export interface LocalVariableDefinition {
	description: string
	// defaultValue: CompanionVariableValue
	// persistCurrentValue: boolean
	sortOrder: number
}

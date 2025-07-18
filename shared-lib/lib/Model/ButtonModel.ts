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

export interface ButtonModelBase {
	feedbacks: SomeEntityModel[]

	steps: NormalButtonSteps

	localVariables: SomeEntityModel[]
}

export interface NormalButtonModel extends ButtonModelBase {
	readonly type: 'button'

	options: NormalButtonOptions

	style: ButtonStyleProperties
}

export interface PresetButtonModel extends ButtonModelBase {
	readonly type: 'preset:button'

	options: NormalButtonOptions

	style: ButtonStyleProperties
}

export type NormalButtonSteps = Record<
	string,
	{
		action_sets: ActionSetsModel
		options: ActionStepOptions
	}
>

export interface ButtonOptionsBase {
	stepProgression: 'auto' | 'manual' | 'expression'
	stepExpression?: string
}

export interface NormalButtonOptions extends ButtonOptionsBase {
	rotaryActions: boolean
}

export type ButtonStatus = 'good' | 'warning' | 'error'

export interface NormalButtonRuntimeProps {
	current_step_id: string
}

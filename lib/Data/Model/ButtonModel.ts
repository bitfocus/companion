import type { ActionSetsModel, ActionStepOptions } from '../../Shared/Model/ActionModel.js'
import type { FeedbackInstance } from '../../Shared/Model/FeedbackModel.js'
import type { ButtonStyleProperties } from '../../Shared/Model/StyleModel.js'

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

	feedbacks: FeedbackInstance[]

	steps: NormalButtonSteps
}

export type NormalButtonSteps = Record<
	string,
	{
		action_sets: ActionSetsModel
		options: ActionStepOptions
	}
>

export interface ButtonOptionsBase {
	relativeDelay: boolean
}

export interface NormalButtonOptions extends ButtonOptionsBase {
	rotaryActions: boolean
	stepAutoProgress: boolean
}

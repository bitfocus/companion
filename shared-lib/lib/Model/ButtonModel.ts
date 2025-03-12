import type { ActionSetsModel, ActionStepOptions } from './ActionModel.js'
import type { SomeEntityModel } from './EntityModel.js'
import type { SomeButtonGraphicsElement } from './StyleLayersModel.js'
import type { ButtonStyleProperties } from './StyleModel.js'

export type SomeButtonModel =
	| PageNumberButtonModel
	| PageUpButtonModel
	| PageDownButtonModel
	| NormalButtonModel
	| LayeredButtonModel

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

export interface LayeredButtonModel extends ButtonModelBase {
	readonly type: 'button-layered'

	options: NormalButtonOptions

	style: {
		layers: SomeButtonGraphicsElement[]
	}
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

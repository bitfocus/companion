import type { ActionSetsModel, ActionStepOptions } from './ActionModel.js'
import type { SomeEntityModel } from './EntityModel.js'
import type { SomeButtonGraphicsElement } from './StyleLayersModel.js'

export type SomeButtonModel = PageNumberButtonModel | PageUpButtonModel | PageDownButtonModel | LayeredButtonModel

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

export interface PresetButtonModel extends ButtonModelBase {
	readonly type: 'preset:button'

	options: LayeredButtonOptions

	style: {
		layers: SomeButtonGraphicsElement[]
	}
}

export interface LayeredButtonModel extends ButtonModelBase {
	readonly type: 'button-layered'

	options: LayeredButtonOptions

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

export type ButtonOptionsBase = {
	stepProgression: 'auto' | 'manual' | 'expression'
	stepExpression?: string
}

export type LayeredButtonOptions = ButtonOptionsBase & {
	rotaryActions: boolean
	canModifyStyleInApis: boolean
}

export type ButtonStatus = 'good' | 'warning' | 'error'

export interface NormalButtonRuntimeProps {
	current_step_id: string
}

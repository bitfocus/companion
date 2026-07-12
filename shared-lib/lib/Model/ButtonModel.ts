import type { ActionSetsModel, ActionStepOptions } from './ActionModel.js'
import type { SomeEntityModel } from './EntityModel.js'
import type { SomeButtonGraphicsElement } from './StyleLayersModel.js'
import type { VariableValues } from './Variables.js'

export type SomeButtonModel =
	PageNumberButtonModel | PageUpButtonModel | PageDownButtonModel | LayeredButtonModel | PresetReferenceButtonModel

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

/**
 * A button that references a preset from a connection.
 * It keeps a cached copy of the resolved button data (the same fields as a layered button) so it keeps
 * running in its 'last known' state if the source preset disappears or the connection stops, and refreshes
 * that cache when the source preset definition updates.
 */
export interface PresetReferenceButtonModel extends ButtonModelBase {
	readonly type: 'preset-reference'

	options: LayeredButtonOptions

	style: {
		layers: SomeButtonGraphicsElement[]
	}

	/**
	 * The reference to the source preset, and the user-editable templated variable overrides.
	 * The keys of `variableValues` match `localVariable.variableName` of the templated local variables and
	 * are the only fields the user is allowed to edit on a placed reference.
	 */
	presetRef: {
		connectionId: string
		/**
		 * The module-id of the source connection. Kept up to date with the referenced connection, so the user
		 * can switch the reference to another connection of the same module (and so import can re-link).
		 */
		moduleId: string
		presetId: string
		variableValues: VariableValues | null
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
	notes?: string
}

export type ButtonStatus = 'good' | 'warning' | 'error'

export interface NormalButtonRuntimeProps {
	current_step_id: string
}

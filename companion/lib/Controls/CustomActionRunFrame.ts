import type { VariableValue, VariableValues } from '@companion-app/shared/Model/Variables.js'
import type { ControlEntityInstance } from './Entities/EntityInstance.js'

/**
 * The maximum depth of custom actions calling custom actions, to stop a custom action from recursing forever
 */
export const MAX_CUSTOM_ACTION_DEPTH = 16

/**
 * The values seen by the entities of a custom action: its inputs, and the values its local variables have been set to
 */
export interface CustomActionValues {
	/** The control id of the custom action */
	readonly customActionControlId: string
	/** The values of the inputs of the custom action, exposed to its entities as `$(options:<id>)` */
	readonly options: VariableValues
	/**
	 * The values of the local variables which have been set, by name (without the `local:` prefix).
	 * A variable which has not been set has its startup value
	 */
	readonly localValues: Map<string, VariableValue>
}

/**
 * The state of one run of a custom action.
 * Every run has its own frame, so that concurrent runs of the same custom action can't interfere with each other.
 */
export interface CustomActionRunFrame extends CustomActionValues {
	/** Get the local variables of the run */
	readonly getLocalVariableEntities: () => ControlEntityInstance[]
	/** Inform the run that one of its local variables has been set or reset */
	readonly localValueChanged: (name: string) => void
}

/**
 * Build the `$(options:*)` variables for a run of a custom action
 */
export function buildCustomActionOptionsVariables(options: VariableValues): VariableValues {
	const values: VariableValues = {}
	for (const [id, value] of Object.entries(options)) {
		values[`options:${id}`] = value
	}
	return values
}

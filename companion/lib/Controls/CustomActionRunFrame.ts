import type { VariableValue, VariableValues } from '@companion-app/shared/Model/Variables.js'

/**
 * The maximum depth of custom actions calling custom actions, to stop a custom action from recursing forever
 */
export const MAX_CUSTOM_ACTION_DEPTH = 16

/**
 * The state of one run of a custom action.
 * Every run has its own frame, so that concurrent runs of the same custom action can't interfere with each other.
 */
export interface CustomActionRunFrame {
	/** The control id of the custom action being run */
	readonly customActionControlId: string
	/** The values of the inputs of the custom action, exposed to its actions as `$(options:<id>)` */
	readonly options: VariableValues
	/**
	 * The values of the local variables which have been set during this run, by name (without the `local:` prefix).
	 * A variable which has not been set during the run has its startup value
	 */
	readonly localValues: Map<string, VariableValue>
	/** How many custom actions deep this run is. A custom action run directly from a control is at depth 1 */
	readonly depth: number
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

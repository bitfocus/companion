import type { VariableValues } from '@companion-app/shared/Model/Variables.js'
import type { SomeControl } from './IControlFragments.js'
import type { VariablesAndExpressionParser } from '../Variables/VariablesAndExpressionParser.js'
import type { NewFeedbackValue } from './Entities/Types.js'

/**
 * Narrow interface for the controls data layer.
 * Covers the map-level read/write operations and input dispatch that don't
 * require any knowledge of instance, internal module, or other higher-level
 * controllers.
 */
export interface IControlStore {
	/**
	 * Get a single control by id
	 */
	getControl(controlId: string): SomeControl<any> | undefined

	/**
	 * Get all populated controls
	 */
	getAllControls(): ReadonlyMap<string, SomeControl<any>>

	/**
	 * Remove any tracked state for a connection across all controls
	 */
	forgetConnection(connectionId: string): void

	/**
	 * Update all controls to rename variables from one label to another
	 */
	renameVariables(labelFrom: string, labelTo: string): void

	/**
	 * Dispatch a press/release event to a control
	 */
	pressControl(controlId: string, pressed: boolean, surfaceId: string | undefined, force?: boolean): boolean

	/**
	 * Dispatch a rotate event to a control
	 */
	rotateControl(controlId: string, rightward: boolean, surfaceId: string | undefined): boolean

	/**
	 * Abort all delayed actions, optionally keeping one exception signal alive
	 */
	abortAllDelayedActions(exceptSignal: AbortSignal | null): void

	createVariablesAndExpressionParser(
		controlId: string | null | undefined,
		overrideVariableValues: VariableValues | null
	): VariablesAndExpressionParser

	/**
	 * Clear any state tracked by controls for a connection (e.g. feedback values)
	 */
	clearConnectionState(connectionId: string): void

	/**
	 * Update feedback values from a connection
	 */
	updateFeedbackValues(connectionId: string, result: NewFeedbackValue[]): void
}

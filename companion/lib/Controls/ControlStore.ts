import { ActionRecorder } from './ActionRecorder.js'
import { TriggerEvents } from './TriggerEvents.js'
import type { IControlStore } from './IControlStore.js'
import type { SomeControl } from './IControlFragments.js'
import type { VariableValues } from '@companion-app/shared/Model/Variables.js'
import type { VariablesAndExpressionParser } from '../Variables/VariablesAndExpressionParser.js'
import type { NewFeedbackValue } from './Entities/Types.js'
import type { VariablesValues } from '../Variables/Values.js'
import type { Registry } from '../Registry.js'

/**
 * The data-layer implementation of IControlStore.
 * Owns the controls map, the action recorder, and the trigger event bus.
 * Instantiated by Registry before ControlsController so it can be injected
 * into any consumer that only needs the narrow IControlStore interface.
 */
export class ControlStore implements IControlStore {
	/**
	 * The currently configured controls.
	 * Intentionally public so that ControlsController can mutate it.
	 */
	readonly controls = new Map<string, SomeControl<any>>()

	/**
	 * Actions recorder
	 */
	readonly actionRecorder: ActionRecorder

	/**
	 * Triggers event bus
	 */
	readonly triggers: TriggerEvents

	readonly #variablesValues: VariablesValues

	constructor(registry: Pick<Registry, 'instance' | 'variables'>) {
		this.triggers = new TriggerEvents()
		this.actionRecorder = new ActionRecorder(registry, this)
		this.#variablesValues = registry.variables.values
	}

	/**
	 * Get a single control by id
	 */
	getControl(controlId: string): SomeControl<any> | undefined {
		if (!controlId) return undefined
		return this.controls.get(controlId)
	}

	/**
	 * Get all populated controls
	 */
	getAllControls(): ReadonlyMap<string, SomeControl<any>> {
		return this.controls // TODO - readonly?
	}

	/**
	 * Remove any tracked state for a connection across all controls
	 */
	forgetConnection(connectionId: string): void {
		for (const control of this.controls.values()) {
			if (control.supportsEntities) {
				control.entities.forgetConnection(connectionId)
			}
		}
	}

	/**
	 * Rename a connection for variables used in the controls
	 * @param labelFrom - the old connection short name
	 * @param labelTo - the new connection short name
	 */
	renameVariables(labelFrom: string, labelTo: string): void {
		for (const control of this.controls.values()) {
			control.renameVariables(labelFrom, labelTo)
		}
	}

	/**
	 * Execute a press of a control
	 * @param controlId Id of the control
	 * @param pressed Whether the control is pressed
	 * @param surfaceId The surface that initiated this press
	 * @param force Trigger actions even if already in the state
	 */
	pressControl(controlId: string, pressed: boolean, surfaceId: string | undefined, force?: boolean): boolean {
		const control = this.getControl(controlId)
		if (control) {
			this.triggers.emit('control_press', controlId, pressed, surfaceId)

			control.pressControl(pressed, surfaceId, force)

			return true
		}

		return false
	}

	/**
	 * Execute rotation of a control
	 * @param controlId Id of the control
	 * @param rightward Whether the control is rotated to the right
	 * @param surfaceId The surface that initiated this rotate
	 */
	rotateControl(controlId: string, rightward: boolean, surfaceId: string | undefined): boolean {
		const control = this.getControl(controlId)
		if (control && control.supportsActionSets) {
			control.rotateControl(rightward, surfaceId)
			return true
		}

		return false
	}

	/**
	 * Abort all delayed actions across all controls
	 */
	abortAllDelayedActions(exceptSignal: AbortSignal | null): void {
		for (const control of this.controls.values()) {
			if (control.supportsActions) {
				control.abortDelayedActions(false, exceptSignal)
			}
		}
	}

	/**
	 * Clear any state tracked by controls for a connection (e.g. feedback values)
	 */
	clearConnectionState(connectionId: string): void {
		for (const control of this.controls.values()) {
			if (control.supportsEntities) {
				control.entities.clearConnectionState(connectionId)
			}
		}
	}

	/**
	 * Update feedback values from a connection
	 */
	updateFeedbackValues(connectionId: string, result: NewFeedbackValue[]): void {
		if (result.length === 0) return

		const values = new Map<string, Map<string, NewFeedbackValue>>()

		for (const item of result) {
			const mapEntry = values.get(item.controlId) || new Map<string, NewFeedbackValue>()
			mapEntry.set(item.entityId, item)
			values.set(item.controlId, mapEntry)
		}

		// Pass values to controls
		for (const [controlId, newValues] of values) {
			const control = this.getControl(controlId)
			if (control && control.supportsEntities) {
				control.entities.updateFeedbackValues(connectionId, newValues)
			}
		}
	}

	createVariablesAndExpressionParser(
		controlId: string | null | undefined,
		overrideVariableValues: VariableValues | null
	): VariablesAndExpressionParser {
		const control = controlId && this.getControl(controlId)

		// If the control exists and supports entities, use its parser for local variables
		if (control && control.supportsEntities)
			return control.entities.createVariablesAndExpressionParser(overrideVariableValues)

		// Otherwise create a generic one
		return this.#variablesValues.createVariablesAndExpressionParser(null, null, overrideVariableValues)
	}
}

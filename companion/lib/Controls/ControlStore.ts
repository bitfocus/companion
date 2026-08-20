import { CreatePageControlId } from '@companion-app/shared/ControlId.js'
import type { SomeControlModel } from '@companion-app/shared/Model/Controls.js'
import type { VariableValues } from '@companion-app/shared/Model/Variables.js'
import type { DataDatabase } from '../Data/Database.js'
import type { DataStoreTableView } from '../Data/StoreBase.js'
import type { IPageStore } from '../Page/Store.js'
import type { VariablesValues } from '../Variables/Values.js'
import type {
	ExpressionParserOptions,
	VariablesAndExpressionParser,
} from '../Variables/VariablesAndExpressionParser.js'
import type { ControlEntityInstance } from './Entities/EntityInstance.js'
import type { NewFeedbackValue } from './Entities/Types.js'
import type { SomeControl } from './IControlFragments.js'
import type { IControlStore } from './IControlStore.js'
import { TriggerEvents } from './TriggerEvents.js'

/**
 * The data-layer implementation of IControlStore.
 * Owns the controls map, and the trigger event bus.
 */
export class ControlStore implements IControlStore {
	readonly dbTable: DataStoreTableView<Record<string, SomeControlModel>>

	/**
	 * The currently configured controls.
	 * Intentionally public so that ControlsController can mutate it.
	 */
	readonly controls = new Map<string, SomeControl<any>>()

	/**
	 * Triggers event bus
	 */
	readonly triggerEvents: TriggerEvents

	readonly #variablesValues: VariablesValues
	readonly #pageStore: IPageStore

	constructor(db: DataDatabase, variablesValues: VariablesValues, pageStore: IPageStore) {
		this.triggerEvents = new TriggerEvents()
		this.#variablesValues = variablesValues
		this.#pageStore = pageStore

		this.dbTable = db.getTableView('controls')
	}

	/**
	 * Internal: Delete a control by id. Does not emit any events or perform any checks, as this is only used internally by the ControlsController which handles those aspects.
	 * @param controlId Id of the control to delete
	 */
	deleteControl(controlId: string): void {
		this.controls.delete(controlId)

		this.dbTable.delete(controlId)
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
			this.triggerEvents.emit('control_press', controlId, pressed, surfaceId)

			control.pressControl(pressed, surfaceId, force)

			return true
		}

		return false
	}

	/**
	 * Execute rotation of a control
	 * @param controlId Id of the control
	 * @param delta Signed rotation amount - sign is the direction, magnitude is the number of steps
	 * @param surfaceId The surface that initiated this rotate
	 */
	rotateControl(controlId: string, delta: number, surfaceId: string | undefined): boolean {
		// A zero or non-finite delta is not a meaningful rotation. Reject it here so no producer can
		// accidentally run the `rotate_left` set (chosen when `delta > 0` is false) for a zero delta.
		if (!Number.isFinite(delta) || delta === 0) return false

		return this.getControl(controlId)?.rotateControl(delta, surfaceId) ?? false
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
		overrideVariableValues: VariableValues | null,
		options?: ExpressionParserOptions
	): VariablesAndExpressionParser {
		const control = controlId && this.getControl(controlId)

		// If the control exists and supports entities, use its parser for local variables
		if (control && control.supportsEntities)
			return control.entities.createVariablesAndExpressionParser(overrideVariableValues, options)

		// Generic parser, but with the control's grid location so `$(this:page)` and the page's
		// `$(page:x)` variables resolve for located non-entity controls (e.g. button-reference)
		const location = controlId ? this.#pageStore.getLocationOfControlId(controlId) : null
		return this.#variablesValues.createVariablesAndExpressionParser(
			location,
			null,
			overrideVariableValues,
			location ? this.getPageVariableEntities(location.pageNumber) : null,
			options
		)
	}

	/** Resolve a page's local-variable entities (its `page:<pageId>` control), for `$(page:x)` injection. */
	getPageVariableEntities(pageNumber: number): ControlEntityInstance[] | null {
		const pageId = this.#pageStore.getPageId(pageNumber)
		if (!pageId) return null

		const control = this.getControl(CreatePageControlId(pageId))
		if (!control || !control.supportsEntities) return null

		return control.entities.getLocalVariableEntities()
	}
}

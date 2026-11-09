import { EventEmitter } from 'node:events'
import { type BankControlId, type SomeControlId } from '@companion-app/shared/ControlId.js'
import { diffObject, type ObjectPatch } from '@companion-app/shared/Diff.js'
import type { PresetButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import type {
	SomeControlModel,
	SomeControlRuntimeProps,
	UIControlUpdateDestroy,
} from '@companion-app/shared/Model/Controls.js'
import LogController, { type Logger } from '../Log/Controller.js'
import type { ButtonPressEvents } from './ButtonPressEvents.js'
import type { ControlDependencies } from './ControlDependencies.js'
import type { IButtonDrawer } from './IButtonDrawer.js'

/** A change to a control, for the ui to apply to the config and runtime props it was sent */
export type ControlUpdate<TJson, TRuntime> =
	| { type: 'config'; patch: ObjectPatch<TJson> }
	| { type: 'runtime'; patch: ObjectPatch<TRuntime> }
	| UIControlUpdateDestroy

export type ControlUpdateEvents = {
	update: [change: ControlUpdate<SomeControlJson, SomeControlRuntimeProps>]
}

/**
 * Abstract class for a control.
 *
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 3.0.0
 * @copyright 2022 Bitfocus AS
 * @license
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for Companion along with
 * this program.
 */
/** The config of any control. A preset is the one control whose config is not a {@link SomeControlModel} */
export type SomeControlJson = SomeControlModel | PresetButtonModel

export abstract class ControlBase<
	TControlId extends SomeControlId,
	TJson extends SomeControlJson,
	TRuntime extends SomeControlRuntimeProps,
> {
	abstract readonly type: string

	protected readonly logger: Logger
	protected readonly deps: ControlDependencies

	/**
	 * The last sent config json object
	 */
	#lastSentConfigJson: TJson | undefined
	/**
	 * The last sent runtime json object
	 */
	#lastSentRuntimeJson: TRuntime | undefined

	/**
	 * Check the status of a control, and re-draw if needed
	 * @returns whether the status changed
	 */
	checkButtonStatus: ((redraw?: boolean) => boolean) | undefined

	readonly controlId: TControlId

	readonly updateEvents = new EventEmitter<ControlUpdateEvents>()

	/** If true, the control will not be persisted */
	#noPersistence: boolean

	constructor(deps: ControlDependencies, controlId: TControlId, debugNamespace: string, noPersistence = false) {
		this.logger = LogController.createLogger(debugNamespace)
		this.deps = deps
		this.controlId = controlId
		this.updateEvents.setMaxListeners(0)
		this.#noPersistence = noPersistence
	}

	/**
	 * Post-process a change to this control
	 * This includes, redrawing, writing to the db and informing any interested clients
	 * @param redraw - whether to redraw the control
	 */
	commitChange(redraw = true): void {
		// Check if the status has changed
		if (typeof this.checkButtonStatus === 'function' && this.checkButtonStatus(false)) redraw = true

		// Trigger redraw
		if (redraw) this.triggerInvalidation()

		const newJson = structuredClone(this.toJSON())

		// Save to db
		// A preset is never persisted, and is the one control whose config is not a SomeControlModel
		if (!this.#noPersistence && newJson.type !== 'preset:button') this.deps.dbTable.set(this.controlId, newJson)

		// Now broadcast to any interested clients
		if (this.updateEvents.listenerCount('update') > 0) {
			const patch = diffObject(this.#lastSentConfigJson, newJson)
			if (patch.length > 0) {
				this.updateEvents.emit('update', { type: 'config', patch })
			}
		}

		this.#lastSentConfigJson = newJson
	}

	/**
	 * Prepare this control for deletion, this should be extended by controls.
	 * Immediately after this is called, it will be removed from the store, and assumed to be fully deleted
	 */
	destroy(): void {
		// Stop tracking anything that read variables for this control, in case an owner missed disposing it
		this.deps.variableDependencies.disposeControl(this.controlId)

		// Inform clients
		this.updateEvents.emit('update', { type: 'destroy' })
	}

	/**
	 * Collect the instance ids, labels, and variables referenced by this control
	 * @param foundConnectionIds - instance ids being referenced
	 * @param foundConnectionLabels - instance labels being referenced
	 * @param foundVariables - variables being referenced
	 */
	abstract collectReferencedConnectionsAndVariables(
		foundConnectionIds: Set<string>,
		foundConnectionLabels: Set<string>,
		foundVariables: Set<string>
	): void

	/**
	 * Inform the control that it has been moved, and anything relying on its location must be invalidated
	 */
	abstract triggerLocationHasChanged(): void

	/**
	 * The drawing surface for controls that render to a button, or `null` for controls that don't draw.
	 */
	abstract get drawing(): IButtonDrawer | null

	/**
	 * Emit a change to the runtime properties of this control.
	 * This is for any properties that the ui may want about this control which are not persisted in toJSON()
	 * This is done via this.toRuntimeJSON()
	 */
	protected sendRuntimePropsChange(): void {
		const newJson = structuredClone(this.toRuntimeJSON())

		// Now broadcast to any interested clients
		if (this.updateEvents.listenerCount('update') > 0) {
			const patch = diffObject(this.#lastSentRuntimeJson, newJson)
			if (patch.length > 0) {
				this.updateEvents.emit('update', { type: 'runtime', patch })
			}
		}

		this.#lastSentRuntimeJson = newJson
	}

	/**
	 * Convert this control to JSON
	 * To be sent to the client and written to the db
	 * @param clone - Whether to return a cloned object
	 */
	abstract toJSON(): TJson

	/**
	 * Get any volatile properties for the control, which the ui may want but are not persisted in toJSON()
	 */
	abstract toRuntimeJSON(): TRuntime

	/**
	 * React to a change to this control - invalidate the rendered graphic, re-check a trigger condition, etc.
	 * Abstract with no default on purpose, so a new control type must decide how it reacts rather than
	 * silently inheriting drawing behaviour.
	 */
	protected abstract triggerInvalidation(): void

	/**
	 * Rename an instance for variables used in the controls
	 * @param labelFrom - the old instance short name
	 * @param labelTo - the new instance short name
	 */
	abstract renameVariables(labelFrom: string, labelTo: string): void

	/**
	 * Execute a press of a control
	 * @param pressed Whether the control is pressed
	 * @param surfaceId The surface that initiated this press
	 * @param pressEvents Control events for a physical press, or null for any other press
	 * @param force Trigger actions even if already in the state
	 */
	abstract pressControl(
		pressed: boolean,
		surfaceId: string | undefined,
		pressEvents: ButtonPressEvents | null,
		force?: boolean
	): void

	/**
	 * Execute a rotate of this control. Controls that don't support rotation (the default) do nothing and report
	 * that they didn't handle it.
	 * @param delta Signed rotation amount - sign is the direction, magnitude is the number of steps
	 * @param surfaceId The surface that initiated this rotate
	 */
	rotateControl(_delta: number, _surfaceId: string | undefined): boolean {
		return false
	}

	/**
	 * Abort the in progress action runs of this control. A remote button forwards it to the button it shows. Controls
	 * that run no actions (the default) have nothing to abort
	 * @param skip_up Mark the button as released
	 * @param exceptSignal A run to leave running
	 * @param linkHops How many installations the abort has come through over Link, so that a loop of remote buttons ends
	 */
	abortDelayedActions(_skip_up: boolean, _exceptSignal: AbortSignal | null, _linkHops: number): void {
		// Nothing to do
	}

	/**
	 * The control id this control currently forwards to, for controls that mirror another (button-reference).
	 * Controls that don't (the default) return null.
	 */
	getReferenceTargetControlId(): BankControlId | null {
		return null
	}
}

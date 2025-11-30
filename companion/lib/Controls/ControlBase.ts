import jsonPatch from 'fast-json-patch'
import debounceFn from 'debounce-fn'
import type { DrawStyleModel } from '@companion-app/shared/Model/StyleModel.js'
import LogController, { type Logger } from '../Log/Controller.js'
import type { ControlDependencies } from './ControlDependencies.js'
import { EventEmitter } from 'node:events'
import type { UIControlUpdate } from '@companion-app/shared/Model/Controls.js'

export type ControlUpdateEvents = {
	update: [change: UIControlUpdate]
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
export abstract class ControlBase<TJson> {
	abstract readonly type: string

	protected readonly logger: Logger
	protected readonly deps: ControlDependencies

	/**
	 * The last sent config json object
	 */
	#lastSentConfigJson: TJson | null = null
	/**
	 * The last sent runtime json object
	 */
	#lastSentRuntimeJson: Record<string, any> | null = null

	/**
	 * Check the status of a control, and re-draw if needed
	 * @returns whether the status changed
	 */
	checkButtonStatus: ((redraw?: boolean) => boolean) | undefined

	readonly controlId: string

	readonly updateEvents = new EventEmitter<ControlUpdateEvents>()

	/** If true, the control will not be persisted */
	#noPersistence: boolean

	constructor(deps: ControlDependencies, controlId: string, debugNamespace: string, noPersistence = false) {
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
		if (redraw) this.triggerRedraw()

		const newJson = this.toJSON(true)

		// Save to db
		if (!this.#noPersistence) this.deps.dbTable.set(this.controlId, newJson as any)

		// Now broadcast to any interested clients
		if (this.updateEvents.listenerCount('update') > 0) {
			const patch = jsonPatch.compare<any>(this.#lastSentConfigJson || {}, newJson || {})
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
	 * Get the size of the bitmap render of this control
	 */
	abstract getBitmapSize(): { width: number; height: number } | null

	/**
	 * Get the complete style object of a button
	 * @returns the processed style of the button
	 */
	getDrawStyle(): DrawStyleModel | null {
		return null
	}

	/**
	 * Emit a change to the runtime properties of this control.
	 * This is for any properties that the ui may want about this control which are not persisted in toJSON()
	 * This is done via this.toRuntimeJSON()
	 */
	protected sendRuntimePropsChange(): void {
		const newJson = structuredClone(this.toRuntimeJSON())

		// Now broadcast to any interested clients
		if (this.updateEvents.listenerCount('update') > 0) {
			const patch = jsonPatch.compare(this.#lastSentRuntimeJson || {}, newJson || {})
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
	abstract toJSON(clone: boolean): TJson

	/**
	 * Get any volatile properties for the control
	 * Not all controls have additional data
	 */
	toRuntimeJSON(): Record<string, any> {
		return {}
	}

	/**
	 * Trigger a redraw of this control, if it can be drawn
	 */
	triggerRedraw = debounceFn(
		() => {
			// This is a hacky way of ensuring we don't schedule two invalidations in short succession when doing lots of work
			// Long term this should be replaced with a proper work queue inside GraphicsController
			if (this.#pendingDraw) return

			this.#pendingDraw = true
			setImmediate(() => {
				this.deps.events.emit('invalidateControlRender', this.controlId)
				this.#pendingDraw = false
			})
		},
		{
			before: false,
			after: true,
			wait: 10,
			maxWait: 20,
		}
	)
	#pendingDraw = false

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
	 * @param force Trigger actions even if already in the state
	 */
	abstract pressControl(pressed: boolean, surfaceId: string | undefined, force?: boolean): void
}

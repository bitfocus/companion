import { cloneDeep } from 'lodash-es'
import { CoreBase } from '../Core/Base.js'
import jsonPatch from 'fast-json-patch'
import debounceFn from 'debounce-fn'
import type { Registry } from '../Registry.js'
import { DrawStyleModel } from '@companion-app/shared/Model/StyleModel.js'

/**
 * Get Socket.io room to use for changes to a control config
 */
export function ControlConfigRoom(controlId: string): string {
	return `controls:${controlId}`
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
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 */
export abstract class ControlBase<TJson> extends CoreBase {
	abstract readonly type: string

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

	constructor(registry: Registry, controlId: string, debugNamespace: string) {
		super(registry, debugNamespace)

		this.controlId = controlId
	}

	/**
	 * Post-process a change to this control
	 * This includes, redrawing, writing to the db and informing any interested clients
	 * @param redraw - whether to redraw the control
	 */
	commitChange(redraw = true) {
		// Check if the status has changed
		if (typeof this.checkButtonStatus === 'function' && this.checkButtonStatus(false)) redraw = true

		// Trigger redraw
		if (redraw) this.triggerRedraw()

		const newJson = this.toJSON(true)

		// Save to db
		this.db.setTableKey('controls', this.controlId, newJson as any)

		// Now broadcast to any interested clients
		const roomName = ControlConfigRoom(this.controlId)

		if (this.io.countRoomMembers(roomName) > 0) {
			const patch = jsonPatch.compare(this.#lastSentConfigJson || {}, newJson || {})
			if (patch.length > 0) {
				this.io.emitToRoom(roomName, `controls:config-${this.controlId}`, patch)
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
		const roomName = ControlConfigRoom(this.controlId)
		if (this.io.countRoomMembers(roomName) > 0) {
			this.io.emitToRoom(roomName, `controls:config-${this.controlId}`, false)
			this.io.emitToRoom(roomName, `controls:runtime-${this.controlId}`, false)
		}
	}

	/**
	 * Collect the instance ids and labels referenced by this control
	 * @param foundConnectionIds - instance ids being referenced
	 * @param foundConnectionLabels - instance labels being referenced
	 */
	abstract collectReferencedConnections(foundConnectionIds: Set<string>, foundConnectionLabels: Set<string>): void

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
		const newJson = cloneDeep(this.toRuntimeJSON())

		// Now broadcast to any interested clients
		const roomName = ControlConfigRoom(this.controlId)

		if (this.io.countRoomMembers(roomName) > 0) {
			const patch = jsonPatch.compare(this.#lastSentRuntimeJson || {}, newJson || {})
			if (patch.length > 0) {
				this.io.emitToRoom(roomName, `controls:runtime-${this.controlId}`, patch)
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
				this.graphics.invalidateControl(this.controlId)
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
	 * Prune any items on controls which belong to an unknown connectionId
	 */
	abstract verifyConnectionIds(knownConnectionIds: Set<string>): void

	/**
	 * Execute a press of a control
	 * @param pressed Whether the control is pressed
	 * @param surfaceId The surface that initiated this press
	 * @param force Trigger actions even if already in the state
	 */
	abstract pressControl(pressed: boolean, surfaceId: string | undefined, force?: boolean): void
}

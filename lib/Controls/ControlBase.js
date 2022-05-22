import { cloneDeep } from 'lodash-es'
import CoreBase from '../Core/Base.js'
import Registry from '../Registry.js'
import jsonPatch from 'fast-json-patch'
import { ParseControlId } from '../Resources/Util.js'

export function ControlConfigRoom(controlId) {
	return `controls:${controlId}`
}

export default class ControlBase extends CoreBase {
	//
	#lastSentConfigJson = null
	#lastSentRuntimeJson = null

	constructor(registry, controlId, logSource, debugNamespace) {
		super(registry, logSource, debugNamespace)

		this.controlId = controlId
	}

	destroy() {
		// TODO

		// Inform clients
		const roomName = ControlConfigRoom(this.controlId)
		this.io.emitToRoom(roomName, `controls:config-${controlId}`, false)
		this.io.emitToRoom(roomName, `controls:runtime-${controlId}`, false)
	}

	pressBank(direction, deviceid) {
		// TODO remove?
	}

	getDrawStyle() {
		// TODO - dont use this..
		return {
			style: this.type,
			...this.config,
		}
	}

	toJSON(clone = true) {
		// TODO
		return {}
	}

	/**
	 * Get any volatile properties for the control
	 * @returns
	 */
	toRuntimeJSON() {
		return {}
	}

	/**
	 * Trigger a redraw of this control, if it can be drawn
	 */
	triggerRedraw() {
		// TODO properly
		const parsed = ParseControlId(this.controlId)
		if (parsed?.type === 'bank') {
			setImmediate(() => {
				this.graphics.invalidateBank(parsed.page, parsed.bank)
			})
		}
	}

	/**
	 * Emit a change to the runtime properties of this control.
	 * This is for any properties that the ui may want about this control which are not persisted in toJSON()
	 * This is done via this.toRuntimeJSON()
	 */
	sendRuntimePropsChange() {
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
	 * Post-process a change to this control
	 * This includes, redrawing, writing to the db and informing any interested clients
	 * @param {boolean} redraw - whether to redraw the control
	 */
	commitChange(redraw = true) {
		// Trigger redraw
		if (redraw) this.triggerRedraw()

		const newJson = this.toJSON(true)

		// Save to db
		this.db.setKey(['controls', this.controlId], newJson)

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
}

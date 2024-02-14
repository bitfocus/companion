import { cloneDeep } from 'lodash-es'
import CoreBase from '../Core/Base.js'
import jsonPatch from 'fast-json-patch'
import debounceFn from 'debounce-fn'

/**
 * Get Socket.io room to use for changes to a control config
 * @param {string} controlId
 * @returns {string}
 */
export function ControlConfigRoom(controlId) {
	return `controls:${controlId}`
}

/**
 * Abstract class for a control.
 *
 * @extends CoreBase
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 3.0.0
 * @abstract
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
export default class ControlBase extends CoreBase {
	/**
	 * @readonly
	 * @type {string}
	 * @access public
	 */
	type

	/**
	 * The last sent config json object
	 * @type {Record<string, any> | null}
	 * @access private
	 */
	#lastSentConfigJson = null
	/**
	 * The last sent runtime json object
	 * @type {Record<string, any> | null}
	 * @access private
	 */
	#lastSentRuntimeJson = null

	/**
	 * Check the status of a control, and re-draw if needed
	 * @access public
	 * @type {((redraw?: boolean) => boolean)=}
	 * @returns {boolean} whether the status changed
	 * @abstract
	 */
	checkButtonStatus

	/**
	 * @param {import('../Registry.js').default} registry - the application core
	 * @param {string} controlId - id of the control
	 * @param {string} logSource
	 * @param {string} debugNamespace
	 */
	constructor(registry, controlId, logSource, debugNamespace) {
		super(registry, logSource, debugNamespace)

		this.controlId = controlId
	}

	/**
	 * Post-process a change to this control
	 * This includes, redrawing, writing to the db and informing any interested clients
	 * @param {boolean} redraw - whether to redraw the control
	 * @access protected
	 */
	commitChange(redraw = true) {
		// Check if the status has changed
		if (typeof this.checkButtonStatus === 'function' && this.checkButtonStatus(false)) redraw = true

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

	/**
	 * Prepare this control for deletion, this should be extended by controls.
	 * Immediately after this is called, it will be removed from the store, and assumed to be fully deleted
	 * @access public
	 */
	destroy() {
		// Inform clients
		const roomName = ControlConfigRoom(this.controlId)
		if (this.io.countRoomMembers(roomName) > 0) {
			this.io.emitToRoom(roomName, `controls:config-${this.controlId}`, false)
			this.io.emitToRoom(roomName, `controls:runtime-${this.controlId}`, false)
		}
	}

	/**
	 * Collect the instance ids and labels referenced by this control
	 * @param {Set<string>} _foundConnectionIds - instance ids being referenced
	 * @param {Set<string>} _foundConnectionLabels - instance labels being referenced
	 * @access public
	 * @abstract
	 */
	collectReferencedConnections(_foundConnectionIds, _foundConnectionLabels) {
		throw new Error('must be implemented by subclass!')
	}

	/**
	 * Inform the control that it has been moved, and anything relying on its location must be invalidated
	 */
	triggerLocationHasChanged() {
		throw new Error('must be implemented by subclass!')
	}

	/**
	 * Get the size of the bitmap render of this control
	 * @access public
	 * @returns {{ width: number, height: number } | null}
	 * @abstract
	 */
	getBitmapSize() {
		return null
	}

	/**
	 * Get the complete style object of a button
	 * @returns {import('../Shared/Model/StyleModel.js').DrawStyleModel | null} the processed style of the button
	 * @access public
	 */
	getDrawStyle() {
		return null
	}

	/**
	 * Emit a change to the runtime properties of this control.
	 * This is for any properties that the ui may want about this control which are not persisted in toJSON()
	 * This is done via this.toRuntimeJSON()
	 * @access protected
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
	 * Convert this control to JSON
	 * To be sent to the client and written to the db
	 * @param {boolean=} _clone - Whether to return a cloned object
	 * @returns {Record<string, any>}
	 * @access public
	 * @abstract
	 */
	toJSON(_clone = true) {
		throw new Error('must be implemented by subclass!')
	}

	/**
	 * Get any volatile properties for the control
	 * Not all controls have additional data
	 * @returns {Record<string, any>}
	 * @access public
	 */
	toRuntimeJSON() {
		return {}
	}

	/**
	 * Trigger a redraw of this control, if it can be drawn
	 * @access protected
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
	 * @param {string} _labelFrom - the old instance short name
	 * @param {string} _labelTo - the new instance short name
	 * @returns {void}
	 * @access public
	 */
	renameVariables(_labelFrom, _labelTo) {
		// To be implemented by subclasses
	}

	/**
	 * Prune any items on controls which belong to an unknown connectionId
	 * @param {Set<string>} _knownConnectionIds
	 * @access public
	 */
	verifyConnectionIds(_knownConnectionIds) {
		// To be implemented by subclasses
	}

	/**
	 * Execute a press of a control
	 * @param {boolean} _pressed Whether the control is pressed
	 * @param {string | undefined} _surfaceId The surface that intiated this press
	 * @param {boolean=} _force Trigger actions even if already in the state
	 * @returns {void}
	 * @access public
	 */
	pressControl(_pressed, _surfaceId, _force) {
		// To be implemented by subclasses
	}
}

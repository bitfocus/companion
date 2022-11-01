import ControlBase from '../../ControlBase.js'
import FragmentActions from '../../Fragments/FragmentActions.js'
import Registry from '../../../Registry.js'
import { TriggersListRoom } from '../../Controller.js'
import { cloneDeep } from 'lodash-es'
import jsonPatch from 'fast-json-patch'

/**
 * Class for an interval trigger.
 *
 * @extends ControlBase
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
export default class ControlTrigger extends ControlBase {
	type = 'trigger'

	/**
	 * The defaults config for a trigger
	 * @type {Object}
	 * @access public
	 * @static
	 */
	static DefaultConfig = {
		name: 'New Trigger',
		enabled: false,
	}
	/**
	 * The defaults options for a button
	 * @type {Object}
	 * @access public
	 * @static
	 */
	static DefaultOptions = {
		relativeDelay: false,
	}

	/**
	 * Basic trigger configuration
	 */
	config = {}

	options = {}

	/**
	 * The last sent trigger json object
	 * @access private
	 */
	#lastSentTriggerJson = null

	/**
	 * @param {Registry} registry - the application core
	 * @param {string} controlId - id of the control
	 * @param {object} storage - persisted storage object
	 * @param {boolean} isImport - if this is importing a button, not creating at startup
	 */
	constructor(registry, controlId, storage, isImport) {
		super(registry, controlId, 'trigger', 'Controls/ControlTypes/Triggers')

		this.actions = new FragmentActions(
			registry,
			controlId,
			this.commitChange.bind(this),
			this.checkButtonStatus.bind(this)
		)

		this.config = cloneDeep(ControlTrigger.DefaultConfig)
		this.options = cloneDeep(ControlTrigger.DefaultOptions)
		this.actions.action_sets = {
			0: [],
		}

		if (!storage) {
			// New control

			// Save the change
			this.commitChange()

			// Notify interested
		} else {
			if (storage.type !== 'trigger') throw new Error(`Invalid type given to ControlTriggerInterval: "${storage.type}"`)

			this.config = storage.config || this.config
			this.options = storage.options || this.options
			this.actions.action_sets = storage.action_sets || this.actions.action_sets

			if (isImport) this.commitChange()
		}

		this.startOrStopRunning(this.config.enabled)
	}

	checkButtonStatus() {
		// Ignore
	}

	/**
	 * Get the complete style object of a button
	 * @returns the processed style of the button
	 * @access public
	 */
	getDrawStyle() {
		return null
	}

	// /**
	//  * Execute a press of this control
	//  * @param {boolean} pressed Whether the control is pressed
	//  * @param {string | undefined} deviceId The surface that intiated this press
	//  * @access public
	//  */
	// pressControl(pressed, deviceId) {
	// 	if (pressed) {
	// 		this.surfaces.devicePageSet(deviceId, 1)
	// 	}
	// }

	/**
	 * Convert this control to JSON
	 * To be sent to the client and written to the db
	 * @param {boolean} clone - Whether to return a cloned object
	 * @access public
	 */
	toJSON(clone = true) {
		const obj = {
			type: this.type,
			config: this.config,
			options: this.options,
			action_sets: this.actions.action_sets,
		}
		return clone ? cloneDeep(obj) : obj
	}

	toTriggerJSON() {
		return {
			type: this.type,
			...this.config,
		}
	}

	/**
	 * Remove any actions and feedbacks referencing a specified instanceId
	 * @param {string} instanceId
	 * @access public
	 */
	forgetInstance(instanceId) {
		const changedActions = this.actions.forgetInstance(instanceId)

		if (changedActions) {
			this.commitChange()
		}
	}

	/**
	 * Start or stop the trigger from running
	 * @param {*} running
	 */
	startOrStopRunning(running) {
		// TODO
	}

	/**
	 * Update an config field of this control
	 * @access public
	 */
	configSetField(key, value) {
		this.config[key] = value

		if (key === 'enabled') {
			this.startOrStopRunning(value)
		}

		this.commitChange()

		return true
	}

	/**
	 * If this control was imported to a running system, do some data cleanup/validation
	 * @access protected
	 */
	postProcessImport() {
		const ps = []

		ps.push(this.actions.postProcessImport())

		Promise.all(ps).catch((e) => {
			this.logger.silly(`posProcessImport for ${this.controlId} failed: ${e.message}`)
		})

		this.commitChange()
		this.sendRuntimePropsChange()
	}

	/**
	 * Prune all actions/feedbacks referencing unknown instances
	 * Doesn't do any cleanup, as it is assumed that the instance has not been running
	 * @param {Set<string>} knownInstanceIds
	 * @access public
	 */
	verifyInstanceIds(knownInstanceIds) {
		const changedActions = this.actions.verifyInstanceIds(knownInstanceIds)

		if (changedActions) {
			this.commitChange()
		}
	}

	/**
	 * Emit a change to the runtime properties of this control.
	 * This is for any properties that the ui may want about this control which are not persisted in toJSON()
	 * This is done via this.toRuntimeJSON()
	 * @access protected
	 */
	#sendTriggerJsonChange() {
		const newJson = cloneDeep(this.toTriggerJSON())

		if (this.io.countRoomMembers(TriggersListRoom) > 0) {
			const patch = jsonPatch.compare(this.#lastSentTriggerJson || {}, newJson || {})
			if (patch.length > 0) {
				this.io.emitToRoom(TriggersListRoom, `triggers:update`, this.controlId, patch)
			}
		}

		this.#lastSentTriggerJson = newJson
	}

	commitChange() {
		super.commitChange()

		this.#sendTriggerJsonChange()
	}

	destroy() {
		this.startOrStopRunning(false)

		this.actions.destroy()

		super.destroy()

		this.io.emitToRoom(TriggersListRoom, `triggers:update`, this.controlId, null)
	}

	/**
	 * Trigger a redraw of this control, if it can be drawn
	 * @access protected
	 */
	triggerRedraw() {
		// Ignore
	}
}

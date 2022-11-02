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
	 * The events for this trigger
	 * @access public
	 */
	events = []

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
		this.events = []

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
			this.events = storage.events || this.events

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
			events: this.events,
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
		// Event runner cleanup
		for (const event of this.events) {
			if (running) {
				this.#startEvent(event)
			} else {
				this.#stopEvent(event)
			}
		}
	}

	#startEvent(event) {
		// TODO
	}
	#stopEvent(event) {
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

	// Events

	/**
	 * Add an event to this control
	 * @param {object} eventItem the item to add
	 * @returns {boolean} success
	 * @access public
	 */
	eventAdd(eventItem) {
		this.events.push(eventItem)

		// Inform relevant module
		this.#startEvent(eventItem)

		this.commitChange()

		return true
	}

	// /**
	//  * Duplicate an feedback on this control
	//  * @param {string} id
	//  * @returns {boolean} success
	//  * @access public
	//  */
	// feedbackDuplicate(id) {
	// 	const index = this.feedbacks.findIndex((fb) => fb.id === id)
	// 	if (index !== -1) {
	// 		const feedbackItem = cloneDeep(this.feedbacks[index])
	// 		feedbackItem.id = nanoid()

	// 		this.feedbacks.splice(index + 1, 0, feedbackItem)

	// 		this.#feedbackSubscribe(feedbackItem)

	// 		this.commitChange(false)

	// 		return true
	// 	}

	// 	return false
	// }

	// feedbackEnabled(id, enabled) {
	// 	for (const feedback of this.feedbacks) {
	// 		if (feedback && feedback.id === id) {
	// 			if (!feedback.options) feedback.options = {}

	// 			feedback.disabled = !enabled

	// 			// Remove from cached feedback values
	// 			delete this.#cachedFeedbackValues[id]

	// 			// Inform relevant module
	// 			if (!feedback.disabled) {
	// 				this.#feedbackSubscribe(feedback)
	// 			} else {
	// 				this.#cleanupFeedback(feedback)
	// 			}

	// 			this.commitChange()

	// 			return true
	// 		}
	// 	}

	// 	return false
	// }

	/**
	 * Remove an event from this control
	 * @param {string} id the id of the event
	 * @returns {boolean} success
	 * @access public
	 */
	eventRemove(id) {
		const index = this.events.findIndex((ev) => ev.id === id)
		if (index !== -1) {
			const event = this.events[index]
			this.events.splice(index, 1)

			this.#stopEvent(event)

			this.commitChange()

			return true
		} else {
			return false
		}
	}

	// /**
	//  * Reorder a feedback in the list
	//  * @param {number} oldIndex the index of the feedback to move
	//  * @param {number} newIndex the target index of the feedback
	//  * @returns {boolean} success
	//  * @access public
	//  */
	// feedbackReorder(oldIndex, newIndex) {
	// 	oldIndex = clamp(oldIndex, 0, this.feedbacks.length)
	// 	newIndex = clamp(newIndex, 0, this.feedbacks.length)
	// 	this.feedbacks.splice(newIndex, 0, ...this.feedbacks.splice(oldIndex, 1))

	// 	this.commitChange()
	// }

	// /**
	//  * Replace a feedback with an updated version
	//  * @param {object} newProps
	//  * @access public
	//  */
	// feedbackReplace(newProps) {
	// 	for (const feedback of this.feedbacks) {
	// 		// Replace the new feedback in place
	// 		if (feedback.id === newProps.id) {
	// 			feedback.type = newProps.feedbackId
	// 			feedback.options = newProps.options

	// 			delete feedback.upgradeIndex

	// 			// Preserve existing value if it is set
	// 			feedback.style = feedback.style || newProps.style

	// 			this.#feedbackSubscribe(feedback)

	// 			this.commitChange(true)

	// 			return true
	// 		}
	// 	}

	// 	return false
	// }

	// /**
	//  * Update an option for a feedback
	//  * @param {string} id the id of the feedback
	//  * @param {string} key the key/name of the property
	//  * @param {any} value the new value
	//  * @returns {boolean} success
	//  * @access public
	//  */
	// feedbackSetOptions(id, key, value) {
	// 	for (const feedback of this.feedbacks) {
	// 		if (feedback && feedback.id === id) {
	// 			if (!feedback.options) feedback.options = {}

	// 			feedback.options[key] = value

	// 			// Remove from cached feedback values
	// 			delete this.#cachedFeedbackValues[id]

	// 			// Inform relevant module
	// 			this.#feedbackSubscribe(feedback)

	// 			this.commitChange()

	// 			return true
	// 		}
	// 	}

	// 	return false
	// }
}

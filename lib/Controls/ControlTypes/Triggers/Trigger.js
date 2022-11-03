import ControlBase from '../../ControlBase.js'
import FragmentActions from '../../Fragments/FragmentActions.js'
import Registry from '../../../Registry.js'
import { TriggersListRoom } from '../../Controller.js'
import { cloneDeep } from 'lodash-es'
import jsonPatch from 'fast-json-patch'
import TriggersEventTimer from './Events/Timer.js'

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

	#timer

	#lastExecuted = undefined

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
	constructor(registry, eventBus, controlId, storage, isImport) {
		super(registry, controlId, 'trigger', 'Controls/ControlTypes/Triggers')

		this.actions = new FragmentActions(
			registry,
			controlId,
			this.commitChange.bind(this),
			this.checkButtonStatus.bind(this)
		)

		this.#timer = new TriggersEventTimer(registry, eventBus, controlId, this.executeActions.bind(this))

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

		this.#setupEvents(this.config.enabled)
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

	executeActions(nowTime) {
		this.logger.info(`Execute ${this.config.name}`)

		this.#lastExecuted = nowTime
		this.#sendTriggerJsonChange()

		const actions = this.actions.action_sets['0']
		if (actions) {
			this.logger.silly('found actions')

			this.controls.actions.runMultipleActions(actions, this.controlId, this.options.relativeDelay, {
				deviceid: this.controlId,
			})
		}
	}

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
			lastExecuted: this.#lastExecuted,
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
	 */
	#setupEvents() {
		this.#timer.setEnabled(this.config.enabled)

		// Event runner cleanup
		for (const event of this.events) {
			this.#restartEvent(event)
		}
	}

	#restartEvent(event) {
		if (event.enabled) {
			switch (event.type) {
				case 'interval':
					this.#timer.setInterval(event.id, event.options.seconds)
					break
				case 'timeofday':
					this.#timer.setTimeOfDay(event.id, event.options)
					break
				default:
					// TODO - log
					break
			}
		} else {
			this.#stopEvent(event)
		}
	}
	#stopEvent(event) {
		switch (event.type) {
			case 'interval':
				this.#timer.clearInterval(event.id)
				break
			case 'timeofday':
				this.#timer.clearTimeOfDay(event.id)
				break
			default:
				// TODO - log
				break
		}
	}

	/**
	 * Update an config field of this control
	 * @access public
	 */
	configSetField(key, value) {
		// TODO - should 'config' and 'options' be separate concepts?

		this.config[key] = value

		if (key === 'enabled') {
			this.#timer.setEnabled(this.config[key])
		}

		this.commitChange()

		return true
	}

	/**
	 * Update an option field of this control
	 * @access public
	 */
	optionsSetField(key, value) {
		this.options[key] = value

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
		this.#timer.destroy()

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
		this.#restartEvent(eventItem)

		this.commitChange()

		return true
	}

	/**
	 * Duplicate an event on this control
	 * @param {string} id
	 * @returns {boolean} success
	 * @access public
	 */
	eventDuplicate(id) {
		const index = this.events.findIndex((fb) => fb.id === id)
		if (index !== -1) {
			const eventItem = cloneDeep(this.events[index])
			eventItem.id = nanoid()

			this.events.splice(index + 1, 0, eventItem)

			this.#restartEvent(eventItem)

			this.commitChange(false)

			return true
		}

		return false
	}

	eventEnabled(id, enabled) {
		for (const event of this.events) {
			if (event && event.id === id) {
				event.enabled = !!enabled

				// Restart event
				this.#restartEvent(event)

				this.commitChange()

				return true
			}
		}

		return false
	}

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

	/**
	 * Update an option for an event
	 * @param {string} id the id of the event
	 * @param {string} key the key/name of the property
	 * @param {any} value the new value
	 * @returns {boolean} success
	 * @access public
	 */
	eventSetOptions(id, key, value) {
		for (const event of this.events) {
			if (event && event.id === id) {
				if (!event.options) event.options = {}

				event.options[key] = value

				// Restart event
				this.#restartEvent(event)

				this.commitChange()

				return true
			}
		}

		return false
	}
}

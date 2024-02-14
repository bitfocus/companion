import ControlBase from '../../ControlBase.js'
import FragmentActions from '../../Fragments/FragmentActions.js'
import FragmentFeedbacks from '../../Fragments/FragmentFeedbacks.js'
import { TriggersListRoom } from '../../Controller.js'
import { cloneDeep } from 'lodash-es'
import jsonPatch from 'fast-json-patch'
import debounceFn from 'debounce-fn'
import TriggersEventTimer from './Events/Timer.js'
import TriggersEventMisc from './Events/Misc.js'
import { clamp } from '../../../Resources/Util.js'
import TriggersEventVariables from './Events/Variable.js'
import { nanoid } from 'nanoid'
import { VisitorReferencesCollector } from '../../../Util/Visitors/ReferencesCollector.js'
import TriggerEvents from '../../TriggerEvents.js'
import {
	ControlWithActions,
	ControlWithEvents,
	ControlWithFeedbacks,
	ControlWithOptions,
	ControlWithoutActionSets,
	ControlWithoutPushed,
	ControlWithoutSteps,
	ControlWithoutStyle,
} from '../../IControlFragments.js'

/**
 * @typedef {import('../../../Shared/Model/ActionModel.js').ActionInstance} ActionInstance
 * @typedef {import('../../../Shared/Model/FeedbackModel.js').FeedbackInstance} FeedbackInstance
 * @typedef {import('../../../Shared/Model/EventModel.js').EventInstance} EventInstance
 */

/**
 * Class for an interval trigger.
 *
 * @extends ControlBase
 * @implements {ControlWithActions}
 * @implements {ControlWithEvents}
 * @implements {ControlWithFeedbacks}
 * @implements {ControlWithoutSteps}
 * @implements {ControlWithoutStyle}
 * @implements {ControlWithoutActionSets}
 * @implements {ControlWithOptions}
 * @implements {ControlWithoutPushed}
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
	/**
	 * @readonly
	 */
	type = 'trigger'

	/**
	 * @readonly
	 * @type {true}
	 */
	supportsActions = true
	/**
	 * @readonly
	 * @type {true}
	 */
	supportsEvents = true
	/**
	 * @readonly
	 * @type {false}
	 */
	supportsSteps = false
	/**
	 * @readonly
	 * @type {true}
	 */
	supportsFeedbacks = true
	/**
	 * @readonly
	 * @type {false}
	 */
	supportsStyle = false
	/**
	 * @readonly
	 * @type {false}
	 */
	supportsActionSets = false
	/**
	 * @readonly
	 * @type {true}
	 */
	supportsOptions = true
	/**
	 * @readonly
	 * @type {false}
	 */
	supportsPushed = false

	/**
	 * The defaults options for a trigger
	 * @type {import('../../../Shared/Model/TriggerModel.js').TriggerOptions}
	 * @access public
	 * @static
	 */
	static DefaultOptions = {
		name: 'New Trigger',
		enabled: false,
		sortOrder: 0,
		relativeDelay: false,
	}

	/**
	 * Enabled condition_true or condition_false events
	 * @type {Set<string>}
	 * @access private
	 */
	#conditionCheckEvents = new Set()

	/**
	 * Last value of the condition
	 * @type {boolean}
	 * @access private
	 */
	#conditionCheckLastValue = false

	/**
	 * Shared event bus, across all triggers
	 * @type {TriggerEvents}
	 * @access private
	 */
	#eventBus

	/**
	 * The last time the trigger was executed
	 * @type {number | undefined}
	 * @access private
	 */
	#lastExecuted = undefined

	/**
	 * The last sent trigger json object
	 * @type {ClientTriggerData | null}
	 * @access private
	 */
	#lastSentTriggerJson = null

	/**
	 * The events for this trigger
	 * @type {EventInstance[]}
	 * @access public
	 */
	events = []

	/**
	 * Miscellaneous trigger events helper
	 * @type {TriggersEventMisc}
	 * @access private
	 */
	#miscEvents

	/**
	 * Basic trigger configuration
	 * @type {import('../../../Shared/Model/TriggerModel.js').TriggerOptions}
	 * @access public
	 */
	options

	/**
	 * Timer based trigger events helper
	 * @type {TriggersEventTimer}
	 * @access private
	 */
	#timerEvents

	/**
	 * Variables based trigger events helper
	 * @type {TriggersEventVariables}
	 * @access private
	 */
	#variablesEvents

	/**
	 * Whether this button has delayed actions running
	 * @access protected
	 */
	has_actions_running = false

	/**
	 * @param {import('../../../Registry.js').default} registry - the application core
	 * @param {TriggerEvents} eventBus - the main trigger event bus
	 * @param {string} controlId - id of the control
	 * @param {import('../../../Shared/Model/TriggerModel.js').TriggerModel | null} storage - persisted storage object
	 * @param {boolean} isImport - if this is importing a button, not creating at startup
	 */
	constructor(registry, eventBus, controlId, storage, isImport) {
		super(registry, controlId, 'trigger', 'Controls/ControlTypes/Triggers')

		this.actions = new FragmentActions(registry, controlId, this.commitChange.bind(this))
		this.feedbacks = new FragmentFeedbacks(
			registry,
			controlId,
			this.commitChange.bind(this),
			this.triggerRedraw.bind(this),
			true
		)

		this.#eventBus = eventBus
		this.#timerEvents = new TriggersEventTimer(eventBus, controlId, this.executeActions.bind(this))
		this.#miscEvents = new TriggersEventMisc(eventBus, controlId, this.executeActions.bind(this))
		this.#variablesEvents = new TriggersEventVariables(eventBus, controlId, this.executeActions.bind(this))

		this.options = cloneDeep(ControlTrigger.DefaultOptions)
		this.actions.action_sets = {
			0: [],
		}
		this.feedbacks.feedbacks = []
		this.events = []

		if (!storage) {
			// New control

			// Save the change
			this.commitChange()

			// Notify interested
		} else {
			if (storage.type !== 'trigger') throw new Error(`Invalid type given to ControlTriggerInterval: "${storage.type}"`)

			this.options = storage.options || this.options
			this.actions.action_sets = storage.action_sets || this.actions.action_sets
			this.feedbacks.feedbacks = storage.condition || this.feedbacks.feedbacks
			this.events = storage.events || this.events

			if (isImport) this.postProcessImport()
		}

		// Ensure trigger is stored before setup
		setImmediate(() => {
			this.#setupEvents()
		})
	}

	/**
	 * Add an action to this control
	 * @param {string} _stepId
	 * @param {string} _setId
	 * @param {ActionInstance} actionItem
	 * @returns {boolean} success
	 * @access public
	 */
	actionAdd(_stepId, _setId, actionItem) {
		return this.actions.actionAdd('0', actionItem)
	}

	/**
	 * Append some actions to this button
	 * @param {string} _stepId
	 * @param {string} _setId the action_set id to update
	 * @param {ActionInstance[]} newActions actions to append
	 * @access public
	 */
	actionAppend(_stepId, _setId, newActions) {
		return this.actions.actionAppend('0', newActions)
	}

	/**
	 * Learn the options for an action, by asking the instance for the current values
	 * @param {string} _stepId
	 * @param {string} _setId the id of the action set
	 * @param {string} id the id of the action
	 * @returns {Promise<boolean>} success
	 * @access public
	 */
	async actionLearn(_stepId, _setId, id) {
		return this.actions.actionLearn('0', id)
	}

	/**
	 * Enable or disable an action
	 * @param {string} _stepId
	 * @param {string} _setId
	 * @param {string} id
	 * @param {boolean} enabled
	 * @access public
	 */
	actionEnabled(_stepId, _setId, id, enabled) {
		return this.actions.actionEnabled('0', id, enabled)
	}

	/**
	 * Set action headline
	 * @param {string} _stepId
	 * @param {string} _setId
	 * @param {string} id
	 * @param {string} headline
	 * @returns {boolean}
	 * @access public
	 */
	actionHeadline(_stepId, _setId, id, headline) {
		return this.actions.actionHeadline('0', id, headline)
	}

	/**
	 * Remove an action from this control
	 * @param {string} _stepId
	 * @param {string} _setId the id of the action set
	 * @param {string} id the id of the action
	 * @returns {boolean} success
	 * @access public
	 */
	actionRemove(_stepId, _setId, id) {
		return this.actions.actionRemove('0', id)
	}

	/**
	 * Duplicate an action on this control
	 * @param {string} _stepId
	 * @param {string} _setId
	 * @param {string} id
	 * @returns {boolean} success
	 * @access public
	 */
	actionDuplicate(_stepId, _setId, id) {
		return this.actions.actionDuplicate('0', id)
	}

	/**
	 * Remove an action from this control
	 * @param {Pick<ActionInstance, 'id' | 'action' | 'options'>} newProps
	 * @access public
	 */
	actionReplace(newProps, skipNotifyModule = false) {
		return this.actions.actionReplace(newProps, skipNotifyModule)
	}

	/**
	 * Replace all the actions in a set
	 * @param {string} _stepId
	 * @param {string} _setId the action_set id to update
	 * @param {ActionInstance[]} newActions actions to populate
	 * @access public
	 */
	actionReplaceAll(_stepId, _setId, newActions) {
		return this.actions.actionReplaceAll('0', newActions)
	}

	/**
	 * Set the delay of an action
	 * @param {string} _stepId
	 * @param {string} _setId the action_set id
	 * @param {string} id the action id
	 * @param {number} delay the desired delay
	 * @returns {boolean} success
	 * @access public
	 */
	actionSetDelay(_stepId, _setId, id, delay) {
		return this.actions.actionSetDelay('0', id, delay)
	}

	/**
	 * Set an opton of an action
	 * @param {string} _stepId
	 * @param {string} _setId the action_set id
	 * @param {string} id the action id
	 * @param {string} key the desired option to set
	 * @param {any} value the new value of the option
	 * @returns {boolean} success
	 * @access public
	 */
	actionSetOption(_stepId, _setId, id, key, value) {
		return this.actions.actionSetOption('0', id, key, value)
	}

	/**
	 * Reorder an action in the list or move between sets
	 * @param {string} _dragStepId
	 * @param {string} _dragSetId the action_set id to remove from
	 * @param {number} dragIndex the index of the action to move
	 * @param {string} _dropStepId
	 * @param {string} _dropSetId the target action_set of the action
	 * @param {number} dropIndex the target index of the action
	 * @returns {boolean} success
	 * @access public
	 */
	actionReorder(_dragStepId, _dragSetId, dragIndex, _dropStepId, _dropSetId, dropIndex) {
		const set = this.actions.action_sets['0']
		if (set) {
			dragIndex = clamp(dragIndex, 0, set.length)
			dropIndex = clamp(dropIndex, 0, set.length)

			set.splice(dropIndex, 0, ...set.splice(dragIndex, 1))

			this.commitChange(false)

			return true
		}

		return false
	}

	/**
	 * Remove any tracked state for a connection
	 * @param {string} connectionId
	 * @access public
	 */
	clearConnectionState(connectionId) {
		this.feedbacks.clearConnectionState(connectionId)
	}

	/**
	 * Execute the actions of this trigger
	 * @param {number} nowTime
	 * @param {boolean} isTest Whether this is a 'test' execution from the ui and should skip condition checks
	 * @returns {void}
	 */
	executeActions(nowTime, isTest = false) {
		if (isTest) {
			this.logger.debug(`Test Execute ${this.options.name}`)
		} else {
			if (!this.options.enabled) return

			// Ensure the condition passes when it is not part of the event
			if (!this.events.some((event) => event.type.startsWith('condition_'))) {
				const conditionPasses = this.feedbacks.checkValueAsBoolean()
				if (!conditionPasses) return
			}

			this.logger.debug(`Execute ${this.options.name}`)

			this.#lastExecuted = nowTime
			this.#sendTriggerJsonChange()
		}

		const actions = this.actions.action_sets['0']
		if (actions) {
			this.logger.silly('found actions')

			this.controls.actions.runMultipleActions(actions, this.controlId, this.options.relativeDelay, {
				surfaceId: this.controlId,
			})
		}
	}

	/**
	 * Get all the actions on this control
	 * @returns {ActionInstance[]}
	 */
	getAllActions() {
		/** @type {ActionInstance[]} */
		const actions = []

		for (const set of Object.values(this.actions.action_sets)) {
			if (set) actions.push(...set)
		}

		return actions
	}

	/**
	 * Collect the instance ids and labels referenced by this control
	 * @param {Set<string>} foundConnectionIds - instance ids being referenced
	 * @param {Set<string>} foundConnectionLabels - instance labels being referenced
	 * @access public
	 */
	collectReferencedConnections(foundConnectionIds, foundConnectionLabels) {
		const allFeedbacks = this.feedbacks.feedbacks
		const allActions = this.actions.getAllActions()

		for (const feedback of allFeedbacks) {
			foundConnectionIds.add(feedback.instance_id)
		}
		for (const action of allActions) {
			foundConnectionIds.add(action.instance)
		}

		const visitor = new VisitorReferencesCollector(foundConnectionIds, foundConnectionLabels)

		this.registry.data.importExport.visitControlReferences(visitor, undefined, allActions, allFeedbacks, this.events)
	}

	/**
	 * Inform the control that it has been moved, and anything relying on its location must be invalidated
	 * @returns {void}
	 */
	triggerLocationHasChanged() {
		this.feedbacks.updateAllInternal()
	}

	/**
	 * Convert this control to JSON
	 * To be sent to the client and written to the db
	 * @param {boolean} clone - Whether to return a cloned object
	 * @returns {import('../../../Shared/Model/TriggerModel.js').TriggerModel}
	 * @access public
	 */
	toJSON(clone = true) {
		/** @type {import('../../../Shared/Model/TriggerModel.js').TriggerModel} */
		const obj = {
			type: this.type,
			options: this.options,
			action_sets: this.actions.action_sets,
			condition: this.feedbacks.feedbacks,
			events: this.events,
		}
		return clone ? cloneDeep(obj) : obj
	}

	/**
	 * @returns {ClientTriggerData}
	 */
	toTriggerJSON() {
		/** @type {string[]} */
		const eventStrings = []
		for (const event of this.events) {
			if (event.enabled) {
				switch (event.type) {
					case 'interval':
						eventStrings.push(this.#timerEvents.getIntervalDescription(event))
						break
					case 'timeofday':
						eventStrings.push(this.#timerEvents.getTimeOfDayDescription(event))
						break
					case 'sun_event':
						eventStrings.push(this.#timerEvents.getSunDescription(event))
						break
					case 'startup':
						eventStrings.push('Startup')
						break
					case 'client_connect':
						eventStrings.push('Web client connect')
						break
					case 'button_press':
						eventStrings.push('On any button press')
						break
					case 'button_depress':
						eventStrings.push('On any button depress')
						break
					case 'condition_true':
						eventStrings.push('On condition becoming true')
						break
					case 'condition_false':
						eventStrings.push('On condition becoming false')
						break
					case 'variable_changed':
						eventStrings.push(this.#variablesEvents.getVariablesChangedDescription(event))
						break
					case 'computer_locked':
						eventStrings.push('On computer becoming locked')
						break
					case 'computer_unlocked':
						eventStrings.push('On computer becoming unlocked')
						break
					default:
						eventStrings.push('Unknown event')
						break
				}
			}
		}

		return {
			type: this.type,
			...this.options,
			lastExecuted: this.#lastExecuted,
			description: eventStrings.join('<br />'),
		}
	}

	/**
	 * Remove any actions and feedbacks referencing a specified connectionId
	 * @param {string} connectionId
	 * @access public
	 */
	forgetConnection(connectionId) {
		const changedFeedbacks = this.feedbacks.forgetConnection(connectionId)
		const changedActions = this.actions.forgetConnection(connectionId)

		if (changedFeedbacks || changedActions) {
			this.commitChange(changedFeedbacks)
		}
	}

	/**
	 * Start or stop the trigger from running
	 */
	#setupEvents() {
		this.#timerEvents.setEnabled(this.options.enabled)
		this.#miscEvents.setEnabled(this.options.enabled)
		this.#variablesEvents.setEnabled(this.options.enabled)
		this.#eventBus.emit('trigger_enabled', this.controlId, this.options.enabled)

		// Event runner cleanup
		for (const event of this.events) {
			this.#restartEvent(event)
		}
	}

	/**
	 * Rename an instance for variables used in this control
	 * @param {string} labelFrom - the old instance short name
	 * @param {string} labelTo - the new instance short name
	 * @access public
	 */
	renameVariables(labelFrom, labelTo) {
		const allFeedbacks = this.feedbacks.feedbacks
		const allActions = this.actions.getAllActions()

		// Fix up references
		const changed = this.registry.data.importExport.fixupControlReferences(
			{ connectionLabels: { [labelFrom]: labelTo } },
			undefined,
			allActions,
			allFeedbacks,
			this.events,
			true
		)

		// 'redraw' if needed and save changes
		this.commitChange(changed)
	}

	/**
	 * @param {EventInstance} event
	 * @returns {void}
	 */
	#restartEvent(event) {
		if (event.enabled) {
			switch (event.type) {
				case 'interval':
					this.#timerEvents.setInterval(event.id, Number(event.options.seconds))
					break
				case 'timeofday':
					this.#timerEvents.setTimeOfDay(event.id, event.options)
					break
				case 'sun_event':
					this.#timerEvents.setSun(event.id, event.options)
					break
				case 'startup':
					this.#miscEvents.setStartup(event.id, Number(event.options.delay))
					break
				case 'client_connect':
					this.#miscEvents.setClientConnect(event.id, Number(event.options.delay))
					break
				case 'button_press':
					this.#miscEvents.setControlPress(event.id, true)
					break
				case 'button_depress':
					this.#miscEvents.setControlPress(event.id, false)
					break
				case 'condition_true':
					this.#conditionCheckEvents.add(event.id)
					this.triggerRedraw() // Recheck the condition
					break
				case 'condition_false':
					this.#conditionCheckEvents.add(event.id)
					this.triggerRedraw() // Recheck the condition
					break
				case 'variable_changed':
					this.#variablesEvents.setVariableChanged(event.id, String(event.options.variableId))
					break
				case 'computer_locked':
					this.#miscEvents.setComputerLocked(event.id, true)
					break
				case 'computer_unlocked':
					this.#miscEvents.setComputerLocked(event.id, false)
					break
				default:
					this.logger.warn(`restartEvent called for unknown type: ${event.type}`)
					break
			}
		} else {
			this.#stopEvent(event)
		}
	}

	/**
	 * Mark the button as having pending delayed actions
	 * @param {boolean} _running Whether any delayed actions are pending
	 * @param {boolean} _skip_up Mark the button as released, skipping the release actions
	 * @access public
	 */
	setActionsRunning(_running, _skip_up) {
		// Nothing to do
	}

	/**
	 * @param {EventInstance} event
	 * @returns {void}
	 */
	#stopEvent(event) {
		switch (event.type) {
			case 'interval':
				this.#timerEvents.clearInterval(event.id)
				break
			case 'timeofday':
				this.#timerEvents.clearTimeOfDay(event.id)
				break
			case 'sun_event':
				this.#timerEvents.clearSun(event.id)
				break
			case 'startup':
				this.#miscEvents.clearStartup(event.id)
				break
			case 'client_connect':
				this.#miscEvents.clearClientConnect(event.id)
				break
			case 'button_press':
			case 'button_depress':
				this.#miscEvents.clearControlPress(event.id)
				break
			case 'condition_true':
				this.#conditionCheckEvents.delete(event.id)
				break
			case 'condition_false':
				this.#conditionCheckEvents.delete(event.id)
				break
			case 'variable_changed':
				this.#variablesEvents.clearVariableChanged(event.id)
				break
			case 'computer_locked':
			case 'computer_unlocked':
				this.#miscEvents.clearComputerLocked(event.id)
				break
			default:
				this.logger.warn(`stopEvent called for unknown type: ${event.type}`)
				break
		}
	}

	/**
	 * Update an option field of this control
	 * @access public
	 * @param {string} key
	 * @param {number} value
	 * @param {boolean=} forceSet
	 * @returns {boolean}
	 */
	optionsSetField(key, value, forceSet) {
		if (!forceSet && key === 'sortOrder') throw new Error('sortOrder cannot be set by the client')

		// @ts-ignore
		this.options[key] = value

		if (key === 'enabled') {
			this.#timerEvents.setEnabled(this.options.enabled)
			this.#miscEvents.setEnabled(this.options.enabled)
			this.#variablesEvents.setEnabled(this.options.enabled)
			this.#eventBus.emit('trigger_enabled', this.controlId, this.options.enabled)
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

		ps.push(this.feedbacks.postProcessImport())
		ps.push(this.actions.postProcessImport())

		Promise.all(ps).catch((e) => {
			this.logger.silly(`postProcessImport for ${this.controlId} failed: ${e.message}`)
		})

		this.commitChange()
		this.sendRuntimePropsChange()
	}

	/**
	 * Prune all actions/feedbacks referencing unknown instances
	 * Doesn't do any cleanup, as it is assumed that the instance has not been running
	 * @param {Set<string>} knownConnectionIds
	 * @access public
	 */
	verifyConnectionIds(knownConnectionIds) {
		const changedActions = this.actions.verifyConnectionIds(knownConnectionIds)
		const changedFeedbacks = this.feedbacks.verifyConnectionIds(knownConnectionIds)

		if (changedFeedbacks || changedActions) {
			this.commitChange(changedFeedbacks)
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

	commitChange(redraw = true) {
		super.commitChange(redraw)

		this.#sendTriggerJsonChange()
	}

	destroy() {
		this.#timerEvents.destroy()
		this.#miscEvents.destroy()
		this.#variablesEvents.destroy()

		this.#eventBus.emit('trigger_enabled', this.controlId, false)

		this.actions.destroy()
		this.feedbacks.destroy()

		super.destroy()

		if (this.io.countRoomMembers(TriggersListRoom) > 0) {
			this.io.emitToRoom(TriggersListRoom, `triggers:update`, this.controlId, null)
		}
	}

	/**
	 * Trigger a recheck of the condition, as something has changed and it might be the 'condition'
	 * @access protected
	 */
	triggerRedraw = debounceFn(
		() => {
			try {
				const newStatus = this.feedbacks.checkValueAsBoolean()
				const runOnTrue = this.events.some((event) => event.enabled && event.type === 'condition_true')
				const runOnFalse = this.events.some((event) => event.enabled && event.type === 'condition_false')
				if (
					this.options.enabled &&
					this.#conditionCheckEvents.size > 0 &&
					((runOnTrue && newStatus && !this.#conditionCheckLastValue) ||
						(runOnFalse && !newStatus && this.#conditionCheckLastValue))
				) {
					setImmediate(() => {
						this.executeActions(Date.now(), false)
					})
				}
				this.#conditionCheckLastValue = newStatus
			} catch (e) {
				this.logger.warn(`Failed to recheck condition: ${e}`)
			}
		},
		{
			before: false,
			after: true,
			wait: 10,
			maxWait: 20,
		}
	)

	// Events

	/**
	 * Add an event to this control
	 * @param {EventInstance} eventItem the item to add
	 * @returns {boolean} success
	 * @access public
	 */
	eventAdd(eventItem) {
		this.events.push(eventItem)

		// Inform relevant module
		this.#restartEvent(eventItem)

		this.commitChange(false)

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

	/**
	 * Enable or disable an event
	 * @param {string} id
	 * @param {boolean} enabled
	 * @returns {boolean} success
	 */
	eventEnabled(id, enabled) {
		for (const event of this.events) {
			if (event && event.id === id) {
				event.enabled = !!enabled

				// Restart event
				this.#restartEvent(event)

				this.commitChange(false)

				return true
			}
		}

		return false
	}

	/**
	 * Set event headline
	 * @param {string} id
	 * @param {string} headline
	 * @returns {boolean}
	 * @access public
	 */
	eventHeadline(id, headline) {
		for (const event of this.events) {
			if (event && event.id === id) {
				event.headline = headline

				this.commitChange(false)

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

			this.commitChange(false)

			return true
		} else {
			return false
		}
	}

	/**
	 * Reorder an event in the list
	 * @param {number} oldIndex the index of the event to move
	 * @param {number} newIndex the target index of the event
	 * @returns {boolean}
	 * @access public
	 */
	eventReorder(oldIndex, newIndex) {
		oldIndex = clamp(oldIndex, 0, this.events.length)
		newIndex = clamp(newIndex, 0, this.events.length)
		this.events.splice(newIndex, 0, ...this.events.splice(oldIndex, 1))

		this.commitChange(false)

		return true
	}

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

				this.commitChange(false)

				return true
			}
		}

		return false
	}
}

/**
 * @typedef {import('../../../Shared/Model/TriggerModel.js').ClientTriggerData} ClientTriggerData
 */

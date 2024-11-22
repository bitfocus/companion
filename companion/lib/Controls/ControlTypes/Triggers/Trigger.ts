import { ControlBase } from '../../ControlBase.js'
import { FragmentActions } from '../../Fragments/FragmentActions.js'
import { FragmentFeedbacks } from '../../Fragments/FragmentFeedbacks.js'
import { TriggersListRoom } from '../../Controller.js'
import { cloneDeep } from 'lodash-es'
import jsonPatch from 'fast-json-patch'
import debounceFn from 'debounce-fn'
import { TriggersEventTimer } from './Events/Timer.js'
import { TriggersEventMisc } from './Events/Misc.js'
import { clamp } from '../../../Resources/Util.js'
import { TriggersEventVariables } from './Events/Variable.js'
import { nanoid } from 'nanoid'
import { VisitorReferencesCollector } from '../../../Resources/Visitors/ReferencesCollector.js'
import type { TriggerEvents } from '../../TriggerEvents.js'
import type {
	ControlWithActions,
	ControlWithEvents,
	ControlWithFeedbacks,
	ControlWithOptions,
	ControlWithoutActionSets,
	ControlWithoutPushed,
	ControlWithoutSteps,
	ControlWithoutStyle,
} from '../../IControlFragments.js'
import { ReferencesVisitors } from '../../../Resources/Visitors/ReferencesVisitors.js'
import type { ClientTriggerData, TriggerModel, TriggerOptions } from '@companion-app/shared/Model/TriggerModel.js'
import type { EventInstance } from '@companion-app/shared/Model/EventModel.js'
import type { ActionInstance } from '@companion-app/shared/Model/ActionModel.js'
import type { ControlDependencies } from '../../ControlDependencies.js'

/**
 * Class for an interval trigger.
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
export class ControlTrigger
	extends ControlBase<TriggerModel>
	implements
		ControlWithActions,
		ControlWithEvents,
		ControlWithFeedbacks,
		ControlWithoutSteps,
		ControlWithoutStyle,
		ControlWithoutActionSets,
		ControlWithOptions,
		ControlWithoutPushed
{
	readonly type = 'trigger'

	readonly supportsActions = true
	readonly supportsEvents = true
	readonly supportsSteps = false
	readonly supportsFeedbacks = true
	readonly supportsStyle = false
	readonly supportsActionSets = false
	readonly supportsOptions = true
	readonly supportsPushed = false

	/**
	 * The defaults options for a trigger
	 */
	static DefaultOptions: TriggerOptions = {
		name: 'New Trigger',
		enabled: false,
		sortOrder: 0,
		relativeDelay: false,
	}

	/**
	 * Enabled condition_true or condition_false events
	 */
	readonly #conditionCheckEvents = new Set<string>()

	/**
	 * Last value of the condition
	 */
	#conditionCheckLastValue: boolean = false

	/**
	 * Shared event bus, across all triggers
	 */
	readonly #eventBus: TriggerEvents

	/**
	 * The last time the trigger was executed
	 */
	#lastExecuted: number | undefined = undefined

	/**
	 * The last sent trigger json object
	 */
	#lastSentTriggerJson: ClientTriggerData | null = null

	/**
	 * The events for this trigger
	 */
	events: EventInstance[] = []

	/**
	 * Miscellaneous trigger events helper
	 */
	readonly #miscEvents: TriggersEventMisc

	/**
	 * Basic trigger configuration
	 */
	options: TriggerOptions

	/**
	 * Timer based trigger events helper
	 */
	readonly #timerEvents: TriggersEventTimer

	/**
	 * Variables based trigger events helper
	 */
	readonly #variablesEvents: TriggersEventVariables

	/**
	 * Whether this button has delayed actions running
	 */
	has_actions_running: boolean = false

	readonly actions: FragmentActions
	readonly feedbacks: FragmentFeedbacks

	/**
	 * @param registry - the application core
	 * @param eventBus - the main trigger event bus
	 * @param controlId - id of the control
	 * @param storage - persisted storage object
	 * @param isImport - if this is importing a button, not creating at startup
	 */
	constructor(
		deps: ControlDependencies,
		eventBus: TriggerEvents,
		controlId: string,
		storage: TriggerModel | null,
		isImport: boolean
	) {
		super(deps, controlId, `Controls/ControlTypes/Triggers/${controlId}`)

		this.actions = new FragmentActions(
			deps.internalModule,
			deps.instance.moduleHost,
			controlId,
			this.commitChange.bind(this)
		)
		this.feedbacks = new FragmentFeedbacks(
			deps.instance.definitions,
			deps.internalModule,
			deps.instance.moduleHost,
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
			this.feedbacks.loadStorage(storage.condition || [], true, isImport)
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
	 */
	actionAdd(_stepId: string, _setId: string, actionItem: ActionInstance): boolean {
		return this.actions.actionAdd('0', actionItem)
	}

	/**
	 * Append some actions to this button
	 */
	actionAppend(_stepId: string, _setId: string, newActions: ActionInstance[]): boolean {
		return this.actions.actionAppend('0', newActions)
	}

	/**
	 * Learn the options for an action, by asking the instance for the current values
	 */
	async actionLearn(_stepId: string, _setId: string, id: string): Promise<boolean> {
		return this.actions.actionLearn('0', id)
	}

	/**
	 * Enable or disable an action
	 */
	actionEnabled(_stepId: string, _setId: string, id: string, enabled: boolean): boolean {
		return this.actions.actionEnabled('0', id, enabled)
	}

	/**
	 * Set action headline
	 */
	actionHeadline(_stepId: string, _setId: string, id: string, headline: string): boolean {
		return this.actions.actionHeadline('0', id, headline)
	}

	/**
	 * Remove an action from this control
	 */
	actionRemove(_stepId: string, _setId: string, id: string): boolean {
		return this.actions.actionRemove('0', id)
	}

	/**
	 * Duplicate an action on this control
	 */
	actionDuplicate(_stepId: string, _setId: string, id: string): string | null {
		return this.actions.actionDuplicate('0', id)
	}

	/**
	 * Remove an action from this control
	 */
	actionReplace(newProps: Pick<ActionInstance, 'id' | 'action' | 'options'>, skipNotifyModule = false): boolean {
		return this.actions.actionReplace(newProps, skipNotifyModule)
	}

	/**
	 * Replace all the actions in a set
	 */
	actionReplaceAll(_stepId: string, _setId: string, newActions: ActionInstance[]): boolean {
		return this.actions.actionReplaceAll('0', newActions)
	}

	/**
	 * Set the connection of an action
	 */
	actionSetConnection(_stepId: string, _setId: string, id: string, connectionId: string): boolean {
		return this.actions.actionSetConnection('0', id, connectionId)
	}

	/**
	 * Set the delay of an action
	 */
	actionSetDelay(_stepId: string, _setId: string, id: string, delay: number): boolean {
		return this.actions.actionSetDelay('0', id, delay)
	}

	/**
	 * Set an option of an action
	 */
	actionSetOption(_stepId: string, _setId: string, id: string, key: string, value: any): boolean {
		return this.actions.actionSetOption('0', id, key, value)
	}

	/**
	 * Reorder an action in the list or move between sets
	 * @param _dragStepId
	 * @param _dragSetId the action_set id to remove from
	 * @param dragActionId the id of the action to move
	 * @param _dropStepId
	 * @param _dropSetId the target action_set of the action
	 * @param dropIndex the target index of the action
	 */
	actionReorder(
		_dragStepId: string,
		_dragSetId: string,
		dragActionId: string,
		_dropStepId: string,
		_dropSetId: string,
		dropIndex: number
	): boolean {
		const set = this.actions.action_sets['0']
		if (set) {
			const dragIndex = set.findIndex((a) => a.id === dragActionId)
			if (dragIndex === -1) return false

			dropIndex = clamp(dropIndex, 0, set.length)

			set.splice(dropIndex, 0, ...set.splice(dragIndex, 1))

			this.commitChange(false)

			return true
		}

		return false
	}

	/**
	 * Remove any tracked state for a connection
	 */
	clearConnectionState(connectionId: string): void {
		this.feedbacks.clearConnectionState(connectionId)
	}

	/**
	 * Execute the actions of this trigger
	 * @param nowTime
	 * @param isTest Whether this is a 'test' execution from the ui and should skip condition checks
	 */
	executeActions(nowTime: number, isTest = false): void {
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

			this.deps.actionRunner.runMultipleActions(actions, this.controlId, this.options.relativeDelay, {
				surfaceId: this.controlId,
			})
		}
	}

	/**
	 * Get all the actions on this control
	 */
	getAllActions(): ActionInstance[] {
		const actions: ActionInstance[] = []

		for (const set of Object.values(this.actions.action_sets)) {
			if (set) actions.push(...set)
		}

		return actions
	}

	/**
	 * Collect the instance ids and labels referenced by this control
	 * @param foundConnectionIds - instance ids being referenced
	 * @param foundConnectionLabels - instance labels being referenced
	 */
	collectReferencedConnections(foundConnectionIds: Set<string>, foundConnectionLabels: Set<string>) {
		const allFeedbacks = this.feedbacks.getAllFeedbacks()
		const allActions = this.actions.getAllActions()

		for (const feedback of allFeedbacks) {
			foundConnectionIds.add(feedback.connectionId)
		}
		for (const action of allActions) {
			foundConnectionIds.add(action.instance)
		}

		const visitor = new VisitorReferencesCollector(foundConnectionIds, foundConnectionLabels)

		ReferencesVisitors.visitControlReferences(
			this.deps.internalModule,
			visitor,
			undefined,
			allActions,
			[],
			allFeedbacks,
			this.events
		)
	}

	/**
	 * Inform the control that it has been moved, and anything relying on its location must be invalidated
	 */
	triggerLocationHasChanged(): void {
		this.feedbacks.resubscribeAllFeedbacks('internal')
	}

	/**
	 * Convert this control to JSON
	 * To be sent to the client and written to the db
	 * @param clone - Whether to return a cloned object
	 */
	toJSON(clone = true): TriggerModel {
		const obj: TriggerModel = {
			type: this.type,
			options: this.options,
			action_sets: this.actions.action_sets,
			condition: this.feedbacks.getAllFeedbackInstances(),
			events: this.events,
		}
		return clone ? cloneDeep(obj) : obj
	}

	toTriggerJSON(): ClientTriggerData {
		const eventStrings: string[] = []
		for (const event of this.events) {
			if (event.enabled) {
				switch (event.type) {
					case 'interval':
						eventStrings.push(this.#timerEvents.getIntervalDescription(event))
						break
					case 'timeofday':
						eventStrings.push(this.#timerEvents.getTimeOfDayDescription(event))
						break
					case 'specificDate':
						eventStrings.push(this.#timerEvents.getSpecificDateDescription(event))
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
	 */
	forgetConnection(connectionId: string): void {
		const changedFeedbacks = this.feedbacks.forgetConnection(connectionId)
		const changedActions = this.actions.forgetConnection(connectionId)

		if (changedFeedbacks || changedActions) {
			this.commitChange(changedFeedbacks)
		}
	}

	/**
	 * Start or stop the trigger from running
	 */
	#setupEvents(): void {
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
	 * @param labelFrom - the old instance short name
	 * @param labelTo - the new instance short name
	 * @access public
	 */
	renameVariables(labelFrom: string, labelTo: string): void {
		const allFeedbacks = this.feedbacks.getAllFeedbacks()
		const allActions = this.actions.getAllActions()

		// Fix up references
		const changed = ReferencesVisitors.fixupControlReferences(
			this.deps.internalModule,
			{ connectionLabels: { [labelFrom]: labelTo } },
			undefined,
			allActions,
			[],
			allFeedbacks,
			this.events,
			true
		)

		// 'redraw' if needed and save changes
		this.commitChange(changed)
	}

	#restartEvent(event: EventInstance): void {
		if (event.enabled) {
			switch (event.type) {
				case 'interval':
					this.#timerEvents.setInterval(event.id, Number(event.options.seconds))
					break
				case 'timeofday':
					this.#timerEvents.setTimeOfDay(event.id, event.options)
					break
				case 'specificDate':
					this.#timerEvents.setSpecificDate(event.id, event.options)
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
	 * @param running Whether any delayed actions are pending
	 * @param skip_up Mark the button as released, skipping the release actions
	 * @access public
	 */
	setActionsRunning(_running: boolean, _skip_up: boolean) {
		// Nothing to do
	}

	#stopEvent(event: EventInstance): void {
		switch (event.type) {
			case 'interval':
				this.#timerEvents.clearInterval(event.id)
				break
			case 'timeofday':
				this.#timerEvents.clearTimeOfDay(event.id)
				break
			case 'specificDate':
				this.#timerEvents.clearSpecificDate(event.id)
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
	 */
	optionsSetField(key: string, value: number, forceSet?: boolean): boolean {
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
	 */
	postProcessImport(): void {
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
	 */
	verifyConnectionIds(knownConnectionIds: Set<string>): void {
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
	 */
	#sendTriggerJsonChange(): void {
		const newJson = cloneDeep(this.toTriggerJSON())

		if (this.deps.io.countRoomMembers(TriggersListRoom) > 0) {
			if (this.#lastSentTriggerJson) {
				const patch = jsonPatch.compare(this.#lastSentTriggerJson || {}, newJson || {})
				if (patch.length > 0) {
					this.deps.io.emitToRoom(TriggersListRoom, `triggers:update`, {
						type: 'update',
						controlId: this.controlId,
						patch,
					})
				}
			} else {
				this.deps.io.emitToRoom(TriggersListRoom, `triggers:update`, {
					type: 'add',
					controlId: this.controlId,
					info: newJson,
				})
			}
		}

		this.#lastSentTriggerJson = newJson
	}

	commitChange(redraw = true): void {
		super.commitChange(redraw)

		this.#sendTriggerJsonChange()
	}

	destroy(): void {
		this.#timerEvents.destroy()
		this.#miscEvents.destroy()
		this.#variablesEvents.destroy()

		this.#eventBus.emit('trigger_enabled', this.controlId, false)

		this.actions.destroy()
		this.feedbacks.destroy()

		super.destroy()

		if (this.deps.io.countRoomMembers(TriggersListRoom) > 0) {
			this.deps.io.emitToRoom(TriggersListRoom, `triggers:update`, {
				type: 'remove',
				controlId: this.controlId,
			})
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
	 */
	eventAdd(eventItem: EventInstance): boolean {
		this.events.push(eventItem)

		// Inform relevant module
		this.#restartEvent(eventItem)

		this.commitChange(false)

		return true
	}

	/**
	 * Duplicate an event on this control
	 */
	eventDuplicate(id: string): boolean {
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
	 */
	eventEnabled(id: string, enabled: boolean): boolean {
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
	 */
	eventHeadline(id: string, headline: string): boolean {
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
	 */
	eventRemove(id: string): boolean {
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
	 * @param oldIndex the index of the event to move
	 * @param newIndex the target index of the event
	 */
	eventReorder(oldIndex: number, newIndex: number): boolean {
		oldIndex = clamp(oldIndex, 0, this.events.length)
		newIndex = clamp(newIndex, 0, this.events.length)
		this.events.splice(newIndex, 0, ...this.events.splice(oldIndex, 1))

		this.commitChange(false)

		return true
	}

	/**
	 * Update an option for an event
	 */
	eventSetOptions(id: string, key: string, value: any): boolean {
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

	/**
	 * Execute a press of this control
	 */
	pressControl(_pressed: boolean, _surfaceId: string | undefined): void {
		// Nothing to do
	}
	getBitmapSize() {
		return null
	}
}

import ControlBase from './ControlBase.js'
import FragmentFeedbacks from './Fragments/FragmentFeedbacks.js'

/**
 * @typedef {ControlBase & (ControlWithSteps | ControlWithoutSteps) & (ControlWithStyle | ControlWithoutStyle) & (ControlWithFeedbacks | ControlWithoutFeedbacks) & (ControlWithActions | ControlWithoutActions) & (ControlWithEvents | ControlWithoutEvents) & (ControlWithActionSets | ControlWithoutActionSets) & (ControlWithOptions | ControlWithoutOptions) & (ControlWithPushed | ControlWithoutPushed)} SomeControl
 */

/**
 * @typedef {import('../Shared/Model/ActionModel.js').ActionInstance} ActionInstance
 * @typedef {import('../Shared/Model/FeedbackModel.js').FeedbackInstance} FeedbackInstance
 * @typedef {import('../Shared/Model/EventModel.js').EventInstance} EventInstance
 */

/**
 * @interface
 */
export class ControlWithSteps extends ControlBase {
	/**
	 * @readonly
	 * @type {true}
	 * @access public
	 */
	supportsSteps = true

	/**
	 * Get the index of the current (next to execute) step
	 * @returns {number} The index of current step
	 * @access public
	 */
	getActiveStepIndex() {
		throw new Error('Not implemented')
	}

	/**
	 * Add a step to this control
	 * @returns {string} Id of new step
	 * @access public
	 */
	stepAdd() {
		throw new Error('Not implemented')
	}

	/**
	 * Progress through the action-sets
	 * @param {number} _amount Number of steps to progress
	 * @returns {boolean} success
	 * @access public
	 */
	stepAdvanceDelta(_amount) {
		throw new Error('Not implemented')
	}

	/**
	 * Set the current (next to execute) action-set by index
	 * @param {number} _index The step index to make the next
	 * @returns {boolean} success
	 */
	stepMakeCurrent(_index) {
		throw new Error('Not implemented')
	}

	/**
	 * Remove an action-set from this control
	 * @param {string} _stepId the id of the action-set
	 * @returns {boolean} success
	 * @access public
	 */
	stepRemove(_stepId) {
		throw new Error('Not implemented')
	}

	/**
	 * Set the current (next to execute) action-set by id
	 * @param {string} _stepId The step id to make the next
	 * @returns {boolean} success
	 * @access public
	 */
	stepSelectCurrent(_stepId) {
		throw new Error('Not implemented')
	}

	/**
	 * Swap two action-sets
	 * @param {string} _stepId1 One of the action-sets
	 * @param {string} _stepId2 The other action-set
	 * @returns {boolean} success
	 * @access public
	 */
	stepSwap(_stepId1, _stepId2) {
		throw new Error('Not implemented')
	}
}

/**
 * @interface
 */
export class ControlWithoutSteps extends ControlBase {
	/**
	 * @readonly
	 * @type {false}
	 * @access public
	 */
	supportsSteps = false
}

/**
 * @interface
 */
export class ControlWithStyle extends ControlBase {
	/**
	 * @readonly
	 * @type {true}
	 * @access public
	 */
	supportsStyle = true

	/**
	 * The current status of this button
	 * @type {'good' | 'warning' | 'error'}
	 * @access protected
	 */
	button_status = 'good'

	/**
	 * Update the style fields of this control
	 * @param {object} _diff - config diff to apply
	 * @returns {boolean} true if any changes were made
	 * @access public
	 */
	styleSetFields(_diff) {
		throw new Error('Not implemented')
	}

	/**
	 * Propagate variable changes
	 * @param {Set<string>} _allChangedVariables - variables with changes
	 * @access public
	 */
	onVariablesChanged(_allChangedVariables) {
		throw new Error('Not implemented')
	}
}

/**
 * @interface
 */
export class ControlWithoutStyle extends ControlBase {
	/**
	 * @readonly
	 * @type {false}
	 * @access public
	 */
	supportsStyle = false
}

/**
 * @interface
 */
export class ControlWithFeedbacks extends ControlBase {
	/**
	 * @readonly
	 * @type {true}
	 * @access public
	 */
	supportsFeedbacks = true

	/**
	 * @type {FragmentFeedbacks}
	 * @access public
	 * @readonly
	 */
	feedbacks

	/**
	 * Remove any tracked state for an connection
	 * @param {string} _connectionId
	 * @returns {void}
	 * @access public
	 */
	clearConnectionState(_connectionId) {
		throw new Error('Not implemented')
	}

	/**
	 * Update all controls to forget an connection
	 * @param {string} _connectionId
	 * @returns {void}
	 * @access public
	 */
	forgetConnection(_connectionId) {
		throw new Error('Not implemented')
	}
}

/**
 * @interface
 */
export class ControlWithoutFeedbacks extends ControlBase {
	/**
	 * @readonly
	 * @type {false}
	 * @access public
	 */
	supportsFeedbacks = false
}

/**
 * @interface
 */
export class ControlWithActions extends ControlBase {
	/**
	 * @readonly
	 * @type {true}
	 * @access public
	 */
	supportsActions = true

	/**
	 * Whether this button has delayed actions running
	 * @access protected
	 */
	has_actions_running = false

	/**
	 * Add an action to this control
	 * @param {string} _stepId
	 * @param {string} _setId
	 * @param {ActionInstance} _actionItem
	 * @returns {boolean} success
	 * @access public
	 */
	actionAdd(_stepId, _setId, _actionItem) {
		throw new Error('Not implemented')
	}

	/**
	 * Append some actions to this button
	 * @param {string} _stepId
	 * @param {string} _setId the action_set id to update
	 * @param {ActionInstance[]} _newActions actions to append
	 * @returns {boolean}
	 * @access public
	 */
	actionAppend(_stepId, _setId, _newActions) {
		throw new Error('Not implemented')
	}

	/**
	 * Duplicate an action on this control
	 * @param {string} _stepId
	 * @param {string} _setId
	 * @param {string} _id
	 * @returns {boolean} success
	 * @access public
	 */
	actionDuplicate(_stepId, _setId, _id) {
		throw new Error('Not implemented')
	}

	/**
	 * Enable or disable an action
	 * @param {string} _stepId
	 * @param {string} _setId
	 * @param {string} _id
	 * @param {boolean} _enabled
	 * @returns {boolean}
	 * @access public
	 */
	actionEnabled(_stepId, _setId, _id, _enabled) {
		throw new Error('Not implemented')
	}

	/**
	 * Set action headline
	 * @param {string} _stepId
	 * @param {string} _setId
	 * @param {string} _id
	 * @param {string} _headline
	 * @returns {boolean}
	 * @access public
	 */
	actionHeadline(_stepId, _setId, _id, _headline) {
		throw new Error('Not implemented')
	}

	/**
	 * Learn the options for an action, by asking the connection for the current values
	 * @param {string} _stepId
	 * @param {string} _setId the id of the action set
	 * @param {string} _id the id of the action
	 * @returns {Promise<boolean>} success
	 * @access public
	 */
	async actionLearn(_stepId, _setId, _id) {
		throw new Error('Not implemented')
	}

	/**
	 * Remove an action from this control
	 * @param {string} _stepId
	 * @param {string} _setId the id of the action set
	 * @param {string} _id the id of the action
	 * @returns {boolean} success
	 * @access public
	 */
	actionRemove(_stepId, _setId, _id) {
		throw new Error('Not implemented')
	}

	/**
	 * Reorder an action in the list or move between sets
	 * @param {string} _dragStepId
	 * @param {string} _dragSetId the action_set id to remove from
	 * @param {number} _dragIndex the index of the action to move
	 * @param {string} _dropStepId
	 * @param {string} _dropSetId the target action_set of the action
	 * @param {number} _dropIndex the target index of the action
	 * @returns {boolean} success
	 * @access public
	 */
	actionReorder(_dragStepId, _dragSetId, _dragIndex, _dropStepId, _dropSetId, _dropIndex) {
		throw new Error('Not implemented')
	}

	/**
	 * Remove an action from this control
	 * @param {Pick<ActionInstance, 'id' | 'action' | 'options'>} _newProps
	 * @access public
	 */
	actionReplace(_newProps, _skipNotifyModule = false) {
		throw new Error('Not implemented')
	}

	/**
	 * Replace all the actions in a set
	 * @param {string} _stepId
	 * @param {string} _setId the action_set id to update
	 * @param {ActionInstance[]} _newActions actions to populate
	 * @returns {boolean}
	 * @access public
	 */
	actionReplaceAll(_stepId, _setId, _newActions) {
		throw new Error('Not implemented')
	}

	/**
	 * Set the delay of an action
	 * @param {string} _stepId
	 * @param {string} _setId the action_set id
	 * @param {string} _id the action id
	 * @param {number} _delay the desired delay
	 * @returns {boolean} success
	 * @access public
	 */
	actionSetDelay(_stepId, _setId, _id, _delay) {
		throw new Error('Not implemented')
	}

	/**
	 * Set an opton of an action
	 * @param {string} _stepId
	 * @param {string} _setId the action_set id
	 * @param {string} _id the action id
	 * @param {string} _key the desired option to set
	 * @param {any} _value the new value of the option
	 * @returns {boolean} success
	 * @access public
	 */
	actionSetOption(_stepId, _setId, _id, _key, _value) {
		throw new Error('Not implemented')
	}

	/**
	 * Remove any tracked state for a connection
	 * @param {string} _connectionId
	 * @returns {void}
	 * @access public
	 */
	clearConnectionState(_connectionId) {
		throw new Error('Not implemented')
	}

	/**
	 * Update all controls to forget a connection
	 * @param {string} _connectionId
	 * @returns {void}
	 * @access public
	 */
	forgetConnection(_connectionId) {
		throw new Error('Not implemented')
	}

	/**
	 * Get all the actions on this control
	 * @returns {ActionInstance[]}
	 */
	getAllActions() {
		throw new Error('Not implemented')
	}

	/**
	 * Mark the button as having pending delayed actions
	 * @param {boolean} _running Whether any delayed actions are pending
	 * @param {boolean} _skip_up Mark the button as released, skipping the release actions
	 * @access public
	 */
	setActionsRunning(_running, _skip_up) {
		throw new Error('Not implemented')
	}
}

/**
 * @interface
 */
export class ControlWithoutActions extends ControlBase {
	/**
	 * @readonly
	 * @type {false}
	 * @access public
	 */
	supportsActions = false
}

/**
 * @interface
 */
export class ControlWithEvents extends ControlBase {
	/**
	 * @readonly
	 * @type {true}
	 * @access public
	 */
	supportsEvents = true

	/**
	 * Add an event to this control
	 * @param {EventInstance} _eventItem the item to add
	 * @returns {boolean} success
	 * @access public
	 */
	eventAdd(_eventItem) {
		throw new Error('Not implemented')
	}

	/**
	 * Duplicate an event on this control
	 * @param {string} _id
	 * @returns {boolean} success
	 * @access public
	 */
	eventDuplicate(_id) {
		throw new Error('Not implemented')
	}

	/**
	 * Enable or disable an event
	 * @param {string} _id
	 * @param {boolean} _enabled
	 * @returns {boolean} success
	 */
	eventEnabled(_id, _enabled) {
		throw new Error('Not implemented')
	}

	/**
	 * Set event headline
	 * @param {string} _id
	 * @param {string} _headline
	 * @returns {boolean}
	 * @access public
	 */
	eventHeadline(_id, _headline) {
		throw new Error('Not implemented')
	}

	/**
	 * Remove an event from this control
	 * @param {string} _id the id of the event
	 * @returns {boolean} success
	 * @access public
	 */
	eventRemove(_id) {
		throw new Error('Not implemented')
	}

	/**
	 * Reorder an event in the list
	 * @param {number} _oldIndex the index of the event to move
	 * @param {number} _newIndex the target index of the event
	 * @returns {boolean}
	 * @access public
	 */
	eventReorder(_oldIndex, _newIndex) {
		throw new Error('Not implemented')
	}

	/**
	 * Update an option for an event
	 * @param {string} _id the id of the event
	 * @param {string} _key the key/name of the property
	 * @param {any} _value the new value
	 * @returns {boolean} success
	 * @access public
	 */
	eventSetOptions(_id, _key, _value) {
		throw new Error('Not implemented')
	}
}

/**
 * @interface
 */
export class ControlWithoutEvents extends ControlBase {
	/**
	 * @readonly
	 * @type {false}
	 * @access public
	 */
	supportsEvents = false
}

/**
 * @interface
 */
export class ControlWithActionSets extends ControlBase {
	/**
	 * @readonly
	 * @type {true}
	 * @access public
	 */
	supportsActionSets = true

	/**
	 * Add an action set to this control
	 * @param {string} _stepId
	 * @returns {boolean} success
	 * @access public
	 */
	actionSetAdd(_stepId) {
		throw new Error('Not implemented')
	}

	/**
	 * Remove an action-set from this control
	 * @param {string} _stepId
	 * @param {string} _setId the id of the action-set
	 * @returns {boolean} success
	 * @access public
	 */
	actionSetRemove(_stepId, _setId) {
		throw new Error('Not implemented')
	}

	/**
	 * Rename an action-sets
	 * @param {string} _stepId
	 * @param {string} _oldSetId The old id of the set
	 * @param {string} _newSetId The new id for the set
	 * @returns {boolean} success
	 * @access public
	 */
	actionSetRename(_stepId, _oldSetId, _newSetId) {
		throw new Error('Not implemented')
	}

	/**
	 * @param {string} _stepId
	 * @param {string} _setId
	 * @param {boolean} _runWhileHeld
	 * @returns {boolean}
	 * @access public
	 */
	actionSetRunWhileHeld(_stepId, _setId, _runWhileHeld) {
		throw new Error('Not implemented')
	}

	/**
	 * Execute a rotate of this control
	 * @param {boolean} _direction Whether the control was rotated to the right
	 * @param {string | undefined} _surfaceId The surface that intiated this rotate
	 * @access public
	 */
	rotateControl(_direction, _surfaceId) {
		throw new Error('Not implemented')
	}
}

/**
 * @interface
 */
export class ControlWithoutActionSets extends ControlBase {
	/**
	 * @readonly
	 * @type {false}
	 * @access public
	 */
	supportsActionSets = false
}

/**
 * @interface
 */
export class ControlWithOptions extends ControlBase {
	/**
	 * @readonly
	 * @type {true}
	 * @access public
	 */
	supportsOptions = true

	/**
	 * @type {Record<string, any>}
	 * @access public
	 */
	options

	/**
	 * Update an option field of this control
	 * @access public
	 * @param {string} _key
	 * @param {any} _value
	 * @param {boolean=} _forceSet
	 * @returns {boolean}
	 */
	optionsSetField(_key, _value, _forceSet) {
		throw new Error('Not implemented')
	}
}

/**
 * @interface
 */
export class ControlWithoutOptions extends ControlBase {
	/**
	 * @readonly
	 * @type {false}
	 * @access public
	 */
	supportsOptions = false
}

/**
 * @interface
 */
export class ControlWithPushed extends ControlBase {
	/**
	 * @readonly
	 * @type {true}
	 * @access public
	 */
	supportsPushed = true

	/**
	 * @type {boolean}
	 * @access public
	 */
	pushed

	/**
	 * Set the button as being pushed.
	 * Notifies interested observers
	 * @param {boolean} _direction new state
	 * @param {string=} _surfaceId device which triggered the change
	 * @returns {boolean} the pushed state changed
	 * @access public
	 */
	setPushed(_direction, _surfaceId) {
		throw new Error('Not implemented')
	}
}

/**
 * @interface
 */
export class ControlWithoutPushed extends ControlBase {
	/**
	 * @readonly
	 * @type {false}
	 * @access public
	 */
	supportsPushed = false
}

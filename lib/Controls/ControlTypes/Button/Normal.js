import ButtonControlBase from './Base.js'
import { cloneDeep } from 'lodash-es'
import FragmentActions from '../../Fragments/FragmentActions.js'
import { clamp } from '../../../Resources/Util.js'
import { GetStepIds } from '../../../Shared/Controls.js'
import { VisitorReferencesCollector } from '../../../Util/Visitors/ReferencesCollector.js'
import {
	ControlWithActionSets,
	ControlWithActions,
	ControlWithSteps,
	ControlWithoutEvents,
} from '../../IControlFragments.js'

/**
 * @typedef {import('../../../Shared/Model/ActionModel.js').ActionInstance} ActionInstance
 * @typedef {import('../../../Shared/Model/FeedbackModel.js').FeedbackInstance} FeedbackInstance
 */

/**
 * Class for the stepped button control.
 *
 * @extends ButtonControlBase
 * @implements {ControlWithSteps}
 * @implements {ControlWithActions}
 * @implements {ControlWithoutEvents}
 * @implements {ControlWithActionSets}
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
export default class ControlButtonNormal extends ButtonControlBase {
	/**
	 * @readonly
	 */
	type = 'button'

	/**
	 * @readonly
	 * @type {true}
	 */
	supportsActions = true
	/**
	 * @readonly
	 * @type {true}
	 */
	supportsSteps = true
	/**
	 * @readonly
	 * @type {false}
	 */
	supportsEvents = false
	/**
	 * @readonly
	 * @type {true}
	 */
	supportsActionSets = true

	/**
	 * The defaults options for a step
	 * @type {import('../../../Shared/Model/ActionModel.js').ActionStepOptions}
	 * @access public
	 * @static
	 */
	static DefaultStepOptions = {
		runWhileHeld: [], // array of set ids
	}

	/**
	 * The id of the currently selected (next to be executed) step
	 * @access private
	 */
	#current_step_id = '0'

	/**
	 * Button hold state for each surface
	 * @type {Map<string, SurfaceHoldState>}
	 * @access private
	 */
	#surfaceHoldState = new Map()

	/**
	 * Steps on this button
	 * @access public
	 * @type {Record<string, FragmentActions>}
	 */
	steps

	/**
	 * The config of this button
	 * @type {import('../../../Shared/Model/ButtonModel.js').NormalButtonOptions}
	 */
	options

	/**
	 * @param {import('../../../Registry.js').default} registry - the application core
	 * @param {string} controlId - id of the control
	 * @param {import('../../../Shared/Model/ButtonModel.js').NormalButtonModel | null} storage - persisted storage object
	 * @param {boolean} isImport - if this is importing a button, not creating at startup
	 */
	constructor(registry, controlId, storage, isImport) {
		super(registry, controlId, 'stepped-button', 'Controls/Button/Normal')

		this.options = {
			...cloneDeep(ButtonControlBase.DefaultOptions),
			rotaryActions: false,
			stepAutoProgress: true,
		}
		this.steps = {
			0: this.#getNewStepValue(),
		}
		this.#current_step_id = '0'

		if (!storage) {
			// New control

			// Save the change
			this.commitChange()
			this.sendRuntimePropsChange()
		} else {
			if (storage.type !== 'button') throw new Error(`Invalid type given to ControlButtonStep: "${storage.type}"`)

			this.options = Object.assign(this.options, storage.options || {})
			this.feedbacks.baseStyle = Object.assign(this.feedbacks.baseStyle, storage.style || {})
			this.feedbacks.feedbacks = storage.feedbacks || this.feedbacks.feedbacks

			if (storage.steps) {
				this.steps = {}
				for (const [id, stepObj] of Object.entries(storage.steps)) {
					this.steps[id] = this.#getNewStepValue(stepObj.action_sets, stepObj.options)
				}
			}

			this.#current_step_id = GetStepIds(this.steps)[0]

			// Ensure control is stored before setup
			if (isImport) setImmediate(() => this.postProcessImport())
		}
	}

	/**
	 * Abort any running 'while held' timers
	 * @access protected
	 * @param {string | undefined} surfaceId
	 * @returns {void}
	 */
	abortRunningHoldTimers(surfaceId) {
		if (surfaceId) {
			const existingState = this.#surfaceHoldState.get(surfaceId)
			if (existingState) {
				// Cancel any pending 'runWhileHeld' timers
				for (const timer of existingState.timers) {
					clearTimeout(timer)
				}
			}
			this.#surfaceHoldState.delete(surfaceId)
		} else {
			for (const holdState of this.#surfaceHoldState.values()) {
				if (holdState) {
					// Cancel any pending 'runWhileHeld' timers
					for (const timer of holdState.timers) {
						clearTimeout(timer)
					}
				}
			}
			this.#surfaceHoldState.clear()
		}
	}

	/**
	 * Add an action to this control
	 * @param {string} stepId
	 * @param {string} setId
	 * @param {ActionInstance} actionItem
	 * @returns {boolean} success
	 * @access public
	 */
	actionAdd(stepId, setId, actionItem) {
		const step = this.steps[stepId]
		if (step) {
			return step.actionAdd(setId, actionItem)
		} else {
			return false
		}
	}

	/**
	 * Append some actions to this button
	 * @param {string} stepId
	 * @param {string} setId the action_set id to update
	 * @param {ActionInstance[]} newActions actions to append
	 * @access public
	 */
	actionAppend(stepId, setId, newActions) {
		const step = this.steps[stepId]
		if (step) {
			return step.actionAppend(setId, newActions)
		} else {
			return false
		}
	}

	/**
	 * Duplicate an action on this control
	 * @param {string} stepId
	 * @param {string} setId
	 * @param {string} id
	 * @returns {boolean} success
	 * @access public
	 */
	actionDuplicate(stepId, setId, id) {
		const step = this.steps[stepId]
		if (step) {
			return step.actionDuplicate(setId, id)
		} else {
			return false
		}
	}

	/**
	 * Enable or disable an action
	 * @param {string} stepId
	 * @param {string} setId
	 * @param {string} id
	 * @param {boolean} enabled
	 * @access public
	 */
	actionEnabled(stepId, setId, id, enabled) {
		const step = this.steps[stepId]
		if (step) {
			return step.actionEnabled(setId, id, enabled)
		} else {
			return false
		}
	}

	/**
	 * Set action headline
	 * @param {string} stepId
	 * @param {string} setId
	 * @param {string} id
	 * @param {string} headline
	 * @returns {boolean}
	 * @access public
	 */
	actionHeadline(stepId, setId, id, headline) {
		const step = this.steps[stepId]
		if (step) {
			return step.actionHeadline(setId, id, headline)
		} else {
			return false
		}
	}

	/**
	 * Learn the options for an action, by asking the instance for the current values
	 * @param {string} stepId
	 * @param {string} setId the id of the action set
	 * @param {string} id the id of the action
	 * @returns {Promise<boolean>} success
	 * @access public
	 */
	async actionLearn(stepId, setId, id) {
		const step = this.steps[stepId]
		if (step) {
			return step.actionLearn(setId, id)
		} else {
			return false
		}
	}

	/**
	 * Remove an action from this control
	 * @param {string} stepId
	 * @param {string} setId the id of the action set
	 * @param {string} id the id of the action
	 * @returns {boolean} success
	 * @access public
	 */
	actionRemove(stepId, setId, id) {
		const step = this.steps[stepId]
		if (step) {
			return step.actionRemove(setId, id)
		} else {
			return false
		}
	}

	/**
	 * Reorder an action in the list or move between sets
	 * @param {string} dragStepId
	 * @param {string} dragSetId the action_set id to remove from
	 * @param {number} dragIndex the index of the action to move
	 * @param {string} dropStepId
	 * @param {string} dropSetId the target action_set of the action
	 * @param {number} dropIndex the target index of the action
	 * @returns {boolean} success
	 * @access public
	 */
	actionReorder(dragStepId, dragSetId, dragIndex, dropStepId, dropSetId, dropIndex) {
		const fromSet = this.steps[dragStepId]?.action_sets?.[dragSetId]
		const toSet = this.steps[dropStepId]?.action_sets?.[dropSetId]
		if (fromSet && toSet) {
			dragIndex = clamp(dragIndex, 0, fromSet.length)
			dropIndex = clamp(dropIndex, 0, toSet.length)

			toSet.splice(dropIndex, 0, ...fromSet.splice(dragIndex, 1))

			this.commitChange()

			return true
		}

		return false
	}

	/**
	 * Remove an action from this control
	 * @param {Pick<ActionInstance, 'id' | 'action' | 'options'>} newProps
	 * @access public
	 */
	actionReplace(newProps, skipNotifyModule = false) {
		for (const step of Object.values(this.steps)) {
			step.actionReplace(newProps, skipNotifyModule)
		}
	}

	/**
	 * Replace all the actions in a set
	 * @param {string} stepId
	 * @param {string} setId the action_set id to update
	 * @param {ActionInstance[]} newActions actions to populate
	 * @access public
	 */
	actionReplaceAll(stepId, setId, newActions) {
		const step = this.steps[stepId]
		if (step) {
			return step.actionReplaceAll(setId, newActions)
		} else {
			return false
		}
	}

	/**
	 * Set the delay of an action
	 * @param {string} stepId
	 * @param {string} setId the action_set id
	 * @param {string} id the action id
	 * @param {number} delay the desired delay
	 * @returns {boolean} success
	 * @access public
	 */
	actionSetDelay(stepId, setId, id, delay) {
		const step = this.steps[stepId]
		if (step) {
			return step.actionSetDelay(setId, id, delay)
		} else {
			return false
		}
	}

	/**
	 * Set an opton of an action
	 * @param {string} stepId
	 * @param {string} setId the action_set id
	 * @param {string} id the action id
	 * @param {string} key the desired option to set
	 * @param {any} value the new value of the option
	 * @returns {boolean} success
	 * @access public
	 */
	actionSetOption(stepId, setId, id, key, value) {
		const step = this.steps[stepId]
		if (step) {
			return step.actionSetOption(setId, id, key, value)
		} else {
			return false
		}
	}

	/**
	 * Add an action set to this control
	 * @param {string} stepId
	 * @returns {boolean} success
	 * @access public
	 */
	actionSetAdd(stepId) {
		const step = this.steps[stepId]
		if (step) {
			let redraw = false

			const existingKeys = Object.keys(step.action_sets)
				.map((k) => Number(k))
				.filter((k) => !isNaN(k))
			if (existingKeys.length === 0) {
				// add the default '1000' set
				step.action_sets['1000'] = []
				redraw = true
			} else {
				// add one after the last
				const max = Math.max(...existingKeys)
				const newIndex = Math.floor(max / 1000) * 1000 + 1000
				step.action_sets[newIndex] = []
			}

			this.commitChange(redraw)

			return true
		}

		return false
	}

	/**
	 * Remove an action-set from this control
	 * @param {string} stepId
	 * @param {string} setId0 the id of the action-set
	 * @returns {boolean} success
	 * @access public
	 */
	actionSetRemove(stepId, setId0) {
		const setId = Number(setId0)

		// Ensure valid
		if (isNaN(setId)) return false

		const step = this.steps[stepId]
		if (step) {
			const oldKeys = Object.keys(step.action_sets)

			if (oldKeys.length > 1) {
				const action_set = step.action_sets[setId]
				if (action_set) {
					// Inform modules of the change
					for (const action of action_set) {
						step.cleanupAction(action)
					}

					// Forget the step from the options
					step.options.runWhileHeld = step.options.runWhileHeld.filter((id) => id !== Number(setId))

					// Assume it exists
					delete step.action_sets[setId]

					// Save the change, and perform a draw
					this.commitChange(false)

					return true
				}
			}

			return false
		}

		return false
	}

	/**
	 * Rename an action-sets
	 * @param {string} stepId
	 * @param {string} oldSetId0 The old id of the set
	 * @param {string} newSetId0 The new id for the set
	 * @returns {boolean} success
	 * @access public
	 */
	actionSetRename(stepId, oldSetId0, newSetId0) {
		const step = this.steps[stepId]
		if (step) {
			const newSetId = Number(newSetId0)
			const oldSetId = Number(oldSetId0)

			// Only valid when both are numbers
			if (isNaN(newSetId) || isNaN(oldSetId)) return false

			// Ensure old set exists
			if (!step.action_sets[oldSetId]) return false

			// Ensure new set doesnt already exist
			if (step.action_sets[newSetId]) return false

			step.action_sets[newSetId] = step.action_sets[oldSetId]
			delete step.action_sets[oldSetId]

			const runWhileHeldIndex = step.options.runWhileHeld.indexOf(Number(oldSetId))
			if (runWhileHeldIndex !== -1) {
				step.options.runWhileHeld[runWhileHeldIndex] = Number(newSetId)
			}

			this.commitChange(false)

			return true
		}

		return false
	}

	/**
	 * @param {string} stepId
	 * @param {string} setId0
	 * @param {boolean} runWhileHeld
	 * @returns {boolean}
	 * @access public
	 */
	actionSetRunWhileHeld(stepId, setId0, runWhileHeld) {
		const step = this.steps[stepId]
		if (step) {
			// Ensure it is a number
			const setId = Number(setId0)

			// Only valid when step is a number
			if (isNaN(setId)) return false

			// Ensure set exists
			if (!step.action_sets[setId]) return false

			const runWhileHeldIndex = step.options.runWhileHeld.indexOf(setId)
			if (runWhileHeld && runWhileHeldIndex === -1) {
				step.options.runWhileHeld.push(setId)
			} else if (!runWhileHeld && runWhileHeldIndex !== -1) {
				step.options.runWhileHeld.splice(runWhileHeldIndex, 1)
			}

			this.commitChange(false)

			return true
		}

		return false
	}

	/**
	 * Prepare this control for deletion
	 * @access public
	 */
	destroy() {
		this.abortRunningHoldTimers(undefined)

		super.destroy()
	}

	/**
	 * Get the index of the current (next to execute) step
	 * @returns {number} The index of current step
	 * @access public
	 */
	getActiveStepIndex() {
		const out = GetStepIds(this.steps).indexOf(this.#current_step_id)
		return out !== -1 ? out : 0
	}

	/**
	 * Get the complete style object of a button
	 * @returns {import('../../../Shared/Model/StyleModel.js').DrawStyleButtonModel} the processed style of the button
	 * @override
	 */
	getDrawStyle() {
		const style = super.getDrawStyle()
		if (!style) return style

		if (GetStepIds(this.steps).length > 1) {
			style.step_cycle = this.getActiveStepIndex() + 1
		}

		return style
	}

	/**
	 * @param {import('../../../Shared/Model/ActionModel.js').ActionSetsModel=} existingActions
	 * @param {import("../../../Shared/Model/ActionModel.js").ActionStepOptions=} existingOptions
	 */
	#getNewStepValue(existingActions, existingOptions) {
		/** @type {import('../../../Shared/Model/ActionModel.js').ActionSetsModel} */
		const action_sets = existingActions || {
			down: [],
			up: [],
		}

		const options = existingOptions || cloneDeep(ControlButtonNormal.DefaultStepOptions)

		action_sets.down = action_sets.down || []
		action_sets.up = action_sets.up || []

		if (this.options.rotaryActions) {
			action_sets.rotate_left = action_sets.rotate_left || []
			action_sets.rotate_right = action_sets.rotate_right || []
		}

		const actions = new FragmentActions(this.registry, this.controlId, this.commitChange.bind(this))

		actions.options = options
		actions.action_sets = action_sets

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
		const allActions = []

		for (const step of Object.values(this.steps)) {
			allActions.push(...step.getAllActions())
		}

		for (const feedback of allFeedbacks) {
			foundConnectionIds.add(feedback.instance_id)
		}
		for (const action of allActions) {
			foundConnectionIds.add(action.instance)
		}

		const visitor = new VisitorReferencesCollector(foundConnectionIds, foundConnectionLabels)

		this.registry.data.importExport.visitControlReferences(
			visitor,
			this.feedbacks.baseStyle,
			allActions,
			allFeedbacks,
			undefined
		)
	}

	/**
	 * Inform the control that it has been moved, and anything relying on its location must be invalidated
	 */
	triggerLocationHasChanged() {
		this.feedbacks.updateAllInternal()
	}

	/**
	 * Update an option field of this control
	 * @access public
	 * @param {string} key
	 * @param {any} value
	 * @returns {boolean}
	 */
	optionsSetField(key, value) {
		// Check if rotary_actions should be added/remove
		if (key === 'rotaryActions') {
			for (const step of Object.values(this.steps)) {
				if (value) {
					// ensure they exist
					step.action_sets.rotate_left = step.action_sets.rotate_left || []
					step.action_sets.rotate_right = step.action_sets.rotate_right || []
				} else {
					// remove the sets
					step.actionClearSet('rotate_left', true)
					step.actionClearSet('rotate_right', true)
					delete step.action_sets.rotate_left
					delete step.action_sets.rotate_right
				}
			}
		}

		return super.optionsSetField(key, value)
	}

	/**
	 * Execute a press of this control
	 * @param {boolean} pressed Whether the control is pressed
	 * @param {string | undefined} surfaceId The surface that intiated this press
	 * @param {boolean} force Trigger actions even if already in the state
	 * @returns {void}
	 * @access public
	 */
	pressControl(pressed, surfaceId, force) {
		const [this_step_id, next_step_id] = this.#validateCurrentStepId()

		let pressedDuration = 0
		let pressedStep = this_step_id
		/** @type {SurfaceHoldState | undefined} */
		let holdState = undefined
		if (surfaceId) {
			// Calculate the press duration, or track when the press started
			if (pressed) {
				this.abortRunningHoldTimers(surfaceId)

				holdState = {
					pressed: Date.now(),
					step: this_step_id,
					timers: [],
				}
				this.#surfaceHoldState.set(surfaceId, holdState)
			} else {
				const state = this.#surfaceHoldState.get(surfaceId)
				if (state) {
					pressedDuration = Date.now() - state.pressed
					pressedStep = state.step

					this.abortRunningHoldTimers(surfaceId)
				}
			}
		}

		const changed = this.setPushed(pressed, surfaceId)

		// if the state has changed, the choose the set to execute
		if (changed || force) {
			// progress to the next step, if there is one, and the step hasnt already been changed
			if (
				this_step_id !== null &&
				next_step_id !== null &&
				this.options.stepAutoProgress &&
				!pressed &&
				(pressedStep === undefined || this_step_id === pressedStep)
			) {
				// update what the new step will be
				this.#current_step_id = next_step_id

				this.sendRuntimePropsChange()
			}

			// Make sure to execute for the step that was active when the press started
			const step = pressedStep && this.steps[pressedStep]
			if (step) {
				/** @type {string | number} */
				let action_set_id = pressed ? 'down' : 'up'

				if (!pressed && pressedDuration) {
					// find the correct set to execute on up

					const setIds = Object.keys(step.action_sets)
						.map((id) => Number(id))
						.filter((id) => !isNaN(id) && id < pressedDuration)
					if (setIds.length) {
						action_set_id = Math.max(...setIds)
					}
				}

				/**
				 * @param {string | number} set_id
				 * @returns {void}
				 */
				const runActionSet = (set_id) => {
					const actions = step.action_sets[set_id]
					if (actions) {
						this.logger.silly('found actions')

						this.controls.actions.runMultipleActions(actions, this.controlId, this.options.relativeDelay, {
							surfaceId,
						})
					}
				}

				if (pressed && holdState && holdState.timers.length === 0) {
					// queue any 'runWhileHeld' timers
					const times = [...step.options.runWhileHeld].sort()

					for (const time of times) {
						holdState.timers.push(
							setTimeout(() => {
								try {
									runActionSet(time)
								} catch (e) {
									this.logger.warn(`hold actions execution failed: ${e}`)
								}
							}, time)
						)
					}
				}

				// Run the actions if it wasn't already run from being held
				if (typeof action_set_id !== 'number' || !step.options.runWhileHeld.includes(action_set_id)) {
					runActionSet(action_set_id)
				}
			}
		}
	}

	/**
	 * Execute a rotate of this control
	 * @param {boolean} direction Whether the control was rotated to the right
	 * @param {string | undefined} surfaceId The surface that intiated this rotate
	 * @access public
	 */
	rotateControl(direction, surfaceId) {
		const [this_step_id] = this.#validateCurrentStepId()

		const step = this_step_id && this.steps[this_step_id]
		if (step) {
			const action_set_id = direction ? 'rotate_right' : 'rotate_left'

			const actions = step.action_sets[action_set_id]
			if (actions) {
				this.logger.silly('found actions')

				const enabledActions = actions.filter((act) => !act.disabled)

				this.controls.actions.runMultipleActions(enabledActions, this.controlId, this.options.relativeDelay, {
					surfaceId,
				})
			}
		}
	}

	/**
	 * Add a step to this control
	 * @returns {string} Id of new step
	 * @access public
	 */
	stepAdd() {
		const existingKeys = GetStepIds(this.steps)
			.map((k) => Number(k))
			.filter((k) => !isNaN(k))
		if (existingKeys.length === 0) {
			// add the default '0' set
			this.steps['0'] = this.#getNewStepValue()

			this.commitChange(true)

			return '0'
		} else {
			// add one after the last
			const max = Math.max(...existingKeys)

			const stepId = `${max + 1}`
			this.steps[stepId] = this.#getNewStepValue()

			this.commitChange(true)

			return stepId
		}
	}

	/**
	 * Progress through the action-sets
	 * @param {number} amount Number of steps to progress
	 * @returns {boolean} success
	 * @access public
	 */
	stepAdvanceDelta(amount) {
		if (amount && typeof amount === 'number') {
			const all_steps = GetStepIds(this.steps)
			if (all_steps.length > 0) {
				const current = all_steps.indexOf(this.#current_step_id)

				let newIndex = (current === -1 ? 0 : current) + amount
				while (newIndex < 0) newIndex += all_steps.length
				newIndex = newIndex % all_steps.length

				const newStepId = all_steps[newIndex]
				return this.stepSelectCurrent(newStepId)
			}
		}

		return false
	}

	/**
	 * Set the current (next to execute) action-set by index
	 * @param {number} index The step index to make the next
	 * @returns {boolean} success
	 * @access public
	 */
	stepMakeCurrent(index) {
		if (typeof index === 'number') {
			const stepId = GetStepIds(this.steps)[index - 1]
			if (stepId !== undefined) {
				return this.stepSelectCurrent(stepId)
			}
		}

		return false
	}

	/**
	 * Remove an action-set from this control
	 * @param {string} stepId the id of the action-set
	 * @returns {boolean} success
	 * @access public
	 */
	stepRemove(stepId) {
		const oldKeys = GetStepIds(this.steps)

		if (oldKeys.length > 1) {
			if (this.steps[stepId]) {
				this.steps[stepId].destroy()
				delete this.steps[stepId]

				// Update the current step
				const oldIndex = oldKeys.indexOf(stepId)
				let newIndex = oldIndex + 1
				if (newIndex >= oldKeys.length) {
					newIndex = 0
				}
				if (newIndex !== oldIndex) {
					this.#current_step_id = oldKeys[newIndex]

					this.sendRuntimePropsChange()
				}

				// Save the change, and perform a draw
				this.commitChange(true)

				return true
			}
		}

		return false
	}

	/**
	 * Set the current (next to execute) action-set by id
	 * @param {string} stepId The step id to make the next
	 * @returns {boolean} success
	 * @access public
	 */
	stepSelectCurrent(stepId) {
		if (this.steps[stepId]) {
			// Ensure it isn't currently pressed
			// this.setPushed(false)

			this.#current_step_id = stepId

			this.sendRuntimePropsChange()

			this.triggerRedraw()

			return true
		}

		return false
	}

	/**
	 * Swap two action-sets
	 * @param {string} stepId1 One of the action-sets
	 * @param {string} stepId2 The other action-set
	 * @returns {boolean} success
	 * @access public
	 */
	stepSwap(stepId1, stepId2) {
		if (this.steps[stepId1] && this.steps[stepId2]) {
			const tmp = this.steps[stepId1]
			this.steps[stepId1] = this.steps[stepId2]
			this.steps[stepId2] = tmp

			this.commitChange(false)

			return true
		}

		return false
	}

	/**
	 * Convert this control to JSON
	 * To be sent to the client and written to the db
	 * @param {boolean} clone - Whether to return a cloned object
	 * @returns {import('../../../Shared/Model/ButtonModel.js').NormalButtonModel}
	 * @access public
	 */
	toJSON(clone = true) {
		/** @type {import('../../../Shared/Model/ButtonModel.js').NormalButtonSteps} */
		const stepsJson = {}
		for (const [id, step] of Object.entries(this.steps)) {
			stepsJson[id] = {
				action_sets: step.action_sets,
				options: step.options,
			}
		}

		/** @type {import('../../../Shared/Model/ButtonModel.js').NormalButtonModel} */
		const obj = {
			type: this.type,
			style: this.feedbacks.baseStyle,
			options: this.options,
			feedbacks: this.feedbacks.feedbacks,
			steps: stepsJson,
		}

		return clone ? cloneDeep(obj) : obj
	}

	/**
	 * Get any volatile properties for the control
	 * @access public
	 * @override
	 */
	toRuntimeJSON() {
		return {
			current_step_id: this.#current_step_id,
		}
	}

	/**
	 *
	 * @returns {[null, null] | [string, string]}
	 */
	#validateCurrentStepId() {
		const this_step_raw = this.#current_step_id
		const stepIds = GetStepIds(this.steps)
		if (stepIds.length > 0) {
			// verify 'this_step_raw' is valid
			const this_step_index = stepIds.findIndex((s) => s == this_step_raw) || 0
			const this_step_id = stepIds[this_step_index]

			// figure out the new step
			const next_index = this_step_index + 1 >= stepIds.length ? 0 : this_step_index + 1
			const next_step_id = stepIds[next_index]

			return [this_step_id, next_step_id]
		} else {
			return [null, null]
		}
	}
}

/**
 * @typedef {{
 *   pressed: number
 *   step: string | null
 *   timers: NodeJS.Timeout[]
 * }} SurfaceHoldState
 */

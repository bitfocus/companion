import ButtonControlBase from './Base.js'
import Registry from '../../../Registry.js'
import { cloneDeep } from 'lodash-es'

function stepsArrayToObject(stepsArray) {
	if (Array.isArray(stepsArray)) {
		const result = {}

		for (let i = 0; i < stepsArray.length; i++) {
			result[i] = stepsArray[i]
		}

		return result
	} else {
		return stepsArray
	}
}

/**
 * Class for the stepped button control.
 *
 * @extends ButtonControlBase
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
export default class ControlButtonStep extends ButtonControlBase {
	/**
	 * The id of the currently selected (next to be executed) step
	 * @access private
	 */
	#current_step_id = '0'

	/**
	 * Last down press from a deviceId
	 * @access private
	 */
	#lastDownForDevices = {}

	/**
	 * @param {Registry} registry - the application core
	 * @param {string} controlId - id of the control
	 * @param {object} storage - persisted storage object
	 * @param {boolean} isImport - if this is importing a button, not creating at startup
	 */
	constructor(registry, controlId, storage, isImport) {
		super(registry, controlId, 'stepped-button', 'Controls/Button/Step')

		this.type = 'step'

		this.style = cloneDeep(ButtonControlBase.DefaultStyle)
		this.options = {
			...cloneDeep(ButtonControlBase.DefaultOptions),
			stepAutoProgress: true,
		}
		this.feedbacks.feedbacks = []
		this.actions.action_sets = {
			0: [],
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
			if (storage.type !== 'step') throw new Error(`Invalid type given to ControlButtonStep: "${storage.type}"`)

			this.style = storage.style || this.style
			this.options = storage.options || this.options
			this.feedbacks.feedbacks = storage.feedbacks || this.feedbacks.feedbacks
			// this.actions.action_sets = storage.action_sets || this.actions.action_sets
			this.steps = stepsArrayToObject(storage.steps) || this.steps

			this.#current_step_id = Object.keys(this.steps)[0]

			if (isImport) this.postProcessImport()
		}
	}

	#getNewStepValue() {
		const step = {
			action_sets: {
				down: [],
				up: [],
			},
		}

		if (this.options.rotaryActions) {
			step.action_sets.rotate_left = []
			step.action_sets.rotate_right = []
		}

		return step
	}

	/**
	 * Add a step to this control
	 * @returns {boolean} success
	 * @access public
	 */
	stepAdd() {
		const existingKeys = Object.keys(this.steps)
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

			this.commitChange(false)

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
			const all_steps = Object.keys(this.steps)
			if (all_steps.length > 0) {
				const current = all_steps.indexOf(this.#current_step_id)

				let newIndex = (current === -1 ? 0 : current) + amount
				while (newIndex < 0) newIndex += all_steps.length
				newIndex = newIndex % all_steps.length

				const newStepId = all_steps[newIndex]
				return this.stepSelectNext(newStepId)
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
			const stepId = Object.keys(this.steps)[index - 1]
			if (stepId !== undefined) {
				return this.stepSelectNext(stepId)
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
		const oldKeys = Object.keys(this.steps)

		if (oldKeys.length > 1) {
			let redraw = false

			if (this.steps[stepId]) {
				// TODO
				// // Inform modules of the change
				// for (const action of this.steps.action_sets[stepId]) {
				// 	this.actions.cleanupAction(action)
				// }

				// Assume it exists
				delete this.steps[stepId]

				// Update the next step
				const oldIndex = oldKeys.indexOf(stepId)
				let newIndex = oldIndex + 1
				if (newIndex >= oldKeys.length) {
					newIndex = 0
				}
				if (newIndex !== oldIndex) {
					this.#current_step_id = oldKeys[newIndex]

					this.sendRuntimePropsChange()

					redraw = true
				}

				// Check if the status has changed
				if (this.checkButtonStatus()) redraw = true

				// Save the change, and perform a draw
				this.commitChange(redraw)

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
	stepSelectNext(stepId) {
		if (this.steps[stepId]) {
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

	// TODO - OLD below

	// /**
	//  * Add an action set to this control
	//  * @returns {boolean} success
	//  * @access public
	//  */
	// actionSetAdd() {
	// 	const existingKeys = Object.keys(this.actions.action_sets)
	// 		.map((k) => Number(k))
	// 		.filter((k) => !isNaN(k))
	// 	if (existingKeys.length === 0) {
	// 		// add the default '0' set
	// 		this.actions.action_sets['0'] = []

	// 		this.commitChange(true)

	// 		return '0'
	// 	} else {
	// 		// add one after the last
	// 		const max = Math.max(...existingKeys)

	// 		const id = `${max + 1}`
	// 		this.actions.action_sets[id] = []

	// 		this.commitChange(false)

	// 		return id
	// 	}
	// }

	// /**
	//  * Progress through the action-sets
	//  * @param {number} amount Number of steps to progress
	//  * @returns {boolean} success
	//  * @access public
	//  */
	// actionSetAdvanceDelta(amount) {
	// 	if (amount && typeof amount === 'number') {
	// 		const all_steps = Object.keys(this.actions.action_sets)
	// 		if (all_steps.length > 0) {
	// 			const current = all_steps.indexOf(this.#current_step_id)

	// 			let newIndex = (current === -1 ? 0 : current) + amount
	// 			while (newIndex < 0) newIndex += all_steps.length
	// 			newIndex = newIndex % all_steps.length

	// 			const newSetId = all_steps[newIndex]
	// 			return this.actionSetSelectNext(newSetId)
	// 		}
	// 	}

	// 	return false
	// }

	// /**
	//  * Set the current (next to execute) action-set by index
	//  * @param {number} index The step index to make the next
	//  * @returns {boolean} success
	//  * @access public
	//  */
	// actionSetMakeCurrent(index) {
	// 	if (typeof index === 'number') {
	// 		const setId = Object.keys(this.actions.action_sets)[index - 1]
	// 		if (setId !== undefined) {
	// 			return this.actionSetSelectNext(setId)
	// 		}
	// 	}

	// 	return false
	// }

	// /**
	//  * Remove an action-set from this control
	//  * @param {string} setId the id of the action-set
	//  * @returns {boolean} success
	//  * @access public
	//  */
	// actionSetRemove(setId) {
	// 	const oldKeys = Object.keys(this.actions.action_sets)

	// 	if (oldKeys.length > 1) {
	// 		let redraw = false

	// 		if (this.actions.action_sets[setId]) {
	// 			// Inform modules of the change
	// 			for (const action of this.actions.action_sets[setId]) {
	// 				this.actions.cleanupAction(action)
	// 			}

	// 			// Assume it exists
	// 			delete this.actions.action_sets[setId]

	// 			// Update the next step
	// 			const oldIndex = oldKeys.indexOf(setId)
	// 			let newIndex = oldIndex + 1
	// 			if (newIndex >= oldKeys.length) {
	// 				newIndex = 0
	// 			}
	// 			if (newIndex !== oldIndex) {
	// 				this.#current_step_id = oldKeys[newIndex]

	// 				this.sendRuntimePropsChange()

	// 				redraw = true
	// 			}

	// 			// Check if the status has changed
	// 			if (this.checkButtonStatus()) redraw = true

	// 			// Save the change, and perform a draw
	// 			this.commitChange(redraw)

	// 			return true
	// 		}
	// 	}

	// 	return false
	// }

	/**
	 * Get the index of the current (next to execute) step
	 * @returns {number} The index of current step
	 * @access public
	 */
	getActiveStepIndex() {
		const out = Object.keys(this.steps).indexOf(this.#current_step_id)
		return out !== -1 ? out : undefined
	}

	/**
	 * Get the complete style object of a button
	 * @returns the processed style of the button
	 * @override
	 */
	getDrawStyle() {
		const style = super.getDrawStyle()

		style.step_cycle = this.getActiveStepIndex() + 1

		return style
	}

	/**
	 * Execute a press of this control
	 * @param {boolean} pressed Whether the control is pressed
	 * @param {string | undefined} deviceId The surface that intiated this press
	 * @access public
	 */
	pressControl(pressed, deviceId) {
		let pressedDuration = 0
		if (deviceId) {
			// Calculate the press duration, or track when the press started
			if (pressed) {
				this.#lastDownForDevices[deviceId] = Date.now()
			} else {
				const lastDown = this.#lastDownForDevices[deviceId]
				delete this.#lastDownForDevices[deviceId]
				if (lastDown) {
					pressedDuration = Date.now() - lastDown
				}
			}
		}

		const changed = this.setPushed(pressed, deviceId)

		// if the state has changed, the choose the set to execute
		if (changed) {
			const [this_step_id, next_step_id] = this.#validateCurrentStepId()
			if (this_step_id !== null) {
				if (this.options.stepAutoProgress && !pressed && next_step_id !== null) {
					// update what the next step will be
					this.#current_step_id = next_step_id

					this.sendRuntimePropsChange()
				}
			}

			const step = this.steps[this_step_id]
			if (step) {
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

				const actions = step.action_sets[action_set_id]
				if (actions) {
					this.logger.silly('found actions')

					this.controls.actions.runMultipleActions(actions, this.controlId, this.options.relativeDelay, {
						deviceid: deviceId,
					})
				}
			}
		}
	}

	#validateCurrentStepId() {
		const this_step_raw = this.#current_step_id
		const stepIds = Object.keys(this.steps)
		if (stepIds.length > 0) {
			stepIds.sort()

			// verify 'this_step_raw' is valid
			const this_step_index = stepIds.findIndex((s) => s == this_step_raw) || 0
			const this_step_id = stepIds[this_step_index]

			// figure out hte next step
			const next_index = this_step_index + 1 >= stepIds.length ? 0 : this_step_index + 1
			const next_step_id = stepIds[next_index]

			return [this_step_id, next_step_id]
		} else {
			return [null, null]
		}
	}

	/**
	 * Execute a rotate of this control
	 * @param {boolean} direction Whether the control was rotated to the right
	 * @param {string | undefined} deviceId The surface that intiated this rotate
	 * @access public
	 * @abstract
	 */
	rotateControl(direction, deviceId) {
		const [this_step_id] = this.#validateCurrentStepId()

		const step = this.steps[this_step_id]
		if (step) {
			const action_set_id = direction ? 'rotate_right' : 'rotate_left'

			const actions = step.action_sets[action_set_id]
			if (actions) {
				this.logger.silly('found actions')

				const enabledActions = actions.filter((act) => !act.disabled)

				this.controls.actions.runMultipleActions(enabledActions, this.controlId, this.options.relativeDelay, {
					deviceid: deviceId,
				})
			}
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
			style: this.style,
			options: this.options,
			feedbacks: this.feedbacks.feedbacks,
			// action_sets: this.actions.action_sets,
			steps: this.steps,
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
}

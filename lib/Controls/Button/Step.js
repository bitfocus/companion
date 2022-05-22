import ButtonControlBase from './Base.js'
import Registry from '../../Registry.js'
import { cloneDeep } from 'lodash-es'

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
	 * @param {Registry} registry - the application core
	 * @param {string} controlId - id of the control
	 * @param {object} storage - persisted storage object
	 * @param {boolean} isImport - if this is importing a button, not creating at startup
	 */
	constructor(registry, controlId, storage, isImport) {
		super(registry, controlId, 'stepped-button', 'Controls/Button/Step')

		this.type = 'step'

		if (!storage) {
			// New control
			this.config = cloneDeep(ButtonControlBase.DefaultFields)
			this.feedbacks = []
			this.action_sets = {
				0: [],
			}
			this.#current_step_id = '0'

			// Save the change
			this.commitChange()
		} else {
			if (storage.type !== 'step') throw new Error(`Invalid type given to ControlButtonStep: "${storage.type}"`)

			this.config = storage.config
			this.feedbacks = storage.feedbacks
			this.action_sets = storage.action_sets

			this.#current_step_id = Object.keys(this.action_sets)[0]

			if (isImport) this.postProcessImport()
		}
	}

	/**
	 * Add an action set to this control
	 * @returns {boolean} success
	 * @access public
	 */
	actionSetAdd() {
		let redraw = false

		const existingKeys = Object.keys(this.action_sets)
			.map((k) => Number(k))
			.filter((k) => !isNaN(k))
		if (existingKeys.length === 0) {
			// add the default '0' set
			this.action_sets['0'] = []
			redraw = true
		} else {
			// add one after the last
			const max = Math.max(...existingKeys)
			this.action_sets[`${max + 1}`] = []
		}

		this.commitChange(redraw)

		return true
	}

	/**
	 * Progress through the action-sets
	 * @param {number} amount Number of steps to progress
	 * @returns {boolean} success
	 * @access public
	 */
	actionSetAdvanceDelta(amount) {
		if (amount && typeof amount === 'number') {
			const all_steps = Object.keys(this.action_sets)
			if (all_steps.length > 0) {
				const current = all_steps.indexOf(this.#current_step_id)

				let newIndex = (current === -1 ? 0 : current) + amount
				while (newIndex < 0) newIndex += all_steps.length
				newIndex = newIndex % all_steps.length

				const newSetId = all_steps[newIndex]
				return this.actionSetSelectNext(newSetId)
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
	actionSetMakeCurrent(index) {
		if (typeof index === 'number') {
			const setId = Object.keys(this.action_sets)[index - 1]
			if (setId !== undefined) {
				return this.actionSetSelectNext(setId)
			}
		}

		return false
	}

	/**
	 * Remove an action-set from this control
	 * @param {string} setId the id of the action-set
	 * @returns {boolean} success
	 * @access public
	 */
	actionSetRemove(setId) {
		const oldKeys = Object.keys(this.action_sets)

		if (oldKeys.length > 1) {
			let redraw = false

			if (this.action_sets[setId]) {
				// Inform modules of the change
				for (const action of this.action_sets[setId]) {
					this.cleanupAction(action)
				}

				// Assume it exists
				delete this.action_sets[setId]

				// Update the next step
				const oldIndex = oldKeys.indexOf(setId)
				let newIndex = oldIndex + 1
				if (newIndex >= oldKeys.length) {
					newIndex = 0
				}
				if (newIndex !== oldIndex) {
					this.#current_step_id = oldKeys[newIndex]
					// TODO
					// this.bank_set_step_change(page, bank, oldKeys[newIndex])
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
	 * @param {string} setId The step id to make the next
	 * @returns {boolean} success
	 * @access public
	 */
	actionSetSelectNext(setId) {
		if (this.action_sets[setId]) {
			this.#current_step_id = setId

			// TODO
			// this.bank_set_step_change(page, bank, set)

			this.sendRuntimePropsChange()

			this.triggerRedraw()

			return ture
		}

		return false
	}

	/**
	 * Swap two action-sets
	 * @param {string} setId1 One of the action-sets
	 * @param {string} setId2 The other action-set
	 * @returns {boolean} success
	 * @access public
	 */
	actionSetSwap(setId1, setId2) {
		if ((this.action_sets[setId1], this.action_sets[setId2])) {
			const tmp = this.action_sets[setId1]
			this.action_sets[setId1] = this.action_sets[setId2]
			this.action_sets[setId2] = tmp

			this.commitChange(false)

			return true
		}

		return false
	}

	/**
	 * Get the index of the current (next to execute) step
	 * @returns {number} The index of current step
	 * @access public
	 */
	getActiveStepIndex() {
		const out = Object.keys(this.action_sets).indexOf(this.#current_step_id)
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
		const changed = this.setPushed(pressed, deviceId)

		// if the state has changed, the choose the set to execute
		if (changed && pressed) {
			// ignore the up, as we don't perform any actions
			const this_step = this.#current_step_id
			const steps = Object.keys(this.action_sets)
			if (steps.length > 0) {
				steps.sort()

				// verify 'this_step' is valid
				const this_step_index = steps.findIndex((s) => s == this_step) || 0
				const action_set_id = steps[this_step_index]

				if (bank_config.step_auto_progress) {
					// update what the next step will be
					const next_index = this_step_index + 1 >= steps.length ? 0 : this_step_index + 1
					this.#current_step_id = steps[next_index]

					// TODO
					// this.bank_set_step_change(page, bank, this.#current_step_id)
				}

				const actions = this.action_sets[action_set_id]
				if (actions) {
					this.logger.silly('found actions')

					this.controls.actions.runMultipleActions(actions, this.controlId, this.config.relative_delay, {
						deviceid: deviceId,
					})
				}
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
			config: this.config,
			feedbacks: this.feedbacks,
			action_sets: this.action_sets,
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

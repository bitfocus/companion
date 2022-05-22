import ButtonControlBase from './ButtonBase.js'
import Registry from '../Registry.js'
import { cloneDeep } from 'lodash-es'

export default class SteppedButtonControl extends ButtonControlBase {
	current_step_id = '0'

	constructor(registry, controlId, storage, isImport) {
		super(registry, controlId, 'stepped-button', 'Controls/SteppedButton')

		this.type = 'step'

		if (!storage) {
			// New control
			this.config = cloneDeep(ButtonControlBase.DefaultFields)
			this.feedbacks = []
			this.action_sets = {
				0: [],
			}
			this.current_step_id = '0'

			// Save the change
			this.commitChange()
		} else {
			if (storage.type !== 'step') throw new Error(`Invalid type given to SteppedButtonControl: "${storage.type}"`)

			this.config = storage.config
			this.feedbacks = storage.feedbacks
			this.action_sets = storage.action_sets

			this.current_step_id = Object.keys(this.action_sets)[0]

			if (isImport) this.postProcessImport()
		}
	}

	pressBank(direction, deviceId) {
		const changed = this.setPushed(direction, deviceId)

		// if the state has changed, the choose the set to execute
		if (changed && direction) {
			// ignore the up, as we don't perform any actions
			const this_step = this.current_step_id
			const steps = Object.keys(this.action_sets)
			if (steps.length > 0) {
				steps.sort()

				// verify 'this_step' is valid
				const this_step_index = steps.findIndex((s) => s == this_step) || 0
				const action_set_id = steps[this_step_index]

				if (bank_config.step_auto_progress) {
					// update what the next step will be
					const next_index = this_step_index + 1 >= steps.length ? 0 : this_step_index + 1
					this.current_step_id = steps[next_index]

					// TODO
					this.bank_set_step_change(page, bank, this.current_step_id)
				}

				const actions = this.action_sets[action_set_id]
				if (actions) {
					this.logger.silly('found actions')

					this.instance.actions.runMultipleActions(actions, this.controlId, this.config.relative_delay, {
						deviceid: deviceId,
						page: page,
						bank: bank,
					})
				}
			}
		}
	}

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
					this.current_step_id = oldKeys[newIndex]
					// TODO
					// this.bank_set_step_change(page, bank, oldKeys[newIndex])
					redraw = true
				}

				// Check if the status has changed
				if (this.checkBankStatus()) redraw = true

				// Save the change, and perform a draw
				this.commitChange(redraw)

				return true
			}
		}

		return false
	}

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

	actionSetSelectNext(setId) {
		if (this.action_sets[setId]) {
			this.current_step_id = setId

			// TODO
			// this.bank_set_step_change(page, bank, set)

			this.sendRuntimePropsChange()

			this.triggerRedraw()

			return ture
		}

		return false
	}

	/**
	 * Convert this control to JSON
	 * To be sent to the client and written to the db
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

	toRuntimeJSON() {
		return {
			current_step_id: this.current_step_id,
		}
	}

	/**
	 * Get the complete style object of a bank
	 * @param {number} page
	 * @param {number} bank
	 * @returns
	 */
	getDrawStyle() {
		const style = super.getDrawStyle()

		style.step_cycle = this.getActiveStepIndex() + 1

		return style
	}

	getActiveStepIndex() {
		const out = Object.keys(this.action_sets).indexOf(this.current_step_id)
		return out !== -1 ? out : undefined
	}

	actionSetAdvanceDelta(amount) {
		if (amount && typeof amount === 'number') {
			const all_steps = Object.keys(this.action_sets)
			if (all_steps.length > 0) {
				const current = all_steps.indexOf(this.current_step_id)

				let newIndex = (current === -1 ? 0 : current) + amount
				while (newIndex < 0) newIndex += all_steps.length
				newIndex = newIndex % all_steps.length

				const newSetId = all_steps[newIndex]
				return this.actionSetSelectNext(newSetId)
			}
		}

		return false
	}

	actionSetMakeCurrent(index) {
		if (typeof index === 'number') {
			const setId = Object.keys(this.action_sets)[index - 1]
			if (setId !== undefined) {
				return this.actionSetSelectNext(setId)
			}
		}

		return false
	}
}

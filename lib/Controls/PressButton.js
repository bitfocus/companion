import ButtonControlBase from './ButtonBase.js'
import Registry from '../Registry.js'
import { cloneDeep } from 'lodash-es'

export default class PressButtonControl extends ButtonControlBase {
	type = 'press'

	/**
	 * Cached values for the feedbacks on this control
	 */
	cachedFeedbackValues = {}

	constructor(registry, controlId, storage) {
		super(registry, controlId, 'press-button', 'Controls/PressButton')

		if (!storage) {
			// New control
			this.config = cloneDeep(ButtonControlBase.DefaultFields)
			this.feedbacks = []
			this.action_sets = {
				down: [],
				up: [],
			}

			// Save the change
			this.commitChange()
		} else {
			if (storage.type !== 'press') throw new Error(`Invalid type given to PressButtonControl: "${storage.type}"`)

			this.config = storage.config
			this.feedbacks = storage.feedbacks
			this.action_sets = storage.action_sets
		}
	}

	pressBank(direction, deviceId) {
		const changed = this.setPushed(direction, deviceId)

		// if the state has changed, the choose the set to execute
		if (changed) {
			const action_set_id = direction ? 'down' : 'up'

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
}

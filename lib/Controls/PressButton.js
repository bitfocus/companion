import ButtonControlBase from './ButtonBase.js'
import Registry from '../Registry.js'
import { cloneDeep, isEqual } from 'lodash-es'
import { clamp, ParseControlId } from '../Resources/Util.js'

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

	pressBank(direction, deviceid) {
		// TODO
		this.pushed = !!direction

		this.triggerRedraw()

		// TODO
		// this.services.emberplus.updateBankState(parsed.page, parsed.bank, this.pushed, deviceId)
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

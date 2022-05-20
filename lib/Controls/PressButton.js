import ButtonControlBase from './ButtonBase.js'
import Registry from '../Registry.js'

export default class PressButtonControl extends ButtonControlBase {
	constructor(registry, controlId, storage) {
		super(registry, controlId, 'press-button', 'Controls/PressButton')

		if (storage.type !== 'press') throw new Error(`Invalid type given to PressButtonControl: "${storage.type}"`)

		this.type = storage.type
		this.config = storage.config
		this.feedbacks = storage.feedbacks
		this.action_sets = storage.action_sets
	}
	//

	setConfigFields(diff) {
		// TODO - move to a base class for step type

		if (diff.png64) {
			// Strip the prefix off the base64 png
			if (typeof diff.png64 === 'string' && diff.png64.match(/data:.*?image\/png/)) {
				diff.png64 = diff.png64.replace(/^.*base64,/, '')
			} else {
				// this.logger.info('png64 is not a png url')
				// Delete it
				delete diff.png64
			}
		}

		// TODO - validate input properties

		if (Object.keys(diff).length > 0) {
			// Apply the diff
			Object.assign(this.config, diff)

			this.commitChange()
		}
	}

	toJSON() {
		return {
			type: this.type,
			config: this.config,
			feedbacks: this.feedbacks,
			action_sets: this.action_sets,
		}
	}
}

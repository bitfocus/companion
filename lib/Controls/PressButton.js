import ButtonControlBase from './ButtonBase.js'
import Registry from '../Registry.js'
import { cloneDeep } from 'lodash-es'
import { clamp, ParseControlId } from '../Resources/Util.js'

export default class PressButtonControl extends ButtonControlBase {
	type = 'press'

	cachedFeedbackValues = {}

	constructor(registry, controlId, storage) {
		super(registry, controlId, 'press-button', 'Controls/PressButton')

		if (!storage) {
			// New control
			this.config = cloneDeep(ButtonControlBase.DefaultFields)
			this.feedbacks = []
			this.action_sets = {}

			// Save the change
			this.commitChange()
		} else {
			if (storage.type !== 'press') throw new Error(`Invalid type given to PressButtonControl: "${storage.type}"`)

			this.config = storage.config
			this.feedbacks = storage.feedbacks
			this.action_sets = storage.action_sets
		}
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

	addFeedback(feedbackItem) {
		this.feedbacks.push(feedbackItem)

		// Inform relevant module
		const parsedId = ParseControlId(this.controlId)
		if (feedbackItem.instance_id === 'internal') {
			this.internalModule.feedbackUpdate(feedbackItem, this.controlId, parsedId?.page, parsedId?.bank)
		} else {
			const instance = this.instance.moduleHost.getChild(feedbackItem.instance_id)
			if (instance) {
				instance.feedbackUpdate(feedbackItem, this.controlId, parsedId?.page, parsedId?.bank).catch((e) => {
					this.logger.silly(`feedback_update to connection failed: ${e.message}`)
				})
			}
		}

		this.commitChange()

		return true
	}

	removeFeedback(id) {
		const index = this.feedbacks.findIndex((fb) => fb.id === id)
		if (index !== -1) {
			const feedback = this.feedbacks[index]
			this.feedbacks.splice(index, 1)

			// Inform relevant module
			const instance = this.instance.moduleHost.getChild(feedback.instance_id)
			if (instance) {
				instance.feedbackDelete(feedback).catch((e) => {
					this.logger.silly(`feedback_delete to connection failed: ${e.message}`)
				})
			}

			// Remove from cached feedback values
			delete this.cachedFeedbackValues[id]

			this.commitChange()

			return true
		} else {
			return false
		}
	}

	setFeedbackOptions(id, key, value) {
		for (const feedback of this.feedbacks) {
			if (feedback && feedback.id === id) {
				if (!feedback.options) feedback.options = {}

				feedback.options[key] = value

				// Inform relevant module
				const parsedId = ParseControlId(this.controlId)
				if (feedback.instance_id === 'internal') {
					this.internalModule.feedbackUpdate(feedback, this.controlId, parsedId?.page, parsedId?.bank)
				} else {
					const instance = this.instance.moduleHost.getChild(feedback.instance_id)
					if (instance) {
						instance.feedbackUpdate(feedback, this.controlId, parsedId?.page, parsedId?.bank).catch((e) => {
							this.logger.silly(`feedback_update to connection failed: ${e.message}`)
						})
					}
				}

				// Remove from cached feedback values
				delete this.cachedFeedbackValues[id]

				this.commitChange()

				return true
			}
		}

		return false
	}

	reorderFeedback(oldIndex, newIndex) {
		oldIndex = clamp(oldIndex, 0, this.feedbacks.length)
		newIndex = clamp(newIndex, 0, this.feedbacks.length)
		feedbacks.splice(newIndex, 0, ...feedbacks.splice(oldIndex, 1))

		this.commitChange()
	}

	setFeedbackStyleSelection(id, selected) {
		for (const feedback of this.feedbacks) {
			if (feedback && feedback.id === id) {
				const definition = this.instance.definitions.getFeedbackDefinition(feedback.instance_id, feedback.type)
				if (!definition || definition.type !== 'boolean') return false

				const defaultStyle = definition.style || {}
				const oldStyle = feedback.style || {}
				const newStyle = {}

				for (const key of selected) {
					if (key in oldStyle) {
						// preserve existing value
						newStyle[key] = oldStyle[key]
					} else {
						// copy bank value, as a default
						newStyle[key] = defaultStyle[key] !== undefined ? defaultStyle[key] : this.config[key]

						// png needs to be set to something harmless
						if (key === 'png64' && !newStyle[key]) {
							newStyle[key] = null
						}
					}
				}
				feedback.style = newStyle

				this.commitChange()

				return true
			}
		}

		return false
	}

	setFeedbackStyleValue(id, key, value) {
		if (key === 'png64') {
			if (!value.match(/data:.*?image\/png/)) {
				return false
			}

			value = value.replace(/^.*base64,/, '')
		}

		for (const feedback of this.feedbacks) {
			if (feedback && feedback.id === id) {
				const definition = this.instance.definitions.getFeedbackDefinition(feedback.instance_id, feedback.type)
				if (!definition || definition.type !== 'boolean') return false

				if (!feedback.style) feedback.style = {}
				feedback.style[key] = value

				this.commitChange()

				return true
			}
		}

		return false
	}
}

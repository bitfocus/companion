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

	pushed = false
	actions_running = new Set()

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

	destroy() {
		// Inform modules of feedback cleanup
		for (const feedback of this.feedbacks) {
			this.#cleanupFeedback(feedback)
		}

		super.destroy()
	}

	forgetInstance(instanceId) {
		let changed = false

		// Cleanup any feedbacks
		const newFeedbacks = []
		for (const feedback of this.feedbacks) {
			if (feedback.instance_id === instanceId) {
				this.#cleanupFeedback(feedback)
				changed = true
			} else {
				newFeedbacks.push(feedback)
			}
		}
		this.feedbacks = newFeedbacks

		// Cleanup any actions
		// TODO

		if (changed) {
			this.commitChange()
		}
	}

	/**
	 * Prune all actions/feedbacks referencing unknown instances
	 * Doesn't do any cleanup, as it is assumed that the instance has not been running
	 * @param {Set<string>} knownInstanceIds
	 */
	verifyInstanceIds(knownInstanceIds) {
		let changed = false

		// Clean out feedbacks
		const feedbackLength = this.feedbacks.length
		this.feedbacks = this.feedbacks.filter((feedback) => !!feedback && knownInstanceIds.has(feedback.instance_id))
		changed = changed || this.feedbacks.length !== feedbackLength

		// TODO - actions

		if (changed) {
			this.commitChange()
		}
	}

	/**
	 * Update the config/style fields of this control
	 * @param {object} diff - config diff to apply
	 * @returns {boolean} true if any changes were made
	 */
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

			return true
		} else {
			return false
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

	/**
	 * Add a feedback to this control
	 * @param {object} feedbackItem the item to add
	 * @returns {boolean} success
	 */
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
					this.logger.silly(`feedback_update to connection failed: ${e.message} ${e.stack}`)
				})
			}
		}

		this.commitChange()

		return true
	}

	/**
	 * Remove a feedback from this control
	 * @param {string} id the id of the feedback
	 * @returns {boolean} success
	 */
	removeFeedback(id) {
		const index = this.feedbacks.findIndex((fb) => fb.id === id)
		if (index !== -1) {
			const feedback = this.feedbacks[index]
			this.feedbacks.splice(index, 1)

			this.#cleanupFeedback(feedback)

			this.commitChange()

			return true
		} else {
			return false
		}
	}

	#cleanupFeedback(feedback) {
		// Inform relevant module
		const instance = this.instance.moduleHost.getChild(feedback.instance_id)
		if (instance) {
			instance.feedbackDelete(feedback).catch((e) => {
				this.logger.silly(`feedback_delete to connection failed: ${e.message}`)
			})
		}

		// Remove from cached feedback values
		delete this.cachedFeedbackValues[feedback.id]
	}

	/**
	 * Update an option for a feedback
	 * @param {string} id the id of the feedback
	 * @param {string} id the key/name of the property
	 * @param {string} id the new value
	 * @returns {boolean} success
	 */
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
							this.logger.silly(`feedback_update to connection failed: ${e.message} ${e.stack}`)
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

	/**
	 * Reorder a feedback in the list
	 * @param {number} oldIndex the index of the feedback to move
	 * @param {number} newIndex the target index of the feedback
	 * @returns {boolean} success
	 */
	reorderFeedback(oldIndex, newIndex) {
		oldIndex = clamp(oldIndex, 0, this.feedbacks.length)
		newIndex = clamp(newIndex, 0, this.feedbacks.length)
		this.feedbacks.splice(newIndex, 0, ...this.feedbacks.splice(oldIndex, 1))

		this.commitChange()
	}

	/**
	 * Update the selected style properties for a boolean feedback
	 * @param {string} id the id of the feedback
	 * @param {string[]} selected the properties to be selected
	 * @returns {boolean} success
	 */
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

	/**
	 * Update an style property for a boolean feedback
	 * @param {string} id the id of the feedback
	 * @param {string} id the key/name of the property
	 * @param {string} id the new value
	 * @returns {boolean} success
	 */
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

	updateFeedbackValues(instanceId, newValues) {
		let changed = false

		for (const feedback of this.feedbacks) {
			if (feedback.instance_id === instanceId) {
				if (feedback.id in newValues) {
					// Feedback is present in new values (might be set to undefined)
					const value = newValues[feedback.id]
					if (!isEqual(value, this.cachedFeedbackValues[feedback.id])) {
						// Found the feedback, exactly where it said it would be
						// Mark the bank as changed, and store the new value
						this.cachedFeedbackValues[feedback.id] = value
						changed = true
					}
				}
			}
		}

		if (changed) {
			this.triggerRedraw()
		}
	}

	/**
	 * Get the complete style object of a bank
	 * @param {number} page
	 * @param {number} bank
	 * @returns
	 */
	getDrawStyle() {
		let style = { ...this.config }

		// Iterate through feedback-overrides
		for (const feedback of this.feedbacks) {
			const definition = this.instance.definitions.getFeedbackDefinition(feedback.instance_id, feedback.type)
			const rawValue = this.cachedFeedbackValues[feedback.id]
			if (definition && rawValue !== undefined) {
				if (definition.type === 'boolean' && rawValue == true) {
					style = {
						...style,
						...feedback?.style,
					}
				} else if (definition.type === 'advanced' && typeof rawValue === 'object') {
					style = {
						...style,
						...rawValue,
					}
				}
			}
		}

		if (style.text) {
			style.text = this.instance.variable.parseVariables(style.text)
		}

		// if (style.style == 'step') {
		// 	style['step_cycle'] = parseInt(this.action.getBankActiveStep(page, bank)) + 1
		// }

		style.pushed = !!this.pushed
		style.action_running = this.actions_running.size > 0
		style.bank_status = this.bank_status

		style.style = this.type
		return cloneDeep(style)
	}
}

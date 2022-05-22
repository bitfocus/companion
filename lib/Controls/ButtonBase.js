import ControlBase from './ControlBase.js'
import Registry from '../Registry.js'
import { ParseControlId, rgb, clamp } from '../Resources/Util.js'
import { cloneDeep, isEqual } from 'lodash-es'

export default class ButtonControlBase extends ControlBase {
	/**
	 * The defaults for the bank fields
	 * @type {Object}
	 * @access public
	 * @static
	 */
	static DefaultFields = {
		text: '',
		size: 'auto',
		png: null,
		alignment: 'center:center',
		pngalignment: 'center:center',
		color: rgb(255, 255, 255),
		bgcolor: rgb(0, 0, 0),
		relative_delay: false,
	}

	//

	action_sets = {}

	feedbacks = []

	config = {}

	bank_status = 'good'

	pushed = false
	actions_running = new Set()

	addAction(setId, actionItem) {
		if (this.action_sets[setId] === undefined) {
			// cant implicitly create a set
			this.logger.silly(`Missing set ${this.controlId}:${setId}`)
			return false
		}

		this.action_sets[setId].push(actionItem)

		const instance = this.instance.moduleHost.getChild(actionItem.instance)
		if (instance) {
			instance.actionUpdate(actionItem, page, bank).catch((e) => {
				this.logger.silly(`action_update to connection failed: ${e.message}`)
			})
		}

		this.commitChange(false)

		this.checkBankStatus()
	}

	/**
	 * Remove an action from this control
	 * @param {string} id the id of the action
	 * @returns {boolean} success
	 */
	removeAction(setId, id) {
		const action_set = this.action_sets[setId]
		if (action_set) {
			const index = action_set.findIndex((fb) => fb.id === id)
			if (index !== -1) {
				const action = action_set[index]
				action_set.splice(index, 1)

				this.cleanupAction(action)

				this.commitChange(false)

				this.checkBankStatus()

				return true
			}
		}

		return false
	}

	cleanupAction(action) {
		// Inform relevant module
		const instance = this.instance.moduleHost.getChild(action.instance)
		if (instance) {
			instance.actionDelete(action).catch((e) => {
				this.logger.silly(`action_delete to connection failed: ${e.message}`)
			})
		}
	}

	setActionDelay(setId, id, delay) {
		const action_set = this.action_sets[setId]
		if (action_set) {
			for (const action of action_set) {
				if (action && action.id === id) {
					delay = Number(delay)
					if (isNaN(delay)) delay = 0

					action.delay = delay

					this.commitChange(false)

					return true
				}
			}
		}

		return false
	}

	setActionOption(setId, id, key, value) {
		const action_set = this.action_sets[setId]
		if (action_set) {
			for (const action of action_set) {
				if (action && action.id === id) {
					if (!action.options) action.options = {}

					action.options[key] = value

					// Inform relevant module
					const parsedId = ParseControlId(this.controlId)
					const instance = this.instance.moduleHost.getChild(action.instance)
					if (instance) {
						instance.actionUpdate(action, parsedId?.page, parsedId?.bank).catch((e) => {
							this.logger.silly(`action_update to connection failed: ${e.message}`)
						})
					}

					this.commitChange(false)

					return true
				}
			}
		}

		return false
	}

	/**
	 * Reorder an action in the list
	 * @param {string} setId the action_set id
	 * @param {number} oldIndex the index of the action to move
	 * @param {number} newIndex the target index of the action
	 * @returns {boolean} success
	 */
	reorderAction(setId, oldIndex, newIndex) {
		const action_set = this.action_sets[setId]
		if (action_set) {
			oldIndex = clamp(oldIndex, 0, this.action_set.length)
			newIndex = clamp(newIndex, 0, this.action_set.length)
			this.action_set.splice(newIndex, 0, ...this.action_set.splice(oldIndex, 1))
		}

		this.commitChange()
	}

	/**
	 * Check the status of a bank, and re-draw if needed
	 * @param {boolean} redraw whether to perform a draw
	 * @returns {boolean} whether the status changed
	 * @access protected
	 */
	checkBankStatus(redraw = true) {
		// Find all the instances referenced by the bank
		const instance_ids = new Set()
		for (const actions in Object.values(this.action_sets)) {
			for (const action of actions) {
				instance_ids.add(action.instance)
			}
		}

		// Figure out the combined status
		let status = 'good'
		for (const instance_id of instance_ids) {
			const instance_status = this.instance.getInstanceStatus(instance_id)
			if (instance_status) {
				// TODO - can this be made simpler
				switch (instance_status.category) {
					case 'error':
						status = 'error'
						break
					case 'warning':
						if (status !== 'error') {
							status = 'warning'
						}
						break
				}
			}
		}

		// If the status has changed, emit the eent
		if (status != this.bank_status) {
			this.bank_status = status
			if (redraw) this.triggerRedraw()
			return true
		} else {
			return false
		}
	}
	destroy() {
		// TODO - some of this feels like it could be done in bulk

		// Inform modules of feedback cleanup
		for (const feedback of this.feedbacks) {
			this.#cleanupFeedback(feedback)
		}

		// Inform modules of action cleanup
		for (const action_set of Object.values(this.action_sets)) {
			for (const action of action_set) {
				this.cleanupAction(action)
			}
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
		for (const [setId, action_set] of Object.entries(this.action_sets)) {
			const newActions = []
			for (const action of action_set) {
				if (action.instance === instanceId) {
					this.cleanupAction(action)
					changed = true
				} else {
					newActions.push(action)
				}
			}

			this.action_sets[setId] = newActions
		}

		if (changed) {
			this.checkBankStatus(false)

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

		// Clean out actions
		for (const setId of Object.keys(this.action_sets)) {
			const lengthBefore = this.action_sets[setId].length
			this.action_sets[setId] = this.action_sets[setId].filter(
				(action) => !!action && knownInstanceIds.has(action.instance)
			)
			changed = changed || this.action_sets[setId].length !== lengthBefore
		}

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
		let style = this.getUnparsedStyle()

		if (style.text) {
			style.text = this.instance.variable.parseVariables(style.text)
		}

		style.pushed = !!this.pushed
		style.action_running = this.actions_running.size > 0
		style.bank_status = this.bank_status

		style.style = this.type
		return cloneDeep(style)
	}

	/**
	 * Get the unparsed style for a bank.
	 * Note: Does not clone the style
	 * @param {number} page
	 * @param {number} bank
	 * @returns
	 */
	getUnparsedStyle() {
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

		return style
	}

	/**
	 * Rename an instance for variables used in this control
	 * @param {string} fromlabel - the old instance short name
	 * @param {string} tolabel - the new instance short name
	 * @access public
	 */
	renameVariables(labelFrom, labelTo) {
		if (this.config?.text) {
			const result = this.instance.variable.renameVariablesInString(this.config.text, labelFrom, labelTo)
			if (this.config.text !== result) {
				this.logger.silly('rewrote ' + this.config.text + ' to ' + result)
				this.config.text = result
			}
		}
	}

	/**
	 * Propogate variable changes
	 * @param {Array<string>} allChangedVariables - variables with changes
	 * @access public
	 */
	onVariablesChanged(allChangedVariables) {
		const style = this.getUnparsedStyle()

		if (style && typeof style.text === 'string') {
			for (const variable of allChangedVariables) {
				if (style.text.includes(`$(${variable})`)) {
					this.logger.silly('variable changed in bank ' + this.controlId)

					this.triggerRedraw()
					return
				}
			}
		}
	}
}

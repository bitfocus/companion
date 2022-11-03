import ControlBase from '../../ControlBase.js'
import { ParseControlId, rgb, clamp, GetButtonBitmapSize } from '../../../Resources/Util.js'
import { cloneDeep, isEqual } from 'lodash-es'
import { nanoid } from 'nanoid'
import FragmentActions from '../../Fragments/FragmentActions.js'

/**
 * Abstract class for a editable button control.
 *
 * @extends ControlBase
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 3.0.0
 * @abstract
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
export default class ButtonControlBase extends ControlBase {
	/**
	 * The defaults style for a button
	 * @type {Object}
	 * @access public
	 * @static
	 */
	static DefaultStyle = {
		text: '',
		size: 'auto',
		png: null,
		alignment: 'center:center',
		pngalignment: 'center:center',
		color: rgb(255, 255, 255),
		bgcolor: rgb(0, 0, 0),
		show_topbar: 'default',
	}
	/**
	 * The defaults options for a button
	 * @type {Object}
	 * @access public
	 * @static
	 */
	static DefaultOptions = {
		relativeDelay: false,
	}

	/**
	 * The actions fragment
	 * @access public
	 */
	actions

	/**
	 * The current status of this button
	 * @access protected
	 */
	bank_status = 'good'

	/**
	 * Cached values for the feedbacks on this control
	 * @access private
	 */
	#cachedFeedbackValues = {}

	/**
	 * The base style of this button
	 * @access protected
	 */
	style = {}

	/**
	 * The config of this button
	 */
	options = {}

	/**
	 * The feedbacks on this button
	 * @access public
	 */
	feedbacks = []

	/**
	 * Whether this button has delayed actions running
	 * @access protected
	 */
	has_actions_running = false

	/**
	 * Whether this button is currently pressed
	 * @access protected
	 */
	pushed = false

	constructor(registry, controlId, logSource, debugNamespace) {
		super(registry, controlId, logSource, debugNamespace)

		this.actions = new FragmentActions(
			registry,
			controlId,
			this.commitChange.bind(this),
			this.checkButtonStatus.bind(this)
		)
	}

	/**
	 * Check the status of a bank, and re-draw if needed
	 * @param {boolean} redraw whether to perform a draw
	 * @returns {boolean} whether the status changed
	 * @access public
	 */
	checkButtonStatus(redraw = true) {
		// Find all the instances referenced by the bank
		const instance_ids = new Set()
		for (const actions in Object.values(this.actions.action_sets)) {
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

	/**
	 * Inform the instance of a removed feedback
	 * @param {object} fedeback the feedback being removed
	 * @access private
	 */
	#cleanupFeedback(feedback) {
		// Inform relevant module
		const instance = this.instance.moduleHost.getChild(feedback.instance_id)
		if (instance) {
			instance.feedbackDelete(feedback).catch((e) => {
				this.logger.silly(`feedback_delete to connection failed: ${e.message}`)
			})
		}

		// Remove from cached feedback values
		delete this.#cachedFeedbackValues[feedback.id]
	}

	/**
	 * Prepare this control for deletion
	 * @access public
	 */
	destroy() {
		// TODO - some of this feels like it could be done in bulk

		// Inform modules of feedback cleanup
		for (const feedback of this.feedbacks) {
			this.#cleanupFeedback(feedback)
		}

		this.actions.destroy()

		super.destroy()
	}

	/**
	 * Add a feedback to this control
	 * @param {object} feedbackItem the item to add
	 * @returns {boolean} success
	 * @access public
	 */
	feedbackAdd(feedbackItem) {
		this.feedbacks.push(feedbackItem)

		// Inform relevant module
		this.#feedbackSubscribe(feedbackItem)

		this.commitChange()

		return true
	}

	/**
	 * Duplicate an feedback on this control
	 * @param {string} id
	 * @returns {boolean} success
	 * @access public
	 */
	feedbackDuplicate(id) {
		const index = this.feedbacks.findIndex((fb) => fb.id === id)
		if (index !== -1) {
			const feedbackItem = cloneDeep(this.feedbacks[index])
			feedbackItem.id = nanoid()

			this.feedbacks.splice(index + 1, 0, feedbackItem)

			this.#feedbackSubscribe(feedbackItem)

			this.commitChange(false)

			return true
		}

		return false
	}

	feedbackEnabled(id, enabled) {
		for (const feedback of this.feedbacks) {
			if (feedback && feedback.id === id) {
				if (!feedback.options) feedback.options = {}

				feedback.disabled = !enabled

				// Remove from cached feedback values
				delete this.#cachedFeedbackValues[id]

				// Inform relevant module
				if (!feedback.disabled) {
					this.#feedbackSubscribe(feedback)
				} else {
					this.#cleanupFeedback(feedback)
				}

				this.commitChange()

				return true
			}
		}

		return false
	}

	/**
	 * Learn the options for a feedback, by asking the instance for the current values
	 * @param {string} id the id of the feedback
	 * @returns {boolean} success
	 * @access public
	 */
	async feedbackLearn(id) {
		const feedback = this.feedbacks.find((fb) => fb.id === id)
		if (feedback) {
			const instance = this.instance.moduleHost.getChild(feedback.instance_id)
			if (instance) {
				const newOptions = await instance.feedbackLearnValues(feedback)
				if (newOptions) {
					const newFeedback = {
						...feedback,
						options: newOptions,
					}

					// It may not still exist, so do a replace through the usual flow
					return this.feedbackReplace(newFeedback)
				}
			}
		}

		return false
	}

	/**
	 * Remove a feedback from this control
	 * @param {string} id the id of the feedback
	 * @returns {boolean} success
	 * @access public
	 */
	feedbackRemove(id) {
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

	/**
	 * Reorder a feedback in the list
	 * @param {number} oldIndex the index of the feedback to move
	 * @param {number} newIndex the target index of the feedback
	 * @returns {boolean} success
	 * @access public
	 */
	feedbackReorder(oldIndex, newIndex) {
		oldIndex = clamp(oldIndex, 0, this.feedbacks.length)
		newIndex = clamp(newIndex, 0, this.feedbacks.length)
		this.feedbacks.splice(newIndex, 0, ...this.feedbacks.splice(oldIndex, 1))

		this.commitChange()
	}

	/**
	 * Replace a feedback with an updated version
	 * @param {object} newProps
	 * @access public
	 */
	feedbackReplace(newProps) {
		for (const feedback of this.feedbacks) {
			// Replace the new feedback in place
			if (feedback.id === newProps.id) {
				feedback.type = newProps.feedbackId
				feedback.options = newProps.options

				delete feedback.upgradeIndex

				// Preserve existing value if it is set
				feedback.style = feedback.style || newProps.style

				this.#feedbackSubscribe(feedback)

				this.commitChange(true)

				return true
			}
		}

		return false
	}

	/**
	 * Update an option for a feedback
	 * @param {string} id the id of the feedback
	 * @param {string} key the key/name of the property
	 * @param {any} value the new value
	 * @returns {boolean} success
	 * @access public
	 */
	feedbackSetOptions(id, key, value) {
		for (const feedback of this.feedbacks) {
			if (feedback && feedback.id === id) {
				if (!feedback.options) feedback.options = {}

				feedback.options[key] = value

				// Remove from cached feedback values
				delete this.#cachedFeedbackValues[id]

				// Inform relevant module
				this.#feedbackSubscribe(feedback)

				this.commitChange()

				return true
			}
		}

		return false
	}

	/**
	 * Update the selected style properties for a boolean feedback
	 * @param {string} id the id of the feedback
	 * @param {string[]} selected the properties to be selected
	 * @returns {boolean} success
	 * @access public
	 */
	feedbackSetStyleSelection(id, selected) {
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
						newStyle[key] = defaultStyle[key] !== undefined ? defaultStyle[key] : this.style[key]

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
	 * @param {string} key the key/name of the property
	 * @param {any} value the new value
	 * @returns {boolean} success
	 * @access public
	 */
	feedbackSetStyleValue(id, key, value) {
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

	/**
	 * Inform the instance of an updated feedback
	 * @param {object} feedback the feedback which changed
	 * @access private
	 */
	#feedbackSubscribe(feedback) {
		if (!feedback.disabled) {
			if (feedback.instance_id === 'internal') {
				this.internalModule.feedbackUpdate(feedback, this.controlId)
			} else {
				const instance = this.instance.moduleHost.getChild(feedback.instance_id)
				if (instance) {
					instance.feedbackUpdate(feedback, this.controlId).catch((e) => {
						this.logger.silly(`feedback_update to connection failed: ${e.message} ${e.stack}`)
					})
				}
			}
		}
	}

	/**
	 * Remove any actions and feedbacks referencing a specified instanceId
	 * @param {string} instanceId
	 * @access public
	 */
	forgetInstance(instanceId) {
		let changedFeedbacks = false

		// Cleanup any feedbacks
		const newFeedbacks = []
		for (const feedback of this.feedbacks) {
			if (feedback.instance_id === instanceId) {
				this.#cleanupFeedback(feedback)
				changedFeedbacks = true
			} else {
				newFeedbacks.push(feedback)
			}
		}
		this.feedbacks = newFeedbacks

		const changedActions = this.actions.forgetInstance(instanceId)

		if (changedActions || changedFeedbacks) {
			this.checkButtonStatus(false)

			this.commitChange()
		}
	}

	/**
	 * Get the size of the bitmap render of this control
	 * @access public
	 * @abstract
	 */
	getBitmapSize() {
		return GetButtonBitmapSize(this.registry, this.style)
	}

	/**
	 * Get the complete style object of a button
	 * @returns the processed style of the button
	 * @access public
	 */
	getDrawStyle() {
		let style = this.getUnparsedStyle()

		if (style.text) {
			style.text = this.instance.variable.parseVariables(style.text)
		}

		style.pushed = !!this.pushed
		style.action_running = this.has_actions_running
		style.bank_status = this.bank_status

		style.style = this.type
		return cloneDeep(style)
	}

	/**
	 * Get the unparsed style for a button
	 * Note: Does not clone the style
	 * @returns the unprocessed style
	 * @access public
	 */
	getUnparsedStyle() {
		let style = { ...this.style }

		// Iterate through feedback-overrides
		for (const feedback of this.feedbacks) {
			if (feedback.disabled) continue

			const definition = this.instance.definitions.getFeedbackDefinition(feedback.instance_id, feedback.type)
			const rawValue = this.#cachedFeedbackValues[feedback.id]
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

	/**
	 * Update an option field of this control
	 * @access public
	 */
	optionsSetField(key, value) {
		this.options[key] = value

		this.commitChange()

		return true
	}

	/**
	 * If this control was imported to a running system, do some data cleanup/validation
	 * @access protected
	 */
	postProcessImport() {
		const ps = []

		// Make sure all the ids are unique
		for (const feedback of this.feedbacks) {
			feedback.id = nanoid()

			if (feedback.instance_id === 'internal') {
				this.internalModule.feedbackUpdate(feedback, this.controlId)
			} else {
				const instance = this.instance.moduleHost.getChild(feedback.instance_id)
				if (instance) {
					ps.push(instance.feedbackUpdate(feedback, this.controlId))
				}
			}
		}

		ps.push(this.actions.postProcessImport())

		Promise.all(ps).catch((e) => {
			this.logger.silly(`posProcessImport for ${this.controlId} failed: ${e.message}`)
		})

		this.commitChange()
		this.sendRuntimePropsChange()
	}

	/**
	 * Execute a press of this control
	 * @param {boolean} pressed Whether the control is pressed
	 * @param {string | undefined} deviceId The surface that intiated this press
	 * @access public
	 * @abstract
	 */
	pressControl(pressed, deviceId) {
		throw new Error('must be implemented by subclass!')
	}

	/**
	 * Rename an instance for variables used in this control
	 * @param {string} fromlabel - the old instance short name
	 * @param {string} tolabel - the new instance short name
	 * @access public
	 */
	renameVariables(labelFrom, labelTo) {
		if (this.style?.text) {
			const result = this.instance.variable.renameVariablesInString(this.style.text, labelFrom, labelTo)
			if (this.style.text !== result) {
				this.logger.silly('rewrote ' + this.style.text + ' to ' + result)
				this.style.text = result
			}
		}
	}

	/**
	 * Mark the button as having pending delayed actions
	 * @param {boolean} running Whether any delayed actions are pending
	 * @param {boolean} skip_up Mark the button as released, skipping the release actions
	 * @access public
	 */
	setActionsRunning(running, skip_up) {
		this.has_actions_running = running

		if (skip_up) {
			this.setPushed(false)
		}

		this.triggerRedraw()
	}

	/**
	 * Set the button as being pushed.
	 * Notifies interested observers
	 * @param {boolean} pushed new state
	 * @returns {boolean} the pushed state changed
	 * @access public
	 */
	setPushed(direction, deviceId) {
		const wasPushed = this.pushed
		// Record is as pressed
		this.pushed = !!direction

		if (this.pushed !== wasPushed) {
			// TODO - invalidate feedbacks?

			const parsed = ParseControlId(this.controlId)
			if (parsed?.type === 'bank') {
				this.services.emberplus.updateBankState(parsed.page, parsed.bank, this.pushed, deviceId)
			}

			this.triggerRedraw()

			return true
		} else {
			return false
		}
	}

	/**
	 * Update the style fields of this control
	 * @param {object} diff - config diff to apply
	 * @returns {boolean} true if any changes were made
	 * @access public
	 */
	styleSetFields(diff) {
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

		if (Object.keys(diff).length > 0) {
			// Apply the diff
			Object.assign(this.style, diff)

			if ('show_topbar' in diff) {
				// Some feedbacks will need to redraw
				for (const feedback of this.feedbacks) {
					this.#feedbackSubscribe(feedback)
				}
			}

			this.commitChange()

			return true
		} else {
			return false
		}
	}

	/**
	 * Update the feedbacks on the button with new values
	 * @param {string} instanceId The instance the feedbacks are for
	 * @param {object} newValues The new fedeback values
	 */
	updateFeedbackValues(instanceId, newValues) {
		let changed = false

		for (const feedback of this.feedbacks) {
			if (feedback.instance_id === instanceId) {
				if (feedback.id in newValues) {
					// Feedback is present in new values (might be set to undefined)
					const value = newValues[feedback.id]
					if (!isEqual(value, this.#cachedFeedbackValues[feedback.id])) {
						// Found the feedback, exactly where it said it would be
						// Mark the bank as changed, and store the new value
						this.#cachedFeedbackValues[feedback.id] = value
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
	 * Prune all actions/feedbacks referencing unknown instances
	 * Doesn't do any cleanup, as it is assumed that the instance has not been running
	 * @param {Set<string>} knownInstanceIds
	 * @access public
	 */
	verifyInstanceIds(knownInstanceIds) {
		let changed = false

		// Clean out feedbacks
		const feedbackLength = this.feedbacks.length
		this.feedbacks = this.feedbacks.filter((feedback) => !!feedback && knownInstanceIds.has(feedback.instance_id))
		changed = changed || this.feedbacks.length !== feedbackLength

		const changedActions = this.actions.verifyInstanceIds(knownInstanceIds)

		if (changed || changedActions) {
			this.commitChange()
		}
	}
}

import CoreBase from '../../Core/Base.js'
import { clamp } from '../../Resources/Util.js'
import { cloneDeep, isEqual } from 'lodash-es'
import { nanoid } from 'nanoid'

/**
 * Helper for ControlTypes with feedbacks
 *
 * @extends CoreBase
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
export default class FragmentFeedbacks extends CoreBase {
	/**
	 * The base style without feedbacks applied
	 * @access public
	 */
	baseStyle = {}

	/**
	 * Whether this set of feedbacks can only use boolean feedbacks
	 * @access private
	 */
	#booleanOnly

	/**
	 * Cached values for the feedbacks on this control
	 * @access private
	 */
	#cachedFeedbackValues = {}

	/**
	 * The feedbacks on this control
	 * @access public
	 */
	feedbacks = []

	/**
	 * Whether this set of feedbacks can only use boolean feedbacks
	 * @access public
	 */
	get isBooleanOnly() {
		return this.#booleanOnly
	}

	/**
	 * @param {Registry} registry - the application core
	 * @param {string} controlId - id of the control
	 * @param {string} logSource
	 * @param {string} debugNamespace
	 */
	constructor(registry, controlId, commitChange, triggerRedraw, booleanOnly) {
		super(registry, 'fragment-feedbacks', 'Controls/Fragments/Feedbacks')

		this.controlId = controlId
		this.commitChange = commitChange
		this.triggerRedraw = triggerRedraw
		this.#booleanOnly = booleanOnly
	}

	/**
	 * Get the value from all feedbacks as a single boolean
	 */
	checkValueAsBoolean() {
		if (!this.#booleanOnly) throw new Error('FragmentFeedbacks is setup to use styles')

		let result = true

		for (const feedback of this.feedbacks) {
			if (feedback.disabled) continue

			const rawValue = this.#cachedFeedbackValues[feedback.id]

			if (typeof rawValue === 'boolean') {
				// update the result
				result = result && rawValue
			}
		}

		return result
	}

	/**
	 * Inform the instance of a removed feedback
	 * @param {object} fedeback the feedback being removed
	 * @access private
	 */
	#cleanupFeedback(feedback) {
		// Inform relevant module
		const instance = this.instance.moduleHost.getChild(feedback.instance_id, true)
		if (instance) {
			instance.feedbackDelete(feedback).catch((e) => {
				this.logger.silly(`feedback_delete to connection failed: ${e.message}`)
			})
		}

		// Remove from cached feedback values
		delete this.#cachedFeedbackValues[feedback.id]
	}

	/**
	 * Remove any tracked state for an instance
	 * @param {string} instanceId
	 * @access public
	 */
	clearInstanceState(instanceId) {
		let changed = false
		for (const feedback of this.feedbacks) {
			if (feedback.instance_id === instanceId) {
				delete this.#cachedFeedbackValues[feedback.id]

				changed = true
			}
		}

		if (changed) this.triggerRedraw()
	}

	/**
	 * Prepare this control for deletion
	 * @access public
	 */
	destroy() {
		// Inform modules of feedback cleanup
		for (const feedback of this.feedbacks) {
			this.#cleanupFeedback(feedback)
		}
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
				const newOptions = await instance.feedbackLearnValues(feedback, this.controlId)
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
	feedbackReplace(newProps, skipNotifyModule = false) {
		for (const feedback of this.feedbacks) {
			// Replace the new feedback in place
			if (feedback.id === newProps.id) {
				feedback.type = newProps.type || newProps.feedbackId
				feedback.options = newProps.options

				delete feedback.upgradeIndex

				// Preserve existing value if it is set
				feedback.style = Object.keys(feedback.style || {}).length > 0 ? feedback.style : newProps.style

				if (!skipNotifyModule) {
					this.#feedbackSubscribe(feedback)
				}

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
		if (this.#booleanOnly) throw new Error('FragmentFeedbacks not setup to use styles')

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
						newStyle[key] = defaultStyle[key] !== undefined ? defaultStyle[key] : this.baseStyle[key]

						// png needs to be set to something harmless
						if (key === 'png64' && !newStyle[key]) {
							newStyle[key] = null
						}
					}

					if (key === 'text') {
						// also preserve textExpression
						newStyle['textExpression'] =
							oldStyle['textExpression'] ??
							(defaultStyle['textExpression'] !== undefined
								? defaultStyle['textExpression']
								: this.baseStyle['textExpression'])
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
		if (this.#booleanOnly) throw new Error('FragmentFeedbacks not setup to use styles')

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
				const instance = this.instance.moduleHost.getChild(feedback.instance_id, true)
				if (instance) {
					instance.feedbackUpdate(feedback, this.controlId).catch((e) => {
						this.logger.silly(`feedback_update to connection failed: ${e.message} ${e.stack}`)
					})
				}
			}
		}
	}

	/**
	 * Remove any actions referencing a specified instanceId
	 * @param {string} instanceId
	 * @access public
	 */
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

		return changed
	}

	/**
	 * Get the instance ids the feebacks belong to
	 * @param {Set<String> | undefined} targetSet Optional set to insert into
	 * @access public
	 * @returns {Set<string>}
	 */
	getReferencedInstanceIds(targetSet) {
		const instanceIds = targetSet || new Set()

		for (const feedback of this.feedbacks) {
			instanceIds.add(feedback.instance_id)
		}

		return instanceIds
	}

	/**
	 * Get the unparsed style for these feedbacks
	 * Note: Does not clone the style
	 * @returns the unprocessed style
	 * @access public
	 */
	getUnparsedStyle() {
		if (this.#booleanOnly) throw new Error('FragmentFeedbacks not setup to use styles')

		let style = { ...this.baseStyle }

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
					// Prune off some special properties
					const prunedValue = { ...rawValue }
					delete prunedValue.imageBuffer
					delete prunedValue.imageBufferPosition

					// Ensure `textExpression` is set at the same times as `text`
					delete prunedValue.textExpression
					if ('text' in prunedValue) {
						prunedValue.textExpression = rawValue.textExpression || false
					}

					style = {
						...style,
						...prunedValue,
					}

					// Push the imageBuffer into an array
					if (rawValue.imageBuffer) {
						if (!style.imageBuffers) style.imageBuffers = []

						style.imageBuffers.push({
							...rawValue.imageBufferPosition,
							buffer: rawValue.imageBuffer,
						})
					}
				}
			}
		}

		return style
	}

	/**
	 * If this control was imported to a running system, do some data cleanup/validation
	 * @access protected
	 */
	async postProcessImport() {
		const ps = []

		// Make sure all the ids are unique
		for (const feedback of this.feedbacks) {
			feedback.id = nanoid()

			if (feedback.instance_id === 'internal') {
				setImmediate(() => {
					this.internalModule.feedbackUpdate(feedback, this.controlId)
				})
			} else {
				const instance = this.instance.moduleHost.getChild(feedback.instance_id, true)
				if (instance) {
					ps.push(instance.feedbackUpdate(feedback, this.controlId))
				}
			}
		}

		await Promise.all(ps).catch((e) => {
			this.logger.silly(`postProcessImport for ${this.controlId} failed: ${e.message}`)
		})
	}

	/**
	 * Re-trigger 'subscribe' for all feedbacks
	 * This should be used when something has changed which will require all feedbacks to be re-run
	 */
	resubscribeAllFeedbacks() {
		// Some feedbacks will need to redraw
		for (const feedback of this.feedbacks) {
			this.#feedbackSubscribe(feedback)
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

		return changed
	}
}

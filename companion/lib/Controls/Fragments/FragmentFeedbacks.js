import CoreBase from '../../Core/Base.js'
import { clamp } from '../../Resources/Util.js'
import { cloneDeep, isEqual } from 'lodash-es'
import { nanoid } from 'nanoid'

/**
 * @typedef {import('../../Shared/Model/FeedbackModel.js').FeedbackInstance} FeedbackInstance
 */

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
	 * The defaults style for a button
	 * @type {import('../../Shared/Model/StyleModel.js').ButtonStyleProperties}
	 * @access public
	 * @static
	 */
	static DefaultStyle = {
		text: '',
		textExpression: false,
		size: 'auto',
		png64: null,
		alignment: 'center:center',
		pngalignment: 'center:center',
		color: 0xffffff,
		bgcolor: 0x000000,
		show_topbar: 'default',
	}

	/**
	 * The base style without feedbacks applied
	 * @type {import('../../Shared/Model/StyleModel.js').ButtonStyleProperties}
	 * @access public
	 */
	baseStyle = cloneDeep(FragmentFeedbacks.DefaultStyle)

	/**
	 * Whether this set of feedbacks can only use boolean feedbacks
	 * @type {boolean}
	 * @access private
	 */
	#booleanOnly

	/**
	 * Cached values for the feedbacks on this control
	 * @type {Record<string, any>} // TODO - type stronger
	 * @access private
	 */
	#cachedFeedbackValues = {}

	/**
	 * The feedbacks on this control
	 * @type {FeedbackInstance[]}
	 * @access public
	 */
	feedbacks = []

	/**
	 * Whether this set of feedbacks can only use boolean feedbacks
	 * @type {boolean}
	 * @access public
	 */
	get isBooleanOnly() {
		return this.#booleanOnly
	}

	/**
	 * Commit changes to the database and disk
	 * @type {(redraw?: boolean) => void}
	 * @access private
	 */
	#commitChange

	/**
	 * Trigger a redraw/invalidation of the control
	 * @type {() => void}
	 * @access private
	 */
	#triggerRedraw

	/**
	 * @param {import('../../Registry.js').default} registry - the application core
	 * @param {string} controlId - id of the control
	 * @param {(redraw?: boolean) => void} commitChange
	 * @param {() => void} triggerRedraw
	 * @param {boolean} booleanOnly
	 */
	constructor(registry, controlId, commitChange, triggerRedraw, booleanOnly) {
		super(registry, 'fragment-feedbacks', 'Controls/Fragments/Feedbacks')

		this.controlId = controlId
		this.#commitChange = commitChange
		this.#triggerRedraw = triggerRedraw
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

			const definition = this.instance.definitions.getFeedbackDefinition(feedback.instance_id, feedback.type)

			let rawValue = this.#cachedFeedbackValues[feedback.id]

			if (definition && typeof rawValue === 'boolean') {
				if (definition.showInvert && feedback.isInverted) rawValue = !rawValue

				// update the result
				result = result && rawValue
			} else {
				// An invalid value is falsey, it probably means that the feedback has no value
				result = false
			}
		}

		return result
	}

	/**
	 * Inform the instance of a removed feedback
	 * @param {FeedbackInstance} feedback the feedback being removed
	 * @access private
	 */
	#cleanupFeedback(feedback) {
		// Inform relevant module
		const connection = this.instance.moduleHost.getChild(feedback.instance_id, true)
		if (connection) {
			connection.feedbackDelete(feedback).catch((/** @type {any} */ e) => {
				this.logger.silly(`feedback_delete to connection failed: ${e.message}`)
			})
		}

		// Remove from cached feedback values
		delete this.#cachedFeedbackValues[feedback.id]
	}

	/**
	 * Remove any tracked state for a connection
	 * @param {string} connectionId
	 * @access public
	 */
	clearConnectionState(connectionId) {
		let changed = false
		for (const feedback of this.feedbacks) {
			if (feedback.instance_id === connectionId) {
				delete this.#cachedFeedbackValues[feedback.id]

				changed = true
			}
		}

		if (changed) this.#triggerRedraw()
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
	 * @param {FeedbackInstance} feedbackItem the item to add
	 * @returns {boolean} success
	 * @access public
	 */
	feedbackAdd(feedbackItem) {
		this.feedbacks.push(feedbackItem)

		// Inform relevant module
		this.#feedbackSubscribe(feedbackItem)

		this.#commitChange()

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

			this.#commitChange(false)

			return true
		}

		return false
	}

	/**
	 * Enable or disable a feedback
	 * @param {string} id
	 * @param {boolean} enabled
	 * @returns {boolean}
	 * @access public
	 */
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

				this.#commitChange()

				return true
			}
		}

		return false
	}

	/**
	 * Set headline for the feedback
	 * @param {string} id
	 * @param {string} headline
	 * @returns {boolean} success
	 */
	feedbackHeadline(id, headline) {
		for (const feedback of this.feedbacks) {
			if (feedback && feedback.id === id) {
				feedback.headline = headline

				this.#commitChange()

				return true
			}
		}

		return false
	}

	/**
	 * Learn the options for a feedback, by asking the instance for the current values
	 * @param {string} id the id of the feedback
	 * @returns {Promise<boolean>} success
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

			this.#commitChange()

			return true
		} else {
			return false
		}
	}

	/**
	 * Reorder a feedback in the list
	 * @param {number} oldIndex the index of the feedback to move
	 * @param {number} newIndex the target index of the feedback
	 * @returns {boolean}
	 * @access public
	 */
	feedbackReorder(oldIndex, newIndex) {
		oldIndex = clamp(oldIndex, 0, this.feedbacks.length)
		newIndex = clamp(newIndex, 0, this.feedbacks.length)
		this.feedbacks.splice(newIndex, 0, ...this.feedbacks.splice(oldIndex, 1))

		this.#commitChange()

		return true
	}

	/**
	 * Replace a feedback with an updated version
	 * @param {Pick<FeedbackInstance, 'id' | 'type' | 'style' | 'options' | 'isInverted'>} newProps
	 * @access public
	 */
	feedbackReplace(newProps, skipNotifyModule = false) {
		for (const feedback of this.feedbacks) {
			// Replace the new feedback in place
			if (feedback.id === newProps.id) {
				feedback.type = newProps.type // || newProps.feedbackId nocommit
				feedback.options = newProps.options
				feedback.isInverted = !!newProps.isInverted

				delete feedback.upgradeIndex

				// Preserve existing value if it is set
				feedback.style = Object.keys(feedback.style || {}).length > 0 ? feedback.style : newProps.style

				if (!skipNotifyModule) {
					this.#feedbackSubscribe(feedback)
				}

				this.#commitChange(true)

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

				this.#commitChange()

				return true
			}
		}

		return false
	}

	/**
	 * Set whether a boolean feedback should be inverted
	 * @param {string} id the id of the feedback
	 * @param {boolean} isInverted the new value
	 * @returns {boolean} success
	 * @access public
	 */
	feedbackSetInverted(id, isInverted) {
		for (const feedback of this.feedbacks) {
			if (feedback && feedback.id === id) {
				// TODO - verify this is a boolean feedback

				feedback.isInverted = !!isInverted

				// Inform relevant module
				// Future: is this needed?
				// this.#feedbackSubscribe(feedback)

				this.#commitChange()

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

				/** @type {Partial<import('@companion-module/base').CompanionButtonStyleProps>} */
				const defaultStyle = definition.style || {}
				/** @type {Record<string, any>} */
				const oldStyle = feedback.style || {}
				/** @type {Record<string, any>} */
				const newStyle = {}

				for (const key of selected) {
					if (key in oldStyle) {
						// preserve existing value
						newStyle[key] = oldStyle[key]
					} else {
						// copy button value as a default
						// @ts-ignore
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
							/*defaultStyle['textExpression'] !== undefined
								? defaultStyle['textExpression']
								: */ this.baseStyle['textExpression']
					}
				}
				feedback.style = newStyle

				this.#commitChange()

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

		if (key === 'png64' && value !== null) {
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
				// @ts-ignore
				feedback.style[key] = value

				this.#commitChange()

				return true
			}
		}

		return false
	}

	/**
	 * Inform the instance of an updated feedback
	 * @param {FeedbackInstance} feedback the feedback which changed
	 * @returns {void}
	 * @access private
	 */
	#feedbackSubscribe(feedback) {
		if (!feedback.disabled) {
			if (feedback.instance_id === 'internal') {
				this.internalModule.feedbackUpdate(feedback, this.controlId)
			} else {
				const connection = this.instance.moduleHost.getChild(feedback.instance_id, true)
				if (connection) {
					connection.feedbackUpdate(feedback, this.controlId).catch((/** @type {any} */ e) => {
						this.logger.silly(`feedback_update to connection failed: ${e.message} ${e.stack}`)
					})
				}
			}
		}
	}

	/**
	 * Remove any actions referencing a specified connectionId
	 * @param {string} connectionId
	 * @returns {boolean}
	 * @access public
	 */
	forgetConnection(connectionId) {
		let changed = false

		// Cleanup any feedbacks
		const newFeedbacks = []
		for (const feedback of this.feedbacks) {
			if (feedback.instance_id === connectionId) {
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
	 * Get the unparsed style for these feedbacks
	 * Note: Does not clone the style
	 * @returns {import('../../Shared/Model/StyleModel.js').UnparsedButtonStyle} the unprocessed style
	 * @access public
	 */
	getUnparsedStyle() {
		if (this.#booleanOnly) throw new Error('FragmentFeedbacks not setup to use styles')

		/** @type {import('../../Shared/Model/StyleModel.js').UnparsedButtonStyle} */
		let style = {
			...this.baseStyle,
			imageBuffers: [],
		}

		// Iterate through feedback-overrides
		for (const feedback of this.feedbacks) {
			if (feedback.disabled) continue

			const definition = this.instance.definitions.getFeedbackDefinition(feedback.instance_id, feedback.type)
			const rawValue = this.#cachedFeedbackValues[feedback.id]
			if (definition && rawValue !== undefined) {
				if (definition.type === 'boolean' && rawValue == !feedback.isInverted) {
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
	 * @returns {Promise<void>}
	 * @access protected
	 */
	async postProcessImport() {
		/** @type {Promise<any>[]} */
		const ps = []

		for (let i = 0; i < this.feedbacks.length; i++) {
			const feedback = this.feedbacks[i]
			feedback.id = nanoid()

			if (feedback.instance_id === 'internal') {
				const newFeedback = this.internalModule.feedbackUpgrade(feedback, this.controlId)
				if (newFeedback) {
					this.feedbacks[i] = newFeedback
				}

				setImmediate(() => {
					this.internalModule.feedbackUpdate(newFeedback || feedback, this.controlId)
				})
			} else {
				const instance = this.instance.moduleHost.getChild(feedback.instance_id, true)
				if (instance) {
					ps.push(instance.feedbackUpdate(feedback, this.controlId))
				}
			}
		}

		await Promise.all(ps).catch((/** @type {any} */ e) => {
			this.logger.silly(`postProcessImport for ${this.controlId} failed: ${e.message}`)
		})
	}

	/**
	 * Re-trigger 'subscribe' for all feedbacks
	 * This should be used when something has changed which will require all feedbacks to be re-run
	 * @returns {void}
	 */
	resubscribeAllFeedbacks() {
		// Some feedbacks will need to redraw
		for (const feedback of this.feedbacks) {
			this.#feedbackSubscribe(feedback)
		}
	}

	/**
	 * Perform an update of all internal feedbacks
	 * @returns {void}
	 */
	updateAllInternal() {
		for (const feedback of this.feedbacks) {
			if (feedback.instance_id === 'internal') {
				this.#feedbackSubscribe(feedback)
			}
		}
	}

	/**
	 * Update the feedbacks on the button with new values
	 * @param {string} connectionId The instance the feedbacks are for
	 * @param {Record<string, any>} newValues The new fedeback values
	 * @returns {void}
	 */
	updateFeedbackValues(connectionId, newValues) {
		let changed = false

		for (const feedback of this.feedbacks) {
			if (feedback.instance_id === connectionId) {
				if (feedback.id in newValues) {
					// Feedback is present in new values (might be set to undefined)
					const value = newValues[feedback.id]
					if (!isEqual(value, this.#cachedFeedbackValues[feedback.id])) {
						// Found the feedback, exactly where it said it would be
						// Mark the button as changed, and store the new value
						this.#cachedFeedbackValues[feedback.id] = value
						changed = true
					}
				}
			}
		}

		if (changed) {
			this.#triggerRedraw()
		}
	}

	/**
	 * Prune all actions/feedbacks referencing unknown conncetions
	 * Doesn't do any cleanup, as it is assumed that the connection has not been running
	 * @param {Set<string>} knownConnectionIds
	 * @access public
	 */
	verifyConnectionIds(knownConnectionIds) {
		let changed = false

		// Clean out feedbacks
		const feedbackLength = this.feedbacks.length
		this.feedbacks = this.feedbacks.filter((feedback) => !!feedback && knownConnectionIds.has(feedback.instance_id))
		changed = changed || this.feedbacks.length !== feedbackLength

		return changed
	}
}

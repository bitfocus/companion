import { cloneDeep } from 'lodash-es'
import LogController from '../../Log/Controller.js'
import { FragmentFeedbackInstance } from './FragmentFeedbackInstance.js'
import { FragmentFeedbackList } from './FragmentFeedbackList.js'

/**
 * @typedef {import('@companion-app/shared/Model/FeedbackModel.js').FeedbackInstance} FeedbackInstance
 */

/**
 * Helper for ControlTypes with feedbacks
 *
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
export default class FragmentFeedbacks {
	/**
	 * The defaults style for a button
	 * @type {import('@companion-app/shared/Model/StyleModel.js').ButtonStyleProperties}
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
	 * @type {import('@companion-app/shared/Model/StyleModel.js').ButtonStyleProperties}
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
	 * The feedbacks on this control
	 * @type {FragmentFeedbackList}
	 * @access public
	 */
	#feedbacks

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
	 * The logger
	 * @type {import('winston').Logger}
	 * @access private
	 */
	#logger

	/**
	 * @param {import('../../Instance/Definitions.js').default} instanceDefinitions
	 * @param {import('../../Internal/Controller.js').default} internalModule
	 * @param {import('../../Instance/Host.js').default} moduleHost
	 * @param {string} controlId - id of the control
	 * @param {(redraw?: boolean) => void} commitChange
	 * @param {() => void} triggerRedraw
	 * @param {boolean} booleanOnly
	 */
	constructor(instanceDefinitions, internalModule, moduleHost, controlId, commitChange, triggerRedraw, booleanOnly) {
		this.#logger = LogController.createLogger(`Controls/Fragments/Feedbacks/${controlId}`)

		this.controlId = controlId
		this.#commitChange = commitChange
		this.#triggerRedraw = triggerRedraw
		this.#booleanOnly = booleanOnly

		this.#feedbacks = new FragmentFeedbackList(
			instanceDefinitions,
			internalModule,
			moduleHost,
			this.controlId,
			this.#booleanOnly
		)
	}

	/**
	 * Initialise from storage
	 * @param {FeedbackInstance[]} feedbacks
	 * @param {boolean=} skipSubscribe Whether to skip calling subscribe for the new feedbacks
	 * @param {boolean=} isCloned Whether this is a cloned instance
	 */
	loadStorage(feedbacks, skipSubscribe, isCloned) {
		this.#feedbacks.loadStorage(feedbacks, !!skipSubscribe, !!isCloned)
	}

	/**
	 * Get the value from all feedbacks as a single boolean
	 */
	checkValueAsBoolean() {
		return this.#feedbacks.getBooleanValue()
	}

	/**
	 * Remove any tracked state for a connection
	 * @param {string} connectionId
	 * @access public
	 */
	clearConnectionState(connectionId) {
		const changed = this.#feedbacks.clearCachedValueForConnectionId(connectionId)
		if (changed) this.#triggerRedraw()
	}

	/**
	 * Prepare this control for deletion
	 * @access public
	 */
	destroy() {
		this.loadStorage([])
	}

	/**
	 * Add a feedback to this control
	 * @param {FeedbackInstance} feedbackItem the item to add
	 * @param {string | null} parentId the ids of parent feedback that this feedback should be added as a child of
	 * @returns {boolean} success
	 * @access public
	 */
	feedbackAdd(feedbackItem, parentId) {
		/** @type {FragmentFeedbackInstance} */
		let newFeedback

		if (parentId) {
			const parent = this.#feedbacks.findById(parentId)
			if (!parent) throw new Error(`Failed to find parent feedback ${parentId} when adding child feedback`)

			newFeedback = parent.addChild(feedbackItem)
		} else {
			newFeedback = this.#feedbacks.addFeedback(feedbackItem)
		}

		// Inform relevant module
		newFeedback.subscribe(true)

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
		const feedback = this.#feedbacks.duplicateFeedback(id)
		if (feedback) {
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
		const feedback = this.#feedbacks.findById(id)
		if (feedback) {
			feedback.setEnabled(enabled)

			this.#commitChange()

			return true
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
		const feedback = this.#feedbacks.findById(id)
		if (feedback) {
			feedback.setHeadline(headline)

			this.#commitChange()

			return true
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
		const feedback = this.#feedbacks.findById(id)
		if (!feedback) return false

		const changed = await feedback.learnOptions()
		if (!changed) return false

		// Time has passed due to the `await`
		// So the feedback may not still exist, meaning we should find it again to be sure
		const feedbackAfter = this.#feedbacks.findById(id)
		if (!feedbackAfter) return false

		this.#commitChange(true)
		return true
	}

	/**
	 * Remove a feedback from this control
	 * @param {string} id the id of the feedback
	 * @returns {boolean} success
	 * @access public
	 */
	feedbackRemove(id) {
		if (this.#feedbacks.removeFeedback(id)) {
			this.#commitChange()

			return true
		} else {
			return false
		}
	}

	/**
	 * Reorder a feedback in the list
	 * @param {string | null} oldParentId the parentId of the feedback to move
	 * @param {number} oldIndex the index of the feedback to move
	 * @param {string | null} newParentId the target parentId of the feedback
	 * @param {number} newIndex the target index of the feedback
	 * @returns {boolean}
	 * @access public
	 */
	feedbackReorder(oldParentId, oldIndex, newParentId, newIndex) {
		if (oldParentId === newParentId) {
			if (oldParentId) {
				const parentFeedback = this.#feedbacks.findById(oldParentId)
				if (!parentFeedback) return false

				parentFeedback.moveChild(oldIndex, newIndex)
			} else {
				this.#feedbacks.moveFeedback(oldIndex, newIndex)
			}
		} else {
			const newParent = newParentId ? this.#feedbacks.findById(newParentId) : null
			if (newParentId && !newParent) return false

			const poppedFeedback = oldParentId
				? this.#feedbacks.findById(oldParentId)?.popChild(oldIndex)
				: this.#feedbacks.popFeedback(oldIndex)
			if (!poppedFeedback) return false

			if (newParent) {
				newParent.pushChild(poppedFeedback, newIndex)
			} else {
				this.#feedbacks.pushFeedback(poppedFeedback, newIndex)
			}
		}

		this.#commitChange()

		return true
	}

	/**
	 * Replace a feedback with an updated version
	 * @param {Pick<FeedbackInstance, 'id' | 'type' | 'style' | 'options' | 'isInverted'>} newProps
	 * @access public
	 */
	feedbackReplace(newProps, skipNotifyModule = false) {
		const feedback = this.#feedbacks.findById(newProps.id)
		if (feedback) {
			feedback.replaceProps(newProps, skipNotifyModule)

			this.#commitChange(true)

			return true
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
		const feedback = this.#feedbacks.findById(id)
		if (feedback) {
			feedback.setOption(key, value)

			this.#commitChange()

			return true
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
		const feedback = this.#feedbacks.findById(id)
		if (feedback) {
			feedback.setInverted(!!isInverted)

			this.#commitChange()

			return true
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

		const feedback = this.#feedbacks.findById(id)
		if (feedback && feedback.setStyleSelection(selected, this.baseStyle)) {
			this.#commitChange()

			return true
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

		const feedback = this.#feedbacks.findById(id)
		if (feedback && feedback.setStyleValue(key, value)) {
			this.#commitChange()

			return true
		}

		return false
	}

	/**
	 * Remove any actions referencing a specified connectionId
	 * @param {string} connectionId
	 * @returns {boolean}
	 * @access public
	 */
	forgetConnection(connectionId) {
		// Cleanup any feedbacks
		return this.#feedbacks.forgetForConnection(connectionId)
	}

	/**
	 * Get all the feedback instances
	 * @returns {FeedbackInstance[]}
	 */
	getAllFeedbackInstances() {
		return this.#feedbacks.asFeedbackInstances()
	}

	/**
	 * Get all the feedback instances
	 * @param {string=} onlyConnectionId Optionally, only for a specific connection
	 * @returns {Omit<FeedbackInstance, 'children'>[]}
	 */
	getFlattenedFeedbackInstances(onlyConnectionId) {
		/** @type {FeedbackInstance[]} */
		const instances = []

		const extractInstances = (/** @type {FeedbackInstance[]} */ feedbacks) => {
			for (const feedback of feedbacks) {
				if (!onlyConnectionId || onlyConnectionId === feedback.instance_id) {
					instances.push({
						...feedback,
						children: undefined,
					})
				}

				if (feedback.children) {
					extractInstances(feedback.children)
				}
			}
		}

		extractInstances(this.#feedbacks.asFeedbackInstances())

		return instances
	}

	/**
	 * Get the unparsed style for these feedbacks
	 * Note: Does not clone the style
	 * @returns {import('@companion-app/shared/Model/StyleModel.js').UnparsedButtonStyle} the unprocessed style
	 * @access public
	 */
	getUnparsedStyle() {
		return this.#feedbacks.getUnparsedStyle(this.baseStyle)
	}

	/**
	 * If this control was imported to a running system, do some data cleanup/validation
	 * @returns {Promise<void>}
	 * @access protected
	 */
	async postProcessImport() {
		await Promise.all(this.#feedbacks.postProcessImport()).catch((/** @type {any} */ e) => {
			this.#logger.silly(`postProcessImport for ${this.controlId} failed: ${e.message}`)
		})
	}

	/**
	 * Re-trigger 'subscribe' for all feedbacks
	 * This should be used when something has changed which will require all feedbacks to be re-run
	 * @param {string=} onlyConnectionId If set, only re-subscribe feedbacks for this connection
	 * @returns {void}
	 */
	resubscribeAllFeedbacks(onlyConnectionId) {
		this.#feedbacks.subscribe(true, onlyConnectionId)
	}

	/**
	 * Update the feedbacks on the button with new values
	 * @param {string} connectionId The instance the feedbacks are for
	 * @param {Record<string, any>} newValues The new fedeback values
	 * @returns {void}
	 */
	updateFeedbackValues(connectionId, newValues) {
		let changed = false

		for (const id in newValues) {
			const feedback = this.#feedbacks.findById(id)
			if (feedback && feedback.connectionId === connectionId && feedback.setCachedValue(newValues[id])) {
				changed = true
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
		return this.#feedbacks.verifyConnectionIds(knownConnectionIds)
	}
}

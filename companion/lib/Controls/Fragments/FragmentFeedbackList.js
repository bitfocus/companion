import { FragmentFeedbackInstance } from './FragmentFeedbackInstance.js'
import { clamp } from '../../Resources/Util.js'

export class FragmentFeedbackList {
	/**
	 * @type {import('../../Instance/Definitions.js').default}
	 * @access private
	 */
	#instanceDefinitions

	/**
	 * @type {import('../../Internal/Controller.js').default}
	 * @access private
	 */
	#internalModule

	/**
	 * @type {import('../../Instance/Host.js').default}
	 * @access private
	 */
	#moduleHost

	/**
	 * Id of the control this belongs to
	 * @type {string}
	 * @access private
	 */
	#controlId

	/**
	 * Whether this set of feedbacks can only use boolean feedbacks
	 * @type {boolean}
	 * @access private
	 */
	#booleanOnly

	/**
	 * @type {FragmentFeedbackInstance[]}
	 */
	#feedbacks = []

	/**
	 * @param {import('../../Instance/Definitions.js').default} instanceDefinitions
	 * @param {import('../../Internal/Controller.js').default} internalModule
	 * @param {import('../../Instance/Host.js').default} moduleHost
	 * @param {string} controlId - id of the control
	 * @param {boolean} booleanOnly
	 */
	constructor(instanceDefinitions, internalModule, moduleHost, controlId, booleanOnly) {
		this.#instanceDefinitions = instanceDefinitions
		this.#internalModule = internalModule
		this.#moduleHost = moduleHost
		this.#controlId = controlId
		this.#booleanOnly = booleanOnly
	}

	/**
	 * Get the contained feedbacks as `FeedbackInstance`s
	 * @returns {import('./FragmentFeedbackInstance.js').FeedbackInstance[]}
	 */
	asFeedbackInstances() {
		return this.#feedbacks.map((feedback) => feedback.asFeedbackInstance())
	}

	/**
	 * Get the value of this feedback as a boolean
	 * @returns {boolean}
	 */
	getBooleanValue() {
		if (!this.#booleanOnly) throw new Error('FragmentFeedbacks is setup to use styles')

		let result = true

		for (const feedback of this.#feedbacks) {
			if (feedback.disabled) continue

			result = result && feedback.getBooleanValue()
		}

		return result
	}

	/**
	 * Initialise from storage
	 * @param {import('./FragmentFeedbackInstance.js').FeedbackInstance[]} feedbacks
	 * @param {boolean} skipSubscribe Whether to skip calling subscribe for the new feedbacks
	 * @param {boolean} isCloned Whether this is a cloned instance
	 */
	loadStorage(feedbacks, skipSubscribe, isCloned) {
		// Inform modules of feedback cleanup
		for (const feedback of this.#feedbacks) {
			feedback.cleanup()
		}

		this.#feedbacks =
			feedbacks?.map(
				(feedback) =>
					new FragmentFeedbackInstance(
						this.#instanceDefinitions,
						this.#internalModule,
						this.#moduleHost,
						this.#controlId,
						feedback,
						!!isCloned
					)
			) || []

		if (!skipSubscribe) {
			this.subscribe(true)
		}
	}

	/**
	 * Inform the instance of any removed feedbacks
	 * @access public
	 */
	cleanup() {
		for (const feedback of this.#feedbacks) {
			feedback.cleanup()
		}
	}

	/**
	 * Inform the instance of an updated feedback
	 * @param {boolean} recursive whether to call recursively
	 * @param {string=} onlyConnectionId If set, only subscribe feedbacks for this connection
	 * @returns {void}
	 * @access private
	 */
	subscribe(recursive, onlyConnectionId) {
		for (const child of this.#feedbacks) {
			child.subscribe(recursive, onlyConnectionId)
		}
	}

	/**
	 * Clear cached values for any feedback belonging to the given connection
	 * @param {string} connectionId
	 * @returns {boolean} Whether a value was changed
	 */
	clearCachedValueForConnectionId(connectionId) {
		let changed = false

		for (const feedback of this.#feedbacks) {
			if (feedback.clearCachedValueForConnectionId(connectionId)) {
				changed = true
			}
		}

		return changed
	}

	/**
	 * Find a child feedback by id
	 * @param {string} id
	 * @returns {FragmentFeedbackInstance | undefined}
	 */
	findById(id) {
		for (const feedback of this.#feedbacks) {
			if (feedback.id === id) return feedback

			const found = feedback.findChildById(id)
			if (found) return found
		}

		return undefined
	}

	// /**
	//  * Find the index of a child feedback, and the parent list
	//  * @param {string} id
	//  * @returns {{ parent: FragmentFeedbackList, index: number, item: FragmentFeedbackInstance } | undefined}
	//  */
	// findParentAndIndex(id) {
	// 	const index = this.#feedbacks.findIndex((fb) => fb.id === id)
	// 	if (index !== -1) {
	// 		return { parent: this, index, item: this.#feedbacks[index] }
	// 	}
	// 	for (const feedback of this.#feedbacks) {
	// 		return feedback.findParentAndIndex(id)
	// 	}
	// 	return undefined
	// }

	/**
	 * Add a child feedback to this feedback
	 * @param {import('./FragmentFeedbackInstance.js').FeedbackInstance} feedback
	 * @param {boolean=} isCloned Whether this is a cloned instance
	 * @returns {FragmentFeedbackInstance}
	 */
	addFeedback(feedback, isCloned) {
		const newFeedback = new FragmentFeedbackInstance(
			this.#instanceDefinitions,
			this.#internalModule,
			this.#moduleHost,
			this.#controlId,
			feedback,
			!!isCloned
		)

		// TODO - verify that the feedback matches this.#booleanOnly?

		this.#feedbacks.push(newFeedback)

		return newFeedback
	}

	/**
	 * Remove a child feedback
	 * @param {string} id
	 * @returns {boolean} success
	 */
	removeFeedback(id) {
		const index = this.#feedbacks.findIndex((fb) => fb.id === id)
		if (index !== -1) {
			const feedback = this.#feedbacks[index]
			this.#feedbacks.splice(index, 1)

			feedback.cleanup()

			return true
		}

		for (const feedback of this.#feedbacks) {
			if (feedback.removeChild(id)) return true
		}

		return false
	}

	/**
	 * Reorder a feedback in the list
	 * @param {number} oldIndex
	 * @param {number} newIndex
	 */
	moveFeedback(oldIndex, newIndex) {
		oldIndex = clamp(oldIndex, 0, this.#feedbacks.length)
		newIndex = clamp(newIndex, 0, this.#feedbacks.length)
		this.#feedbacks.splice(newIndex, 0, ...this.#feedbacks.splice(oldIndex, 1))
	}

	/**
	 * Pop a child feedback from the list
	 * Note: this is used when moving a feedback to a different parent. Lifecycle is not managed
	 * @param {number} index
	 * @returns {FragmentFeedbackInstance | undefined}
	 */
	popFeedback(index) {
		const feedback = this.#feedbacks[index]
		if (!feedback) return undefined

		this.#feedbacks.splice(index, 1)

		return feedback
	}

	/**
	 * Push a child feedback to the list
	 * Note: this is used when moving a feedback from a different parent. Lifecycle is not managed
	 * @param {FragmentFeedbackInstance} feedback
	 * @param {number} index
	 */
	pushFeedback(feedback, index) {
		index = clamp(index, 0, this.#feedbacks.length)

		this.#feedbacks.splice(index, 0, feedback)
	}

	/**
	 * Duplicate a feedback
	 * @param {string} id
	 * @returns {FragmentFeedbackInstance | undefined}
	 */
	duplicateFeedback(id) {
		const feedbackIndex = this.#feedbacks.findIndex((fb) => fb.id === id)
		if (feedbackIndex !== -1) {
			const feedbackInstance = this.#feedbacks[feedbackIndex].asFeedbackInstance()
			const newFeedback = new FragmentFeedbackInstance(
				this.#instanceDefinitions,
				this.#internalModule,
				this.#moduleHost,
				this.#controlId,
				feedbackInstance,
				true
			)

			this.#feedbacks.splice(feedbackIndex + 1, 0, newFeedback)

			newFeedback.subscribe(true)

			return newFeedback
		}

		for (const feedback of this.#feedbacks) {
			const newFeedback = feedback.duplicateChild(id)
			if (newFeedback) return newFeedback
		}

		return undefined
	}

	/**
	 * Cleanup and forget any children belonging to the given connection
	 * @param {string} connectionId
	 * @returns {boolean}
	 */
	forgetForConnection(connectionId) {
		let changed = false

		this.#feedbacks = this.#feedbacks.filter((feedback) => {
			if (feedback.connectionId === connectionId) {
				feedback.cleanup()

				return false
			} else {
				changed = feedback.forgetChildrenForConnection(connectionId)
				return true
			}
		})

		return changed
	}

	/**
	 * Prune all actions/feedbacks referencing unknown conncetions
	 * Doesn't do any cleanup, as it is assumed that the connection has not been running
	 * @param {Set<string>} knownConnectionIds
	 * @access public
	 */
	verifyConnectionIds(knownConnectionIds) {
		// Clean out feedbacks
		const feedbackLength = this.#feedbacks.length
		this.feedbacks = this.#feedbacks.filter((feedback) => !!feedback && knownConnectionIds.has(feedback.connectionId))
		let changed = this.#feedbacks.length !== feedbackLength

		for (const feedback of this.#feedbacks) {
			if (feedback.verifyChildConnectionIds(knownConnectionIds)) {
				changed = true
			}
		}

		return changed
	}

	/**
	 * Get the unparsed style for these feedbacks
	 * Note: Does not clone the style
	 * @param {import('@companion-app/shared/Model/StyleModel.js').ButtonStyleProperties} baseStyle Style of the button without feedbacks applied
	 * @returns {import('@companion-app/shared/Model/StyleModel.js').UnparsedButtonStyle} the unprocessed style
	 * @access public
	 */
	getUnparsedStyle(baseStyle) {
		if (this.#booleanOnly) throw new Error('FragmentFeedbacks not setup to use styles')

		/** @type {import('@companion-app/shared/Model/StyleModel.js').UnparsedButtonStyle} */
		let style = {
			...baseStyle,
			imageBuffers: [],
		}

		// Note: We don't need to consider children of the feedbacks here, as that can only be from boolean feedbacks which are handled by the `getBooleanValue`

		for (const feedback of this.#feedbacks) {
			if (feedback.disabled) continue

			const definition = feedback.getDefinition()
			if (definition?.type === 'boolean') {
				const booleanValue = feedback.getBooleanValue()
				if (booleanValue) {
					style = {
						...style,
						...feedback.asFeedbackInstance().style,
					}
				}
			} else if (definition?.type === 'advanced') {
				const rawValue = feedback.cachedValue
				if (typeof rawValue === 'object' && rawValue !== undefined) {
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
	 * @returns {Promise<void>[]}
	 * @access protected
	 */
	postProcessImport() {
		return this.#feedbacks.flatMap((feedback) => feedback.postProcessImport())
	}
}

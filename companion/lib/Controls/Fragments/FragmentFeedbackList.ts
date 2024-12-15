import { FragmentFeedbackInstance } from './FragmentFeedbackInstance.js'
import { clamp } from '../../Resources/Util.js'
import type { InstanceDefinitions } from '../../Instance/Definitions.js'
import type { InternalController } from '../../Internal/Controller.js'
import type { ModuleHost } from '../../Instance/Host.js'
import type { FeedbackInstance } from '@companion-app/shared/Model/FeedbackModel.js'
import type { ButtonStyleProperties, UnparsedButtonStyle } from '@companion-app/shared/Model/StyleModel.js'

export class FragmentFeedbackList {
	readonly #instanceDefinitions: InstanceDefinitions
	readonly #internalModule: InternalController
	readonly #moduleHost: ModuleHost

	/**
	 * Id of the control this belongs to
	 */
	readonly #controlId: string

	readonly #id: string | null

	/**
	 * Whether this set of feedbacks can only use boolean feedbacks
	 */
	readonly #booleanOnly: boolean

	#feedbacks: FragmentFeedbackInstance[] = []

	get id(): string | null {
		return this.#id
	}

	constructor(
		instanceDefinitions: InstanceDefinitions,
		internalModule: InternalController,
		moduleHost: ModuleHost,
		controlId: string,
		id: string | null,
		booleanOnly: boolean
	) {
		this.#instanceDefinitions = instanceDefinitions
		this.#internalModule = internalModule
		this.#moduleHost = moduleHost
		this.#controlId = controlId
		this.#id = id
		this.#booleanOnly = booleanOnly
	}

	/**
	 * Get all the feedbacks
	 */
	getAllFeedbacks(): FragmentFeedbackInstance[] {
		return [...this.#feedbacks, ...this.#feedbacks.flatMap((feedback) => feedback.getAllChildren())]
	}

	/**
	 * Get the contained feedbacks as `FeedbackInstance`s
	 */
	asFeedbackInstances(): FeedbackInstance[] {
		return this.#feedbacks.map((feedback) => feedback.asFeedbackInstance())
	}

	/**
	 * Get the value of this feedback as a boolean
	 */
	getBooleanValue(): boolean {
		if (!this.#booleanOnly) throw new Error('FragmentFeedbacks is setup to use styles')

		let result = true

		for (const feedback of this.#feedbacks) {
			if (feedback.disabled) continue

			result = result && feedback.getBooleanValue()
		}

		return result
	}

	getChildBooleanValues(): boolean[] {
		if (!this.#booleanOnly) throw new Error('FragmentFeedbacks is setup to use styles')

		const values: boolean[] = []

		for (const feedback of this.#feedbacks) {
			if (feedback.disabled) continue

			values.push(feedback.getBooleanValue())
		}

		return values
	}

	/**
	 * Initialise from storage
	 * @param feedbacks
	 * @param skipSubscribe Whether to skip calling subscribe for the new feedbacks
	 * @param isCloned Whether this is a cloned instance
	 */
	loadStorage(feedbacks: FeedbackInstance[], skipSubscribe: boolean, isCloned: boolean): void {
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
		this.#feedbacks = []
	}

	/**
	 * Inform the instance of an updated feedback
	 * @param recursive whether to call recursively
	 * @param onlyConnectionId If set, only subscribe feedbacks for this connection
	 */
	subscribe(recursive: boolean, onlyConnectionId?: string): void {
		for (const child of this.#feedbacks) {
			child.subscribe(recursive, onlyConnectionId)
		}
	}

	/**
	 * Clear cached values for any feedback belonging to the given connection
	 * @returns Whether a value was changed
	 */
	clearCachedValueForConnectionId(connectionId: string): boolean {
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
	 */
	findById(id: string): FragmentFeedbackInstance | undefined {
		for (const feedback of this.#feedbacks) {
			if (feedback.id === id) return feedback

			const found = feedback.findChildById(id)
			if (found) return found
		}

		return undefined
	}

	/**
	 * Find the index of a child feedback, and the parent list
	 */
	findParentAndIndex(
		id: string
	): { parent: FragmentFeedbackList; index: number; item: FragmentFeedbackInstance } | undefined {
		const index = this.#feedbacks.findIndex((fb) => fb.id === id)
		if (index !== -1) {
			return { parent: this, index, item: this.#feedbacks[index] }
		}

		for (const feedback of this.#feedbacks) {
			const found = feedback.findParentAndIndex(id)
			if (found) return found
		}

		return undefined
	}

	/**
	 * Add a child feedback to this feedback
	 * @param feedback
	 * @param isCloned Whether this is a cloned instance
	 */
	addFeedback(feedback: FeedbackInstance, isCloned?: boolean): FragmentFeedbackInstance {
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
	 */
	removeFeedback(id: string): boolean {
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
	 */
	moveFeedback(oldIndex: number, newIndex: number): void {
		oldIndex = clamp(oldIndex, 0, this.#feedbacks.length)
		newIndex = clamp(newIndex, 0, this.#feedbacks.length)
		this.#feedbacks.splice(newIndex, 0, ...this.#feedbacks.splice(oldIndex, 1))
	}

	/**
	 * Pop a child feedback from the list
	 * Note: this is used when moving a feedback to a different parent. Lifecycle is not managed
	 */
	popFeedback(index: number): FragmentFeedbackInstance | undefined {
		const feedback = this.#feedbacks[index]
		if (!feedback) return undefined

		this.#feedbacks.splice(index, 1)

		return feedback
	}

	/**
	 * Push a child feedback to the list
	 * Note: this is used when moving a feedback from a different parent. Lifecycle is not managed
	 */
	pushFeedback(feedback: FragmentFeedbackInstance, index: number): void {
		index = clamp(index, 0, this.#feedbacks.length)

		this.#feedbacks.splice(index, 0, feedback)
	}

	/**
	 * Check if this list can accept a specified child
	 */
	canAcceptFeedback(feedback: FragmentFeedbackInstance): boolean {
		if (!this.#booleanOnly) return true

		const definition = feedback.getDefinition()
		if (!definition || definition.type !== 'boolean') return false

		return true
	}

	/**
	 * Duplicate a feedback
	 */
	duplicateFeedback(id: string): FragmentFeedbackInstance | undefined {
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
	 */
	forgetForConnection(connectionId: string): boolean {
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
	 */
	verifyConnectionIds(knownConnectionIds: Set<string>): boolean {
		// Clean out feedbacks
		const feedbackLength = this.#feedbacks.length
		this.#feedbacks = this.#feedbacks.filter((feedback) => !!feedback && knownConnectionIds.has(feedback.connectionId))
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
	 * @param baseStyle Style of the button without feedbacks applied
	 * @returns the unprocessed style
	 */
	getUnparsedStyle(baseStyle: ButtonStyleProperties): UnparsedButtonStyle {
		if (this.#booleanOnly) throw new Error('FragmentFeedbacks not setup to use styles')

		let style: UnparsedButtonStyle = {
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
							...rawValue.imageBufferEncoding,
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
	 */
	postProcessImport(): Promise<void>[] {
		return this.#feedbacks.flatMap((feedback) => feedback.postProcessImport())
	}
}

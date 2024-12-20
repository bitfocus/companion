import { FragmentFeedbackInstance } from './FragmentFeedbackInstance.js'
import { clamp } from '../../Resources/Util.js'
import type { InstanceDefinitions } from '../../Instance/Definitions.js'
import type { InternalController } from '../../Internal/Controller.js'
import type { ModuleHost } from '../../Instance/Host.js'
import type { FeedbackInstance, FeedbackOwner } from '@companion-app/shared/Model/FeedbackModel.js'

export class FragmentFeedbackList {
	readonly #instanceDefinitions: InstanceDefinitions
	readonly #internalModule: InternalController
	readonly #moduleHost: ModuleHost

	/**
	 * Id of the control this belongs to
	 */
	readonly #controlId: string

	readonly #ownerId: FeedbackOwner | null

	/**
	 * Whether this set of feedbacks can only use boolean feedbacks
	 */
	readonly #onlyType: 'boolean' | 'advanced' | null

	#feedbacks: FragmentFeedbackInstance[] = []

	get ownerId(): FeedbackOwner | null {
		return this.#ownerId
	}

	constructor(
		instanceDefinitions: InstanceDefinitions,
		internalModule: InternalController,
		moduleHost: ModuleHost,
		controlId: string,
		ownerId: FeedbackOwner | null,
		onlyType: 'boolean' | 'advanced' | null
	) {
		this.#instanceDefinitions = instanceDefinitions
		this.#internalModule = internalModule
		this.#moduleHost = moduleHost
		this.#controlId = controlId
		this.#ownerId = ownerId
		this.#onlyType = onlyType
	}

	/**
	 * Get the feedbacks
	 */
	getFeedbacks(): FragmentFeedbackInstance[] {
		return this.#feedbacks
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
}

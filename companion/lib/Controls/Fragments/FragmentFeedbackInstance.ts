import { cloneDeep } from 'lodash-es'
import { nanoid } from 'nanoid'
import LogController, { Logger } from '../../Log/Controller.js'
import { FragmentFeedbackList } from './FragmentFeedbackList.js'
import { visitFeedbackInstance } from '../../Resources/Visitors/FeedbackInstanceVisitor.js'
import type { InstanceDefinitions } from '../../Instance/Definitions.js'
import type { InternalController } from '../../Internal/Controller.js'
import type { ModuleHost } from '../../Instance/Host.js'
import type { FeedbackChildGroup, FeedbackInstance } from '@companion-app/shared/Model/FeedbackModel.js'
import type { ButtonStyleProperties } from '@companion-app/shared/Model/StyleModel.js'
import type { CompanionButtonStyleProps } from '@companion-module/base'
import type { InternalVisitor } from '../../Internal/Types.js'
import type { FeedbackDefinition } from '@companion-app/shared/Model/FeedbackDefinitionModel.js'
import { assertNever } from '@companion-app/shared/Util.js'

export class FragmentFeedbackInstance {
	/**
	 * The logger
	 */
	readonly #logger: Logger

	readonly #instanceDefinitions: InstanceDefinitions
	readonly #internalModule: InternalController
	readonly #moduleHost: ModuleHost

	/**
	 * Id of the control this belongs to
	 */
	readonly #controlId: string

	readonly #data: Omit<FeedbackInstance, 'children' | 'advancedChildren'>

	#children = new Map<FeedbackChildGroup, FragmentFeedbackList>()

	/**
	 * Value of the feedback when it was last executed
	 */
	#cachedValue: any = undefined

	/**
	 * Get the id of this feedback instance
	 */
	get id(): string {
		return this.#data.id
	}

	get disabled(): boolean {
		return !!this.#data.disabled
	}

	get feedbackId(): string {
		return this.#data.type
	}

	/**
	 * Get the id of the connection this feedback belongs to
	 */
	get connectionId(): string {
		return this.#data.instance_id
	}

	get cachedValue(): any {
		return this.#cachedValue
	}

	/**
	 * Get a reference to the options for this feedback
	 * Note: This must not be a copy, but the raw object
	 */
	get rawOptions() {
		return this.#data.options
	}

	/**
	 * @param instanceDefinitions
	 * @param internalModule
	 * @param moduleHost
	 * @param controlId - id of the control
	 * @param data
	 * @param isCloned Whether this is a cloned instance and should generate new ids
	 */
	constructor(
		instanceDefinitions: InstanceDefinitions,
		internalModule: InternalController,
		moduleHost: ModuleHost,
		controlId: string,
		data: FeedbackInstance,
		isCloned: boolean
	) {
		this.#logger = LogController.createLogger(`Controls/Fragments/Feedbacks/${controlId}`)

		this.#instanceDefinitions = instanceDefinitions
		this.#internalModule = internalModule
		this.#moduleHost = moduleHost
		this.#controlId = controlId

		this.#data = cloneDeep(data) // TODO - cleanup unwanted properties
		if (!this.#data.options) this.#data.options = {}

		if (isCloned) {
			this.#data.id = nanoid()
		}

		try {
			const childGroup = this.#getOrCreateFeedbackGroup('children')
			if (data.instance_id === 'internal' && data.children) {
				childGroup.loadStorage(data.children, true, isCloned)
			}
		} catch (e: any) {
			this.#logger.error(`Error loading child feedback group: ${e.message}`)
		}

		try {
			const childGroup = this.#getOrCreateFeedbackGroup('advancedChildren')
			if (data.instance_id === 'internal' && data.advancedChildren) {
				childGroup.loadStorage(data.advancedChildren, true, isCloned)
			}
		} catch (e: any) {
			this.#logger.error(`Error loading advancedChildren feedback group: ${e.message}`)
		}
	}

	#getOrCreateFeedbackGroup(groupId: FeedbackChildGroup): FragmentFeedbackList {
		const existing = this.#children.get(groupId)
		if (existing) return existing

		// Check what names are allowed
		const definition = this.connectionId === 'internal' && this.getDefinition()
		if (!definition) throw new Error('Feedback cannot accept children.')

		let childType: 'boolean' | 'advanced'

		switch (groupId) {
			case 'children':
				childType = 'boolean'
				if (!definition.supportsChildFeedbacks) {
					throw new Error('Feedback cannot accept children in this group.')
				}
				break
			case 'advancedChildren':
				childType = 'advanced'
				if (!definition.supportsAdvancedChildFeedbacks) {
					throw new Error("Feedback cannot accept 'advanced' children in this group.")
				}
				break
			default:
				assertNever(groupId)
				throw new Error(`Feedback cannot accept children of type "${groupId}".`)
		}

		const childGroup = new FragmentFeedbackList(
			this.#instanceDefinitions,
			this.#internalModule,
			this.#moduleHost,
			this.#controlId,
			{ parentFeedbackId: this.id, childGroup: groupId },
			childType
		)
		this.#children.set(groupId, childGroup)

		return childGroup
	}

	/**
	 * Get the definition for this feedback
	 */
	getDefinition(): FeedbackDefinition | undefined {
		return this.#instanceDefinitions.getFeedbackDefinition(this.#data.instance_id, this.#data.type)
	}

	/**
	 * Inform the instance of an updated feedback
	 * @param recursive whether to call recursively
	 * @param onlyConnectionId If set, only subscribe feedbacks for this connection
	 */
	subscribe(recursive: boolean, onlyConnectionId?: string): void {
		if (this.#data.disabled) return

		if (!onlyConnectionId || this.#data.instance_id === onlyConnectionId) {
			if (this.#data.instance_id === 'internal') {
				this.#internalModule.feedbackUpdate(this.asFeedbackInstance(), this.#controlId)
			} else {
				const connection = this.#moduleHost.getChild(this.#data.instance_id, true)
				if (connection) {
					connection.feedbackUpdate(this.asFeedbackInstance(), this.#controlId).catch((e) => {
						this.#logger.silly(`feedback_update to connection failed: ${e.message} ${e.stack}`)
					})
				}
			}
		}

		if (recursive) {
			for (const childGroup of this.#children.values()) {
				childGroup.subscribe(recursive, onlyConnectionId)
			}
		}
	}

	/**
	 * Find a child feedback by id
	 */
	findChildById(id: string): FragmentFeedbackInstance | undefined {
		for (const childGroup of this.#children.values()) {
			const result = childGroup.findById(id)
			if (result) return result
		}
		return undefined
	}

	/**
	 * Find the index of a child feedback, and the parent list
	 */
	findParentAndIndex(
		id: string
	): { parent: FragmentFeedbackList; index: number; item: FragmentFeedbackInstance } | undefined {
		for (const childGroup of this.#children.values()) {
			const result = childGroup.findParentAndIndex(id)
			if (result) return result
		}
		return undefined
	}

	// /**
	//  * Reorder a feedback in the list
	//  */
	// moveChild(oldIndex: number, newIndex: number): void {
	// 	return this.#children.moveFeedback(oldIndex, newIndex)
	// }

	// /**
	//  * Pop a child feedback from the list
	//  * Note: this is used when moving a feedback to a different parent. Lifecycle is not managed
	//  */
	// popChild(index: number): FragmentFeedbackInstance | undefined {
	// 	return this.#children.popFeedback(index)
	// }

	/**
	 * Push a child feedback to the list
	 * Note: this is used when moving a feedback from a different parent. Lifecycle is not managed
	 */
	pushChild(feedback: FragmentFeedbackInstance, groupId: FeedbackChildGroup, index: number): void {
		const childGroup = this.#getOrCreateFeedbackGroup(groupId)
		return childGroup.pushFeedback(feedback, index)
	}

	/**
	 * Recursively get all the feedbacks
	 */
	getChildrenOfGroup(groupId: FeedbackChildGroup): FragmentFeedbackInstance[] {
		return this.#children.get(groupId)?.getFeedbacks() ?? []
	}

	/**
	 * Replace portions of the feedback with an updated version
	 */
	replaceProps(
		newProps: Pick<FeedbackInstance, 'type' | 'style' | 'options' | 'isInverted'>,
		skipNotifyModule = false
	): void {
		this.#data.type = newProps.type // || newProps.feedbackId
		this.#data.options = newProps.options
		this.#data.isInverted = !!newProps.isInverted

		delete this.#data.upgradeIndex

		// Preserve existing value if it is set
		this.#data.style = Object.keys(this.#data.style || {}).length > 0 ? this.#data.style : newProps.style

		if (!skipNotifyModule) {
			this.subscribe(false)
		}
	}
}

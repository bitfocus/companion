import LogController, { Logger } from '../../Log/Controller.js'
import { EntityModelType, type SomeSocketEntityLocation } from '@companion-app/shared/Model/EntityModel.js'
import type { ControlEntityInstance } from './EntityInstance.js'
import { ControlEntityList } from './EntityList.js'
import type { InstanceDefinitions } from '../../Instance/Definitions.js'
import type { ModuleHost } from '../../Instance/Host.js'
import type { InternalController } from '../../Internal/Controller.js'

export interface ControlEntityListPoolProps {
	instanceDefinitions: InstanceDefinitions
	internalModule: InternalController
	moduleHost: ModuleHost
	controlId: string
	commitChange: (redraw?: boolean) => void
	triggerRedraw: () => void
}

export abstract class ControlEntityListPoolBase {
	/**
	 * The logger
	 */
	readonly #logger: Logger

	readonly #instanceDefinitions: InstanceDefinitions
	readonly #internalModule: InternalController
	readonly #moduleHost: ModuleHost

	readonly #controlId: string

	/**
	 * Commit changes to the database and disk
	 */
	readonly #commitChange: (redraw?: boolean) => void

	/**
	 * Trigger a redraw/invalidation of the control
	 */
	readonly #triggerRedraw: () => void

	// TODO

	protected constructor(props: ControlEntityListPoolProps) {
		this.#logger = LogController.createLogger(`Controls/Fragments/EnittyPool/${props.controlId}`)

		this.#controlId = props.controlId
		this.#commitChange = props.commitChange
		this.#triggerRedraw = props.triggerRedraw

		this.#instanceDefinitions = props.instanceDefinitions
		this.#internalModule = props.internalModule
		this.#moduleHost = props.moduleHost
	}

	/**
	 * Remove any tracked state for a connection
	 */
	clearConnectionState(connectionId: string): void {
		let changed = false
		for (const list of this.getAllEntityLists()) {
			if (list.clearCachedValueForConnectionId(connectionId)) changed = true
		}
		if (changed) this.#triggerRedraw()
	}

	protected abstract getEntityList(listId: SomeSocketEntityLocation): ControlEntityList | undefined
	protected abstract getAllEntityLists(): ControlEntityList[]

	/**
	 * Recursively get all the entities
	 */
	getAllEntities(): ControlEntityInstance[] {
		return this.getAllEntityLists().flatMap((entityList) => entityList.getAllEntities())
	}

	/**
	 *
	 * @param listId
	 * @returns
	 */
	getAllEntitiesInList(listId: SomeSocketEntityLocation, recursive = false): ControlEntityInstance[] {
		const list = this.getEntityList(listId)
		if (!list) return []

		if (recursive) return list.getAllEntities()
		return list.getDirectEntities()
	}

	/**
	 * Re-trigger 'subscribe' for all entities
	 * This should be used when something has changed which will require all feedbacks to be re-run
	 * @param onlyType If set, only re-subscribe entities of this type
	 * @param onlyConnectionId If set, only re-subscribe entities for this connection
	 */
	resubscribeEntities(onlyType?: EntityModelType, onlyConnectionId?: string): void {
		for (const list of this.getAllEntityLists()) {
			list.subscribe(true, onlyType, onlyConnectionId)
		}
	}

	// /**
	//  * Add a feedback to this control
	//  * @param feedbackItem the item to add
	//  * @param ownerId the ids of parent feedback that this feedback should be added as a child of
	//  */
	// feedbackAdd(feedbackItem: FeedbackInstance, ownerId: FeedbackOwner | null): boolean {
	// 	let newFeedback: FragmentFeedbackInstance

	// 	if (ownerId) {
	// 		const parent = this.#feedbacks.findById(ownerId.parentFeedbackId)
	// 		if (!parent)
	// 			throw new Error(`Failed to find parent feedback ${ownerId.parentFeedbackId} when adding child feedback`)

	// 		newFeedback = parent.addChild(ownerId.childGroup, feedbackItem)
	// 	} else {
	// 		newFeedback = this.#feedbacks.addFeedback(feedbackItem)
	// 	}

	// 	// Inform relevant module
	// 	newFeedback.subscribe(true)

	// 	this.#commitChange()

	// 	return true
	// }

	/**
	 * Duplicate an feedback on this control
	 */
	entityDuplicate(listId: SomeSocketEntityLocation, id: string): boolean {
		const entityList = this.getEntityList(listId)
		if (!entityList) return false

		const entity = entityList.duplicateEntity(id)
		if (!entity) return false

		this.#commitChange(false)

		return true
	}

	/**
	 * Enable or disable an entity
	 */
	entityEnabled(listId: SomeSocketEntityLocation, id: string, enabled: boolean): boolean {
		const entityList = this.getEntityList(listId)
		if (!entityList) return false

		const entity = entityList.findById(id)
		if (!entity) return false

		entity.setEnabled(enabled)

		this.#commitChange()

		return true
	}

	/**
	 * Set headline for the entity
	 */
	entityHeadline(listId: SomeSocketEntityLocation, id: string, headline: string): boolean {
		const entityList = this.getEntityList(listId)
		if (!entityList) return false

		const entity = entityList.findById(id)
		if (!entity) return false

		entity.setHeadline(headline)

		this.#commitChange()

		return true
	}

	/**
	 * Learn the options for a feedback, by asking the instance for the current values
	 */
	async entityLearn(listId: SomeSocketEntityLocation, id: string): Promise<boolean> {
		const entityList = this.getEntityList(listId)
		if (!entityList) return false

		const entity = entityList.findById(id)
		if (!entity) return false

		const changed = await entity.learnOptions()
		if (!changed) return false

		// Time has passed due to the `await`
		// So the entity may not still exist, meaning we should find it again to be sure
		const feedbackAfter = entityList.findById(id)
		if (!feedbackAfter) return false

		this.#commitChange(true)
		return true
	}

	/**
	 * Remove an entity from this control
	 */
	entityRemove(listId: SomeSocketEntityLocation, id: string): boolean {
		const entityList = this.getEntityList(listId)
		if (!entityList) return false

		if (entityList.removeEntity(id)) {
			this.#commitChange()

			return true
		} else {
			return false
		}
	}

	// /**
	//  * Move a feedback within the hierarchy
	//  * @param moveFeedbackId the id of the feedback to move
	//  * @param newOwnerId the target parentId of the feedback
	//  * @param newIndex the target index of the feedback
	//  */
	// feedbackMoveTo(moveFeedbackId: string, newOwnerId: FeedbackOwner | null, newIndex: number): boolean {
	// 	const oldItem = this.#feedbacks.findParentAndIndex(moveFeedbackId)
	// 	if (!oldItem) return false

	// 	if (
	// 		oldItem.parent.ownerId?.parentFeedbackId === newOwnerId?.parentFeedbackId &&
	// 		oldItem.parent.ownerId?.childGroup === newOwnerId?.childGroup
	// 	) {
	// 		oldItem.parent.moveFeedback(oldItem.index, newIndex)
	// 	} else {
	// 		const newParent = newOwnerId ? this.#feedbacks.findById(newOwnerId.parentFeedbackId) : null
	// 		if (newOwnerId && !newParent) return false

	// 		// Ensure the new parent is not a child of the feedback being moved
	// 		if (newOwnerId && oldItem.item.findChildById(newOwnerId.parentFeedbackId)) return false

	// 		// Check if the new parent can hold the feedback being moved
	// 		if (newParent && !newParent.canAcceptChild(newOwnerId!.childGroup, oldItem.item)) return false

	// 		const poppedFeedback = oldItem.parent.popFeedback(oldItem.index)
	// 		if (!poppedFeedback) return false

	// 		if (newParent) {
	// 			newParent.pushChild(poppedFeedback, newOwnerId!.childGroup, newIndex)
	// 		} else {
	// 			this.#feedbacks.pushFeedback(poppedFeedback, newIndex)
	// 		}
	// 	}

	// 	this.#commitChange()

	// 	return true
	// }

	// /**
	//  * Replace a feedback with an updated version
	//  */
	// feedbackReplace(
	// 	newProps: Pick<FeedbackInstance, 'id' | 'type' | 'style' | 'options' | 'isInverted'>,
	// 	skipNotifyModule = false
	// ): boolean {
	// 	const feedback = this.#feedbacks.findById(newProps.id)
	// 	if (feedback) {
	// 		feedback.replaceProps(newProps, skipNotifyModule)

	// 		this.#commitChange(true)

	// 		return true
	// 	}

	// 	return false
	// }

	/**
	 * Update an option for an entity
	 * @param id the id of the entity
	 * @param key the key/name of the property
	 * @param value the new value
	 */
	entrySetOptions(listId: SomeSocketEntityLocation, id: string, key: string, value: any): boolean {
		const entityList = this.getEntityList(listId)
		if (!entityList) return false

		const entity = entityList.findById(id)
		if (!entity) return false

		entity.setOption(key, value)

		this.#commitChange()

		return true
	}

	/**
	 * Set a new connection instance for an entity
	 * @param id the id of the entity
	 * @param connectionId the id of the new connection
	 */
	entitySetConnection(listId: SomeSocketEntityLocation, id: string, connectionId: string | number): boolean {
		const entityList = this.getEntityList(listId)
		if (!entityList) return false

		const entity = entityList.findById(id)
		if (!entity) return false

		entity.setConnectionId(connectionId)

		this.#commitChange()

		return true
	}

	/**
	 * Set whether a boolean feedback should be inverted
	 * @param id the id of the entity
	 * @param isInverted the new value
	 */
	entitySetInverted(listId: SomeSocketEntityLocation, id: string, isInverted: boolean): boolean {
		const entityList = this.getEntityList(listId)
		if (!entityList) return false

		const entity = entityList.findById(id)
		if (!entity) return false

		entity.setInverted(!!isInverted)

		this.#commitChange()

		return true
	}

	// /**
	//  * Update the selected style properties for a boolean feedback
	//  * @param id the id of the feedback
	//  * @param selected the properties to be selected
	//  */
	// feedbackSetStyleSelection(id: string, selected: string[]): boolean {
	// 	if (this.#booleanOnly) throw new Error('FragmentFeedbacks not setup to use styles')

	// 	const feedback = this.#feedbacks.findById(id)
	// 	if (feedback && feedback.setStyleSelection(selected, this.baseStyle)) {
	// 		this.#commitChange()

	// 		return true
	// 	}

	// 	return false
	// }

	// /**
	//  * Update an style property for a boolean feedback
	//  * @param id the id of the feedback
	//  * @param key the key/name of the property
	//  * @param value the new value
	//  */
	// feedbackSetStyleValue(id: string, key: string, value: any): boolean {
	// 	if (this.#booleanOnly) throw new Error('FragmentFeedbacks not setup to use styles')

	// 	const feedback = this.#feedbacks.findById(id)
	// 	if (feedback && feedback.setStyleValue(key, value)) {
	// 		this.#commitChange()

	// 		return true
	// 	}

	// 	return false
	// }
}

export class ControlEntityListPoolButton extends ControlEntityListPoolBase {
	// TODO
	#feedbacks: ControlEntityList

	constructor(props: ControlEntityListPoolProps) {
		super(props)

		this.#feedbacks = new ControlEntityList(
			props.instanceDefinitions,
			props.internalModule,
			props.moduleHost,
			props.controlId,
			null,
			{
				type: EntityModelType.Feedback,
				groupId: 'feedbacks',
				label: 'Feedbacks',
			}
		)
		// TODO
	}

	protected getEntityList(listId: SomeSocketEntityLocation): ControlEntityList | undefined {
		// TODO - expand
		if (listId === 'feedbacks') return this.#feedbacks
		return undefined
	}

	protected getAllEntityLists(): ControlEntityList[] {
		// TODO - expand
		return [this.#feedbacks]
	}
}

export class ControlEntityListPoolTrigger extends ControlEntityListPoolBase {
	// TODO
	#feedbacks: ControlEntityList

	constructor(props: ControlEntityListPoolProps) {
		super(props)

		this.#feedbacks = new ControlEntityList(
			props.instanceDefinitions,
			props.internalModule,
			props.moduleHost,
			props.controlId,
			null,
			{
				type: EntityModelType.Feedback,
				groupId: 'feedbacks',
				label: 'Feedbacks',
				booleanFeedbacksOnly: true,
			}
		)
		// TODO
	}

	/**
	 * Get the value from all feedbacks as a single boolean
	 */
	checkConditionValue(): boolean {
		return this.#feedbacks.getBooleanFeedbackValue()
	}

	protected getEntityList(listId: SomeSocketEntityLocation): ControlEntityList | undefined {
		// TODO - expand
		if (listId === 'feedbacks') return this.#feedbacks
		return undefined
	}

	protected getAllEntityLists(): ControlEntityList[] {
		// TODO - expand
		return [this.#feedbacks]
	}
}

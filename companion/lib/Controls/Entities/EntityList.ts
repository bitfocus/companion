import {
	EntityModelType,
	EntityOwner,
	EntitySupportedChildGroupDefinition,
	FeedbackEntitySubType,
	SomeEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import { ControlEntityInstance } from './EntityInstance.js'
import type { FeedbackStyleBuilder } from './FeedbackStyleBuilder.js'
import { clamp } from '../../Resources/Util.js'
import type { InstanceDefinitionsForEntity, InternalControllerForEntity, ModuleHostForEntity } from './Types.js'
import { canAddEntityToFeedbackList } from '@companion-app/shared/Entity.js'

export type ControlEntityListDefinition = Pick<
	EntitySupportedChildGroupDefinition,
	'type' | 'feedbackListType' | 'maximumChildren'
>

export class ControlEntityList {
	readonly #instanceDefinitions: InstanceDefinitionsForEntity
	readonly #internalModule: InternalControllerForEntity
	readonly #moduleHost: ModuleHostForEntity

	/**
	 * Id of the control this belongs to
	 */
	readonly #controlId: string

	readonly #ownerId: EntityOwner | null

	readonly #listDefinition: ControlEntityListDefinition

	#entities: ControlEntityInstance[] = []

	get ownerId(): EntityOwner | null {
		return this.#ownerId
	}

	get listDefinition(): ControlEntityListDefinition {
		return this.#listDefinition
	}

	constructor(
		instanceDefinitions: InstanceDefinitionsForEntity,
		internalModule: InternalControllerForEntity,
		moduleHost: ModuleHostForEntity,
		controlId: string,
		ownerId: EntityOwner | null,
		listDefinition: ControlEntityListDefinition
	) {
		this.#instanceDefinitions = instanceDefinitions
		this.#internalModule = internalModule
		this.#moduleHost = moduleHost
		this.#controlId = controlId
		this.#ownerId = ownerId
		this.#listDefinition = listDefinition
	}

	/**
	 * Recursively get all the entities
	 */
	getAllEntities(): ControlEntityInstance[] {
		return this.#entities.flatMap((e) => [e, ...e.getAllChildren()])
	}

	/**
	 * Get the entities directly contained in this list
	 */
	getDirectEntities(): ControlEntityInstance[] {
		return this.#entities
	}

	/**
	 * Initialise from storage
	 * @param entities
	 * @param skipSubscribe Whether to skip calling subscribe for the new entities
	 * @param isCloned Whether this is a cloned instance
	 */
	loadStorage(entities: SomeEntityModel[], skipSubscribe: boolean, isCloned: boolean): void {
		// Inform modules of entity cleanup
		for (const entity of this.#entities) {
			entity.cleanup()
		}
		// TODO - validate that the entities are of the correct type

		// Ensure that this won't exceed the maximum number of children
		const entitiesToLoad =
			this.#listDefinition.maximumChildren !== undefined
				? entities?.slice(0, this.#listDefinition.maximumChildren ?? undefined)
				: entities

		this.#entities =
			entitiesToLoad?.map?.(
				(entity) =>
					new ControlEntityInstance(
						this.#instanceDefinitions,
						this.#internalModule,
						this.#moduleHost,
						this.#controlId,
						entity,
						!!isCloned
					)
			) || []

		if (!skipSubscribe) {
			this.subscribe(true)
		}
	}

	/**
	 * Inform the instance of any removed/disabled entities
	 * @access public
	 */
	cleanup(): void {
		for (const entity of this.#entities) {
			entity.cleanup()
		}
	}

	/**
	 * Inform the instance of an updated entity
	 * @param recursive whether to call recursively
	 * @param onlyType If set, only re-subscribe entities of this type
	 * @param onlyConnectionId If set, only re-subscribe entities for this connection
	 */
	subscribe(recursive: boolean, onlyType?: EntityModelType, onlyConnectionId?: string): void {
		for (const entity of this.#entities) {
			entity.subscribe(recursive, onlyType, onlyConnectionId)
		}
	}

	/**
	 * Find a child entity by id
	 */
	findById(id: string): ControlEntityInstance | undefined {
		for (const entity of this.#entities) {
			if (entity.id === id) return entity

			const found = entity.findChildById(id)
			if (found) return found
		}

		return undefined
	}

	/**
	 * Find the index of a child entity, and the parent list
	 */
	findParentAndIndex(
		id: string
	): { parent: ControlEntityList; index: number; item: ControlEntityInstance } | undefined {
		const index = this.#entities.findIndex((fb) => fb.id === id)
		if (index !== -1) {
			return { parent: this, index, item: this.#entities[index] }
		}

		for (const entity of this.#entities) {
			const found = entity.findParentAndIndex(id)
			if (found) return found
		}

		return undefined
	}

	/**
	 * Add a child entity to this entity
	 * @param entityModel
	 * @param isCloned Whether this is a cloned instance
	 */
	addEntity(entityModel: SomeEntityModel, isCloned?: boolean): ControlEntityInstance {
		const newEntity = new ControlEntityInstance(
			this.#instanceDefinitions,
			this.#internalModule,
			this.#moduleHost,
			this.#controlId,
			entityModel,
			!!isCloned
		)

		// TODO - should this log and return instead of throw?
		if (!this.canAcceptEntity(newEntity)) throw new Error('EntityList cannot accept this type of entity')

		this.#entities.push(newEntity)

		return newEntity
	}

	/**
	 * Remove a child entity
	 */
	removeEntity(id: string): ControlEntityInstance | undefined {
		const index = this.#entities.findIndex((entity) => entity.id === id)
		if (index !== -1) {
			const entity = this.#entities[index]
			this.#entities.splice(index, 1)

			entity.cleanup()

			return entity
		}

		for (const entity of this.#entities) {
			const removed = entity.removeChild(id)
			if (removed) return removed
		}

		return undefined
	}

	/**
	 * Reorder an entity directly in in the list
	 */
	moveEntity(oldIndex: number, newIndex: number): void {
		oldIndex = clamp(oldIndex, 0, this.#entities.length)
		newIndex = clamp(newIndex, 0, this.#entities.length)
		if (oldIndex < newIndex) newIndex -= 1

		this.#entities.splice(newIndex, 0, ...this.#entities.splice(oldIndex, 1))
	}

	/**
	 * Pop an entity from the list
	 * Note: this is used when moving an entity to a different parent. Lifecycle is not managed
	 */
	popEntity(index: number): ControlEntityInstance | undefined {
		const entity = this.#entities[index]
		if (!entity) return undefined

		this.#entities.splice(index, 1)

		return entity
	}

	/**
	 * Push an entity to the list
	 * Note: this is used when moving an entity from a different parent. Lifecycle is not managed
	 */
	pushEntity(entity: ControlEntityInstance, index: number): void {
		if (!this.canAcceptEntity(entity)) throw new Error('EntityList cannot accept this type of entity')

		index = clamp(index, 0, this.#entities.length)

		this.#entities.splice(index, 0, entity)
	}

	/**
	 * Check if this list can accept a specified entity
	 */
	canAcceptEntity(entity: ControlEntityInstance): boolean {
		if (this.#listDefinition.type !== entity.type) return false

		// Make sure this won't exceed the maximum number of children
		if (
			this.#listDefinition.maximumChildren !== undefined &&
			this.#entities.length >= this.#listDefinition.maximumChildren
		)
			return false

		// If a feedback list, check that the feedback is of the correct type
		if (this.#listDefinition.type === EntityModelType.Feedback) {
			const feedbackDefinition = entity.getEntityDefinition()
			if (
				!feedbackDefinition ||
				!canAddEntityToFeedbackList(this.#listDefinition.feedbackListType ?? null, feedbackDefinition)
			)
				return false
		}

		return true
	}

	/**
	 * Duplicate an entity
	 */
	duplicateEntity(id: string): ControlEntityInstance | undefined {
		// Make sure this won't exceed the maximum number of children
		if (
			this.#listDefinition.maximumChildren !== undefined &&
			this.#entities.length >= this.#listDefinition.maximumChildren
		)
			return undefined

		const entityIndex = this.#entities.findIndex((entity) => entity.id === id)
		if (entityIndex !== -1) {
			const entityModel = this.#entities[entityIndex].asEntityModel(true)
			const newEntity = new ControlEntityInstance(
				this.#instanceDefinitions,
				this.#internalModule,
				this.#moduleHost,
				this.#controlId,
				entityModel,
				true
			)

			this.#entities.splice(entityIndex + 1, 0, newEntity)

			newEntity.subscribe(true)

			return newEntity
		}

		for (const entity of this.#entities) {
			const newAction = entity.duplicateChild(id)
			if (newAction) return newAction
		}

		return undefined
	}

	/**
	 * Cleanup and forget any children belonging to the given connection
	 */
	forgetForConnection(connectionId: string): boolean {
		let changed = false

		this.#entities = this.#entities.filter((entity) => {
			if (entity.connectionId === connectionId) {
				changed = true

				entity.cleanup()

				return false
			} else {
				changed = entity.forgetChildrenForConnection(connectionId) || changed
				return true
			}
		})

		return changed
	}

	/**
	 * Prune all entities referencing unknown conncetions
	 * Doesn't do any cleanup, as it is assumed that the connection has not been running
	 */
	verifyConnectionIds(knownConnectionIds: Set<string>): boolean {
		// Clean out actions
		const entitiesLength = this.#entities.length
		this.#entities = this.#entities.filter((entity) => !!entity && knownConnectionIds.has(entity.connectionId))
		let changed = this.#entities.length !== entitiesLength

		for (const entity of this.#entities) {
			if (entity.verifyChildConnectionIds(knownConnectionIds)) {
				changed = true
			}
		}

		return changed
	}

	clearCachedValueForConnectionId(connectionId: string): boolean {
		let changed = false
		for (const entity of this.#entities) {
			if (entity.clearCachedValueForConnectionId(connectionId)) changed = true
		}

		return changed
	}

	/**
	 * Get the value of this feedback as a boolean
	 */
	getBooleanFeedbackValue(): boolean {
		if (
			this.#listDefinition.type !== EntityModelType.Feedback ||
			this.#listDefinition.feedbackListType !== FeedbackEntitySubType.Boolean
		)
			throw new Error('ControlEntityList is not boolean feedbacks')

		let result = true

		for (const entity of this.#entities) {
			if (entity.disabled) continue

			result = result && entity.getBooleanFeedbackValue()
		}

		return result
	}

	getChildBooleanFeedbackValues(): boolean[] {
		if (
			this.#listDefinition.type !== EntityModelType.Feedback ||
			this.#listDefinition.feedbackListType !== FeedbackEntitySubType.Boolean
		)
			throw new Error('ControlEntityList is not boolean feedbacks')

		const values: boolean[] = []

		for (const entity of this.#entities) {
			if (entity.disabled) continue

			values.push(entity.getBooleanFeedbackValue())
		}

		return values
	}

	/**
	 * Get the unparsed style for the feedbacks
	 * Note: Does not clone the style
	 */
	buildFeedbackStyle(styleBuilder: FeedbackStyleBuilder): void {
		if (this.#listDefinition.type !== EntityModelType.Feedback || !!this.#listDefinition.feedbackListType)
			throw new Error('ControlEntityList is not style feedbacks')

		// Note: We don't need to consider children of the feedbacks here, as that can only be from boolean feedbacks which are handled by the `getBooleanValue`

		for (const entity of this.#entities) {
			entity.buildFeedbackStyle(styleBuilder)
		}
	}

	/**
	 * Update the feedbacks on the button with new values
	 * @param connectionId The instance the feedbacks are for
	 * @param newValues The new feedback values
	 */
	updateFeedbackValues(connectionId: string, newValues: Record<string, any>): ControlEntityInstance[] {
		const changed: ControlEntityInstance[] = []

		for (const entity of this.#entities) {
			changed.push(...entity.updateFeedbackValues(connectionId, newValues))
		}

		return changed
	}

	/**
	 * Get all the connection ids that are enabled
	 */
	getAllEnabledConnectionIds(connectionIds: Set<string>): void {
		for (const entity of this.#entities) {
			entity.getAllEnabledConnectionIds(connectionIds)
		}
	}
}

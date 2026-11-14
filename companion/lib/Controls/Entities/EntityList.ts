import type { SomeControlId } from '@companion-app/shared/ControlId.js'
import { canAddEntityToFeedbackList } from '@companion-app/shared/Entity.js'
import {
	EntityModelType,
	FeedbackEntitySubType,
	type EntityOwner,
	type EntitySupportedChildGroupDefinition,
	type SomeEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import { clamp } from '../../Resources/Util.js'
import { ControlEntityInstance } from './EntityInstance.js'
import type { NewSpecialExpressionValue } from './SpecialExpressions.js'
import type {
	EntityScope,
	FeedbackExecutionContext,
	InstanceDefinitionsForEntity,
	InternalControllerForEntity,
	NewEntityIds,
	NewFeedbackValue,
	ProcessManagerForEntity,
} from './Types.js'

export type ControlEntityListDefinition = Pick<
	EntitySupportedChildGroupDefinition,
	'type' | 'feedbackListType' | 'maximumChildren'
>

export class ControlEntityList {
	readonly #instanceDefinitions: InstanceDefinitionsForEntity
	readonly #internalModule: InternalControllerForEntity
	readonly #processManager: ProcessManagerForEntity
	readonly #scope: EntityScope

	/**
	 * Id of the control this belongs to
	 */
	readonly #controlId: SomeControlId

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
		processManager: ProcessManagerForEntity,
		scope: EntityScope,
		controlId: SomeControlId,
		ownerId: EntityOwner | null,
		listDefinition: ControlEntityListDefinition
	) {
		this.#instanceDefinitions = instanceDefinitions
		this.#internalModule = internalModule
		this.#processManager = processManager
		this.#scope = scope
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
	 * Recursively get all the entities, including those in transient child groups
	 */
	getAllEntitiesWithTransient(): ControlEntityInstance[] {
		return this.#entities.flatMap((e) => [e, ...e.getAllChildrenWithTransient()])
	}

	/**
	 * Get the entities directly contained in this list
	 */
	getDirectEntities(): ControlEntityInstance[] {
		return this.#entities
	}

	/**
	 * Initialise from storage, replacing (and cleaning up) any existing entities.
	 * The new entities are not subscribed, the caller must call subscribe() when ready
	 * @param entities
	 * @param newIds How the entities get their ids
	 */
	loadStorage(entities: SomeEntityModel[], newIds: NewEntityIds): void {
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
						this.#processManager,
						this.#scope,
						this.#controlId,
						entity,
						newIds
					)
			) || []
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
	 * Inform the instance of updated entities, and the entities inside them. The counterpart of cleanup
	 * @param onlyType If set, only re-subscribe entities of this type
	 * @param onlyConnectionId If set, only re-subscribe entities for this connection
	 */
	subscribe(onlyType?: EntityModelType, onlyConnectionId?: string): void {
		for (const entity of this.#entities) {
			entity.subscribe(onlyType, onlyConnectionId)
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
			this.#processManager,
			this.#scope,
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
	 * Reorder an entity directly in in the list, where newIndex is its desired final index.
	 */
	moveEntity(oldIndex: number, newIndex: number): ControlEntityInstance | undefined {
		oldIndex = clamp(oldIndex, 0, this.#entities.length)
		newIndex = clamp(newIndex, 0, this.#entities.length)
		if (oldIndex === newIndex) return undefined

		this.#entities.splice(newIndex, 0, ...this.#entities.splice(oldIndex, 1))

		return this.#entities[newIndex]
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
		const entityIndex = this.#entities.findIndex((entity) => entity.id === id)
		if (entityIndex !== -1) {
			// Make sure this won't exceed the maximum number of children
			if (
				this.#listDefinition.maximumChildren !== undefined &&
				this.#entities.length >= this.#listDefinition.maximumChildren
			)
				return undefined

			const entityModel = this.#entities[entityIndex].asEntityModel(true)
			const newEntity = new ControlEntityInstance(
				this.#instanceDefinitions,
				this.#internalModule,
				this.#processManager,
				this.#scope,
				this.#controlId,
				entityModel,
				true
			)

			this.#entities.splice(entityIndex + 1, 0, newEntity)

			newEntity.subscribe()

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
	 * Prune all entities referencing unknown connections
	 * Doesn't do any cleanup, as it is assumed that the connection has not been running
	 */
	verifyConnectionIds(knownConnectionIds: ReadonlySet<string>): boolean {
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

	/**
	 * Clear cached values for any feedback belonging to the given connection
	 * @returns The top-level entities whose value (or that of a child) was cleared
	 */
	clearCachedValueForConnectionId(connectionId: string): ControlEntityInstance[] {
		return this.#entities.filter((entity) => entity.clearCachedValueForConnectionId(connectionId))
	}

	/**
	 * Get the combined value of this feedback list as a single boolean (logical AND of all children).
	 * @param context Lazy-evaluation context, or `null` to use cached values. See
	 * {@link ControlEntityInstance.getBooleanFeedbackValue}.
	 */
	getBooleanFeedbackValue(context: FeedbackExecutionContext | null): boolean {
		if (
			this.#listDefinition.type !== EntityModelType.Feedback ||
			this.#listDefinition.feedbackListType !== FeedbackEntitySubType.Boolean
		)
			throw new Error('ControlEntityList is not boolean feedbacks')

		let result = true

		for (const entity of this.#entities) {
			if (entity.disabled) continue

			result = result && entity.getBooleanFeedbackValue(context)
		}

		return result
	}

	/**
	 * Get the individual boolean values of each enabled child feedback (used by logic operators).
	 * @param context Lazy-evaluation context, or `null` to use cached values.
	 */
	getChildBooleanFeedbackValues(context: FeedbackExecutionContext | null): boolean[] {
		if (
			this.#listDefinition.type !== EntityModelType.Feedback ||
			this.#listDefinition.feedbackListType !== FeedbackEntitySubType.Boolean
		)
			throw new Error('ControlEntityList is not boolean feedbacks')

		const values: boolean[] = []

		for (const entity of this.#entities) {
			if (entity.disabled) continue

			values.push(entity.getBooleanFeedbackValue(context))
		}

		return values
	}

	/**
	 * Update the feedbacks on the button with new values
	 * @param connectionId The instance the feedbacks are for
	 * @param newValues The new feedback values
	 */
	updateFeedbackValues(
		connectionId: string,
		newValues: ReadonlyMap<string, NewFeedbackValue>
	): ControlEntityInstance[] {
		const changed = this.#entities.flatMap((entity) => entity.updateFeedbackValues(connectionId, newValues))
		this.#reportLocalVariablesChanged(changed)
		return changed
	}

	/**
	 * Update the isInverted values on the control with new calculated isInverted values
	 * @param newValues The new isInverted values
	 */
	updateIsInvertedValues(
		newValues: ReadonlyMap<string, NewSpecialExpressionValue<'isInverted'>>
	): ControlEntityInstance[] {
		const changed = this.#entities.flatMap((entity) => entity.updateIsInvertedValues(newValues))
		this.#reportLocalVariablesChanged(changed)
		return changed
	}

	/**
	 * Tell the scope which of the local variables in this list have changed value, as for a copy nothing else will
	 * @param changed The entities which changed, in this list or inside its entities
	 */
	#reportLocalVariablesChanged(changed: ControlEntityInstance[]): void {
		const names = new Set<string>()
		for (const entity of changed) {
			if (entity.localVariableName && this.#entities.includes(entity)) names.add(entity.localVariableName)
		}
		if (names.size > 0) this.#scope.localVariablesChanged(names)
	}

	/**
	 * Update the storeResult values on the control with new calculated
	 * storeResult values
	 * @param newValues The new storeResult values
	 */
	updateStoreResultValues(
		newValues: ReadonlyMap<string, NewSpecialExpressionValue<'storeResult'>>
	): ControlEntityInstance[] {
		return this.#entities.flatMap((entity) => entity.updateStoreResultValues(newValues))
	}

	/**
	 * The entities which are enabled, and those inside them which are. A disabled entity, and everything inside it, is
	 * left out
	 * @param includeTransient Whether to include the entities of transient child groups
	 */
	getAllEnabledEntities(includeTransient: boolean): ControlEntityInstance[] {
		return this.#entities.flatMap((entity) => entity.getAllEnabledEntities(includeTransient))
	}
}

import type { InstanceDefinitions } from '../../Instance/Definitions.js'
import type { InternalController } from '../../Internal/Controller.js'
import type { ModuleHost } from '../../Instance/Host.js'
import {
	EntityModelType,
	EntityOwner,
	EntitySupportedChildGroupDefinition,
	SomeEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import { ControlEntityInstance } from './EntityInstance.js'
import type { FeedbackStyleBuilder } from './FeedbackStyleBuilder.js'

export class ControlEntityList {
	readonly #instanceDefinitions: InstanceDefinitions
	readonly #internalModule: InternalController
	readonly #moduleHost: ModuleHost

	/**
	 * Id of the control this belongs to
	 */
	readonly #controlId: string

	readonly #ownerId: EntityOwner | null

	readonly #listDefinition: EntitySupportedChildGroupDefinition

	#entities: ControlEntityInstance[] = []

	get ownerId(): EntityOwner | null {
		return this.#ownerId
	}

	constructor(
		instanceDefinitions: InstanceDefinitions,
		internalModule: InternalController,
		moduleHost: ModuleHost,
		controlId: string,
		ownerId: EntityOwner | null,
		listDefinition: EntitySupportedChildGroupDefinition
	) {
		this.#instanceDefinitions = instanceDefinitions
		this.#internalModule = internalModule
		this.#moduleHost = moduleHost
		this.#controlId = controlId
		this.#ownerId = ownerId
		this.#listDefinition = listDefinition // TODO - use this elsewhere
	}

	/**
	 * Recursively get all the entities
	 */
	getAllEntities(): ControlEntityInstance[] {
		return [...this.#entities, ...this.#entities.flatMap((entity) => entity.getAllChildren())]
	}

	/**
	 * Get the entities directly contained in this list
	 */
	getDirectEntities(): ControlEntityInstance[] {
		return this.#entities
	}

	// /**
	//  * Get the contained actions as `ActionInstance`s
	//  */
	// asActionInstances(): ActionInstance[] {
	// 	return this.#actions.map((action) => action.asActionInstance())
	// }

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

		this.#entities =
			entities?.map(
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
	 * Inform the instance of any removed entities
	 * @access public
	 */
	cleanup() {
		for (const entity of this.#entities) {
			entity.cleanup()
		}
		this.#entities = []
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

	// /**
	//  * Add a child action to this action
	//  * @param action
	//  * @param isCloned Whether this is a cloned instance
	//  */
	// addAction(action: ActionInstance, isCloned?: boolean): FragmentActionInstance {
	// 	const newAction = new FragmentActionInstance(
	// 		this.#instanceDefinitions,
	// 		this.#internalModule,
	// 		this.#moduleHost,
	// 		this.#controlId,
	// 		action,
	// 		!!isCloned
	// 	)

	// 	this.#actions.push(newAction)

	// 	return newAction
	// }

	/**
	 * Remove a child entity
	 */
	removeEntity(id: string): boolean {
		const index = this.#entities.findIndex((entity) => entity.id === id)
		if (index !== -1) {
			const entity = this.#entities[index]
			this.#entities.splice(index, 1)

			entity.cleanup()

			return true
		}

		for (const entity of this.#entities) {
			if (entity.removeChild(id)) return true
		}

		return false
	}

	// /**
	//  * Reorder a action in the list
	//  */
	// moveAction(oldIndex: number, newIndex: number): void {
	// 	oldIndex = clamp(oldIndex, 0, this.#actions.length)
	// 	newIndex = clamp(newIndex, 0, this.#actions.length)
	// 	this.#actions.splice(newIndex, 0, ...this.#actions.splice(oldIndex, 1))
	// }

	// /**
	//  * Pop a child action from the list
	//  * Note: this is used when moving a action to a different parent. Lifecycle is not managed
	//  */
	// popAction(index: number): FragmentActionInstance | undefined {
	// 	const action = this.#actions[index]
	// 	if (!action) return undefined

	// 	this.#actions.splice(index, 1)

	// 	return action
	// }

	// /**
	//  * Push a child action to the list
	//  * Note: this is used when moving a action from a different parent. Lifecycle is not managed
	//  */
	// pushAction(action: FragmentActionInstance, index: number): void {
	// 	index = clamp(index, 0, this.#actions.length)

	// 	this.#actions.splice(index, 0, action)
	// }

	// /**
	//  * Check if this list can accept a specified child
	//  */
	// canAcceptAction(action: FragmentActionInstance): boolean {
	// 	const definition = action.getDefinition()
	// 	if (!definition) return false

	// 	return true
	// }

	/**
	 * Duplicate an entity
	 */
	duplicateEntity(id: string): ControlEntityInstance | undefined {
		const entityIndex = this.#entities.findIndex((entity) => entity.id === id)
		if (entityIndex !== -1) {
			const entityModel = this.#entities[entityIndex].asEntityModel()
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
				entity.cleanup()

				return false
			} else {
				changed = entity.forgetChildrenForConnection(connectionId)
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

	/**
	 * If this control was imported to a running system, do some data cleanup/validation
	 */
	postProcessImport(): Promise<void>[] {
		return this.#entities.flatMap((entity) => entity.postProcessImport())
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
		if (this.#listDefinition.type !== EntityModelType.Feedback || !this.#listDefinition.booleanFeedbacksOnly)
			throw new Error('ControlEntityList is not boolean feedbacks')

		let result = true

		for (const entity of this.#entities) {
			if (entity.disabled) continue

			result = result && entity.getBooleanFeedbackValue()
		}

		return result
	}

	/**
	 * Get the unparsed style for the feedbacks
	 * Note: Does not clone the style
	 */
	buildFeedbackStyle(styleBuilder: FeedbackStyleBuilder): void {
		if (this.#listDefinition.type !== EntityModelType.Feedback || this.#listDefinition.booleanFeedbacksOnly)
			throw new Error('ControlEntityList is not style feedbacks')

		// Note: We don't need to consider children of the feedbacks here, as that can only be from boolean feedbacks which are handled by the `getBooleanValue`

		for (const entity of this.#entities) {
			entity.buildFeedbackStyle(styleBuilder)
		}
	}
}

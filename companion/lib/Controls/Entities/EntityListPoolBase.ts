import LogController, { Logger } from '../../Log/Controller.js'
import {
	EntityModelType,
	EntityOwner,
	FeedbackEntitySubType,
	SomeEntityModel,
	SomeReplaceableEntityModel,
	type SomeSocketEntityLocation,
} from '@companion-app/shared/Model/EntityModel.js'
import { isInternalUserValueFeedback, type ControlEntityInstance } from './EntityInstance.js'
import { ControlEntityList, ControlEntityListDefinition } from './EntityList.js'
import type { ModuleHost } from '../../Instance/Host.js'
import type { InternalController } from '../../Internal/Controller.js'
import { isEqual } from 'lodash-es'
import type { InstanceDefinitionsForEntity } from './Types.js'
import type { ButtonStyleProperties } from '@companion-app/shared/Model/StyleModel.js'
import type { CompanionVariableValues } from '@companion-module/base'

export interface ControlEntityListPoolProps {
	instanceDefinitions: InstanceDefinitionsForEntity
	internalModule: InternalController
	moduleHost: ModuleHost
	controlId: string
	commitChange: (redraw?: boolean) => void
	invalidateControl: () => void
	localVariablesChanged: ((changedVariables: Set<string>) => void) | null
}

export abstract class ControlEntityListPoolBase {
	/**
	 * The logger
	 */
	protected readonly logger: Logger

	readonly #instanceDefinitions: InstanceDefinitionsForEntity
	readonly #internalModule: InternalController
	readonly #moduleHost: ModuleHost

	protected readonly controlId: string

	/**
	 * Commit changes to the database and disk
	 */
	protected readonly commitChange: (redraw?: boolean) => void

	/**
	 * Trigger a redraw/invalidation of the control
	 */
	protected readonly invalidateControl: () => void

	/**
	 * Triggered when local variables have changed
	 */
	readonly localVariablesChanged: ((changedVariables: Set<string>) => void) | null

	protected constructor(props: ControlEntityListPoolProps) {
		this.logger = LogController.createLogger(`Controls/Fragments/EnittyPool/${props.controlId}`)

		this.controlId = props.controlId
		this.commitChange = props.commitChange
		this.invalidateControl = props.invalidateControl
		this.localVariablesChanged = props.localVariablesChanged

		this.#instanceDefinitions = props.instanceDefinitions
		this.#internalModule = props.internalModule
		this.#moduleHost = props.moduleHost
	}

	protected createEntityList(listDefinition: ControlEntityListDefinition): ControlEntityList {
		return new ControlEntityList(
			this.#instanceDefinitions,
			this.#internalModule,
			this.#moduleHost,
			this.controlId,
			null,
			listDefinition
		)
	}

	protected tryTriggerLocalVariablesChanged(...entitiesOrNames: (ControlEntityInstance | string | null)[]): void {
		if (!this.localVariablesChanged) return

		if (entitiesOrNames.length === 0) return

		const changedVariables = new Set<string>()
		for (const entityOrName of entitiesOrNames) {
			if (!entityOrName) continue

			const variableName = typeof entityOrName === 'string' ? entityOrName : entityOrName.localVariableName
			if (variableName) changedVariables.add(variableName)
		}

		if (changedVariables.size > 0) {
			this.localVariablesChanged(changedVariables)
		}
	}

	/**
	 * Remove any tracked state for a connection
	 */
	clearConnectionState(connectionId: string): void {
		let changed = false
		for (const list of this.getAllEntityLists()) {
			if (list.clearCachedValueForConnectionId(connectionId)) changed = true
		}
		if (changed) this.invalidateControl()
	}

	/**
	 * Prepare this control for deletion
	 * @access public
	 */
	destroy(): void {
		for (const list of this.getAllEntityLists()) {
			list.cleanup()
		}
	}

	protected abstract getEntityList(listId: SomeSocketEntityLocation): ControlEntityList | undefined
	protected abstract getAllEntityLists(): ControlEntityList[]

	abstract getLocalVariableEntities(): ControlEntityInstance[]

	getLocalVariableValues(): CompanionVariableValues {
		const entities = this.getLocalVariableEntities()

		const values: CompanionVariableValues = {}

		for (const entity of entities) {
			const variableName = entity.localVariableName
			if (variableName) {
				const definition = entity.getEntityDefinition()
				// Strip off the prefix, as the ui doesn't expect that
				values[variableName.slice('local:'.length)] =
					definition?.feedbackType === FeedbackEntitySubType.Boolean
						? entity.getBooleanFeedbackValue()
						: entity.feedbackValue
			}
		}

		return values
	}

	/**
	 * Find an entity by its id
	 * This will search all entity lists and through all child
	 * @param id the id of the entity to find
	 * @returns The entity instance if found, or undefined
	 */
	findEntityById(id: string): ControlEntityInstance | undefined {
		for (const list of this.getAllEntityLists()) {
			const entity = list.findById(id)
			if (entity) return entity
		}
		return undefined
	}

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

	/**
	 * Add an entity to this control
	 * @param entityModel the item to add
	 * @param ownerId the ids of parent entity that this entity should be added as a child of
	 */
	entityAdd(
		listId: SomeSocketEntityLocation,
		ownerId: EntityOwner | null,
		...entityModels: SomeEntityModel[]
	): boolean {
		if (entityModels.length === 0) return false

		const entityList = this.getEntityList(listId)
		if (!entityList) return false

		let newEntities: ControlEntityInstance[]
		if (ownerId) {
			const parent = entityList.findById(ownerId.parentId)
			if (!parent) throw new Error(`Failed to find parent entity ${ownerId.parentId} when adding child entity`)

			newEntities = entityModels.map((entity) => parent.addChild(ownerId.childGroup, entity))
		} else {
			newEntities = entityModels.map((entity) => entityList.addEntity(entity))
		}

		// Inform relevant module
		for (const entity of newEntities) {
			entity.subscribe(true)
		}

		this.tryTriggerLocalVariablesChanged(...newEntities)

		this.commitChange()

		return true
	}

	/**
	 * Duplicate an feedback on this control
	 */
	entityDuplicate(listId: SomeSocketEntityLocation, id: string): boolean {
		const entityList = this.getEntityList(listId)
		if (!entityList) return false

		const entity = entityList.duplicateEntity(id)
		if (!entity) return false

		this.tryTriggerLocalVariablesChanged(entity)

		this.commitChange(false)

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

		this.tryTriggerLocalVariablesChanged(entity)

		this.commitChange()

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

		this.commitChange()

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
		const entityAfter = entityList.findById(id)
		if (!entityAfter) return false

		this.tryTriggerLocalVariablesChanged(entityAfter)

		this.commitChange(true)
		return true
	}

	/**
	 * Remove an entity from this control
	 */
	entityRemove(listId: SomeSocketEntityLocation, id: string): boolean {
		const entityList = this.getEntityList(listId)
		if (!entityList) return false

		const removedEntity = entityList.removeEntity(id)
		if (removedEntity) {
			this.commitChange()

			this.tryTriggerLocalVariablesChanged(removedEntity.localVariableName)

			return true
		} else {
			return false
		}
	}

	/**
	 * Move an entity within the hierarchy
	 * @param moveListId the id of the list to move the entity from
	 * @param moveEntityId the id of the entity to move
	 * @param newOwnerId the target new owner of the entity
	 * @param newListId the id of the list to move the entity to
	 * @param newIndex the target index of the entity
	 */
	entityMoveTo(
		moveListId: SomeSocketEntityLocation,
		moveEntityId: string,
		newOwnerId: EntityOwner | null,
		newListId: SomeSocketEntityLocation,
		newIndex: number
	): boolean {
		if (newOwnerId && moveEntityId === newOwnerId.parentId) return false

		const oldInfo = this.getEntityList(moveListId)?.findParentAndIndex(moveEntityId)
		if (!oldInfo) return false

		if (
			isEqual(moveListId, newListId) &&
			oldInfo.parent.ownerId?.parentId === newOwnerId?.parentId &&
			oldInfo.parent.ownerId?.childGroup === newOwnerId?.childGroup
		) {
			oldInfo.parent.moveEntity(oldInfo.index, newIndex)
		} else {
			const newEntityList = this.getEntityList(newListId)
			if (!newEntityList) return false

			const newParent = newOwnerId ? newEntityList.findById(newOwnerId.parentId) : null
			if (newOwnerId && !newParent) return false

			// Ensure the new parent is not a child of the entity being moved
			if (newOwnerId && oldInfo.item.findChildById(newOwnerId.parentId)) return false

			// Check if the new parent can hold the feedback being moved
			if (newParent && !newParent.canAcceptChild(newOwnerId!.childGroup, oldInfo.item)) return false

			const poppedFeedback = oldInfo.parent.popEntity(oldInfo.index)
			if (!poppedFeedback) return false

			if (newParent) {
				newParent.pushChild(poppedFeedback, newOwnerId!.childGroup, newIndex)
			} else {
				newEntityList.pushEntity(poppedFeedback, newIndex)
			}
		}

		this.commitChange()

		return true
	}

	/**
	 * Replace a feedback with an updated version
	 */
	entityReplace(newProps: SomeReplaceableEntityModel, skipNotifyModule = false): ControlEntityInstance | undefined {
		for (const entityList of this.getAllEntityLists()) {
			const entity = entityList.findById(newProps.id)
			if (!entity) continue

			// Ignore if the types do not match
			if (entity.type !== newProps.type) return undefined

			entity.replaceProps(newProps, skipNotifyModule)

			this.tryTriggerLocalVariablesChanged(entity)

			this.commitChange(true)

			return entity
		}

		return undefined
	}

	/**
	 * Replace all the entities in a list
	 * @param listId the list to update
	 * @param newEntities entities to populate
	 */
	entityReplaceAll(listId: SomeSocketEntityLocation, entities: SomeEntityModel[]): boolean {
		const entityList = this.getEntityList(listId)
		if (!entityList) return false

		entityList.loadStorage(entities, false, false)

		this.commitChange(true)

		return true
	}

	/**
	 * Update an option for an entity
	 * @param id the id of the entity
	 * @param key the key/name of the property
	 * @param value the new value
	 */
	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	entrySetOptions(listId: SomeSocketEntityLocation, id: string, key: string, value: any): boolean {
		const entityList = this.getEntityList(listId)
		if (!entityList) return false

		const entity = entityList.findById(id)
		if (!entity) return false

		entity.setOption(key, value)

		this.tryTriggerLocalVariablesChanged(entity)

		this.commitChange()

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

		this.tryTriggerLocalVariablesChanged(entity)

		this.commitChange()

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

		this.tryTriggerLocalVariablesChanged(entity)

		this.commitChange()

		return true
	}

	/**
	 * Set the local variable name for an entity
	 * @param listId The list the entity is in
	 * @param id The id of the entity
	 * @param name The new name for the variable
	 */
	entitySetVariableName(listId: SomeSocketEntityLocation, id: string, name: string): boolean {
		const entityList = this.getEntityList(listId)
		if (!entityList) return false

		const entity = entityList.findById(id)
		if (!entity) return false

		const oldLocalVariableName = entity.localVariableName

		entity.setVariableName(name)

		this.tryTriggerLocalVariablesChanged(entity, oldLocalVariableName)

		this.commitChange()

		return true
	}

	/**
	 * Set the variable value for an entity, if this is a user local variable
	 * @param listId The list the entity is in
	 * @param id The id of the entity
	 * @param value The new value for the variable
	 */
	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	entitySetVariableValue(listId: SomeSocketEntityLocation, id: string, value: any): boolean {
		const entityList = this.getEntityList(listId)
		if (!entityList) return false

		const entity = entityList.findById(id)
		if (!entity) return false

		if (!isInternalUserValueFeedback(entity)) return false

		entity.setUserValue(value)

		// Persist value if needed
		if (entity.rawOptions.persist_value) {
			entity.rawOptions.startup_value = value

			this.commitChange()
		}

		this.tryTriggerLocalVariablesChanged(entity)

		return true
	}

	/**
	 * Update the selected style properties for a boolean feedback
	 * @param id the id of the entity
	 * @param selected the properties to be selected
	 */
	entitySetStyleSelection(
		listId: SomeSocketEntityLocation,
		baseStyle: ButtonStyleProperties,
		id: string,
		selected: string[]
	): boolean {
		const entityList = this.getEntityList(listId)
		if (!entityList) return false

		const entity = entityList.findById(id)
		if (!entity) return false

		// if (this.#booleanOnly) throw new Error('FragmentFeedbacks not setup to use styles')

		if (entity.setStyleSelection(selected, baseStyle)) {
			this.commitChange()

			return true
		}

		return false
	}

	/**
	 * Update an style property for a boolean feedback
	 * @param id the id of the entity
	 * @param key the key/name of the property
	 * @param value the new value
	 */
	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	entitySetStyleValue(listId: SomeSocketEntityLocation, id: string, key: string, value: any): boolean {
		const entityList = this.getEntityList(listId)
		if (!entityList) return false

		const entity = entityList.findById(id)
		if (!entity) return false

		// if (this.#booleanOnly) throw new Error('FragmentFeedbacks not setup to use styles')

		if (entity.setStyleValue(key, value)) {
			this.commitChange()

			return true
		}

		return false
	}

	/**
	 * Remove any entities referencing a specified connectionId
	 */
	forgetConnection(connectionId: string): void {
		let changed = false
		for (const list of this.getAllEntityLists()) {
			if (list.forgetForConnection(connectionId)) changed = true
		}

		if (changed) this.commitChange(true)
	}

	/**
	 * Prune all actions/feedbacks referencing unknown conncetions
	 * Doesn't do any cleanup, as it is assumed that the connection has not been running
	 */
	verifyConnectionIds(knownConnectionIds: Set<string>): void {
		let changed = false

		for (const list of this.getAllEntityLists()) {
			if (list.verifyConnectionIds(knownConnectionIds)) changed = true
		}

		if (changed) {
			this.commitChange(true)
		}
	}

	/**
	 * Update the feedbacks on the button with new values
	 * @param connectionId The instance the feedbacks are for
	 * @param newValues The new feedback values
	 */
	abstract updateFeedbackValues(connectionId: string, newValues: Record<string, any>): void

	/**
	 * Get all the connectionIds for actions and feedbacks which are active
	 */
	getAllEnabledConnectionIds(): Set<string> {
		const connectionIds = new Set<string>()

		for (const list of this.getAllEntityLists()) {
			list.getAllEnabledConnectionIds(connectionIds)
		}

		return connectionIds
	}
}

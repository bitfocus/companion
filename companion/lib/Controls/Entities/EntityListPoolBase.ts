import LogController, { type Logger } from '../../Log/Controller.js'
import {
	EntityModelType,
	type EntityOwner,
	type FeedbackEntityStyleOverride,
	type SomeEntityModel,
	type SomeReplaceableEntityModel,
	type SomeSocketEntityLocation,
} from '@companion-app/shared/Model/EntityModel.js'
import { isInternalUserValueFeedback, type ControlEntityInstance } from './EntityInstance.js'
import { ControlEntityList, type ControlEntityListDefinition } from './EntityList.js'
import type { InstanceProcessManager } from '../../Instance/ProcessManager.js'
import type { InternalController } from '../../Internal/Controller.js'
import isEqual from 'fast-deep-equal'
import type { InstanceDefinitionsForEntity, NewFeedbackValue, NewIsInvertedValue } from './Types.js'
import type { VariableValues } from '@companion-app/shared/Model/Variables.js'
import debounceFn from 'debounce-fn'
import type { VariablesValues } from '../../Variables/Values.js'
import { isLabelValid } from '@companion-app/shared/Label.js'
import { GetLegacyStyleProperty, ParseLegacyStyle } from '../../Resources/ConvertLegacyStyleToElements.js'
import type { ExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import type { JsonValue } from 'type-fest'
import { EntityPoolIsInvertedManager } from './EntityIsInvertedManager.js'
import type { VariablesAndExpressionParser } from '../../Variables/VariablesAndExpressionParser.js'
import type { IPageStore } from '../../Page/Store.js'

export interface ControlEntityListChangeProps {
	/** If true, do not save changes to the database/disk */
	noSave?: boolean
	/** If true, the control should be redrawn */
	redraw: boolean
	/** The id of drawing elements that are affected */
	changedElementIds?: ReadonlySet<string>
	/** If true, invalidate all drawing elements */
	invalidateAllElements?: boolean
}
export interface ControlEntityListPoolProps {
	instanceDefinitions: InstanceDefinitionsForEntity
	internalModule: InternalController
	processManager: InstanceProcessManager
	variableValues: VariablesValues
	pageStore: IPageStore
	controlId: string
	reportChange: (options: ControlEntityListChangeProps) => void
}

export abstract class ControlEntityListPoolBase {
	/**
	 * The logger
	 */
	protected readonly logger: Logger

	readonly #instanceDefinitions: InstanceDefinitionsForEntity
	readonly #internalModule: InternalController
	readonly #processManager: InstanceProcessManager
	readonly #variableValues: VariablesValues
	readonly #isLayeredDrawing: boolean
	readonly #isInvertedManager: EntityPoolIsInvertedManager
	readonly #pageStore: IPageStore

	protected readonly controlId: string

	/**
	 * Report changes to the database and disk
	 */
	protected readonly reportChange: (options: ControlEntityListChangeProps) => void

	protected constructor(props: ControlEntityListPoolProps, isLayeredDrawing: boolean) {
		this.logger = LogController.createLogger(`Controls/Fragments/EnittyPool/${props.controlId}`)

		this.controlId = props.controlId
		this.reportChange = props.reportChange

		this.#instanceDefinitions = props.instanceDefinitions
		this.#internalModule = props.internalModule
		this.#processManager = props.processManager
		this.#variableValues = props.variableValues
		this.#isLayeredDrawing = isLayeredDrawing
		this.#pageStore = props.pageStore

		this.#isInvertedManager = new EntityPoolIsInvertedManager(
			props.controlId,
			this.createVariablesAndExpressionParser.bind(this),
			this.updateIsInvertedValues.bind(this)
		)
	}

	protected createEntityList(listDefinition: ControlEntityListDefinition): ControlEntityList {
		return new ControlEntityList(
			this.#instanceDefinitions,
			this.#internalModule,
			this.#processManager,
			this.#isInvertedManager,
			this.controlId,
			null,
			listDefinition
		)
	}

	protected tryTriggerLocalVariablesChanged(...entitiesOrNames: (ControlEntityInstance | string | null)[]): void {
		if (entitiesOrNames.length === 0) return

		for (const entityOrName of entitiesOrNames) {
			if (!entityOrName) continue

			const variableName = typeof entityOrName === 'string' ? entityOrName : entityOrName.localVariableName
			if (variableName) this.#pendingChangedVariables.add(variableName)
		}

		if (this.#pendingChangedVariables.size === 0) return

		/*
		 * This is debounced to ensure that a loop of references between variables doesn't cause an infinite loop of updates
		 * Future: This could be improved by using a 'rate limit' style approach, where we allow a bunch of updates to happen immediately,
		 * but then throttle the updates after that. Perhaps allow 10 within the first 2ms, then limit to 1 every Xms.
		 */
		this.#debouncedLocalVariablesChanged()
	}

	#pendingChangedVariables = new Set<string>()
	#debouncedLocalVariablesChanged = debounceFn(
		() => {
			const allChangedVariables = this.#pendingChangedVariables
			this.#pendingChangedVariables = new Set()

			this.#variableValues.emit('local_variables_changed', allChangedVariables, this.controlId)
		},
		{
			wait: 5,
			maxWait: 10,
		}
	)

	/**
	 * Remove any tracked state for a connection
	 */
	clearConnectionState(connectionId: string): void {
		let changed = false
		for (const list of this.getAllEntityLists()) {
			if (list.clearCachedValueForConnectionId(connectionId)) changed = true
		}
		if (changed)
			this.reportChange({
				redraw: true,
				noSave: true,
			})
	}

	createVariablesAndExpressionParser(overrideVariableValues: VariableValues | null): VariablesAndExpressionParser {
		const controlLocation = this.#pageStore.getLocationOfControlId(this.controlId)
		const variableEntities = this.getLocalVariableEntities()

		return this.#variableValues.createVariablesAndExpressionParser(
			controlLocation,
			variableEntities,
			overrideVariableValues
		)
	}

	/**
	 * Prepare this control for deletion
	 * @access public
	 */
	destroy(): void {
		this.#isInvertedManager.destroy()

		for (const list of this.getAllEntityLists()) {
			list.cleanup()
		}
	}

	protected abstract getEntityList(listId: SomeSocketEntityLocation): ControlEntityList | undefined
	protected abstract getAllEntityLists(): ControlEntityList[]

	abstract getLocalVariableEntities(): ControlEntityInstance[]

	/**
	 * Get all the style overrides for the layered drawing elements
	 * @returns A map of elementId -> elementProperty -> override value
	 */
	abstract getFeedbackStyleOverrides(): ReadonlyMap<string, ReadonlyMap<string, ExpressionOrValue<any>>>

	getLocalVariableValues(): VariableValues {
		const entities = this.getLocalVariableEntities()

		const values: VariableValues = {}

		for (const entity of entities) {
			const variableName = entity.localVariableName
			if (variableName) {
				// Strip off the prefix, as the ui doesn't expect that
				values[variableName.slice('local:'.length)] = entity.getResolvedFeedbackValue()
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
	 * This should be used when something has changed which will require all entities to be re-run
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

		this.reportChange({
			// Ensure new feedbacks clear caches
			redraw: true, // Need to recheck status icon
			invalidateAllElements: listId === 'feedbacks',
		})

		return true
	}

	/**
	 * Duplicate an entity on this control
	 */
	entityDuplicate(listId: SomeSocketEntityLocation, id: string): boolean {
		const entityList = this.getEntityList(listId)
		if (!entityList) return false

		const entity = entityList.duplicateEntity(id)
		if (!entity) return false

		this.tryTriggerLocalVariablesChanged(entity)

		this.reportChange({
			// Ensure new feedbacks clear caches
			redraw: listId === 'feedbacks',
			changedElementIds: listId === 'feedbacks' ? entity.styleOverrideAffectedElementIds : undefined,
		})

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

		// Collect element IDs referenced by style overrides
		const affectedElementIds = listId === 'feedbacks' ? entity.styleOverrideAffectedElementIds : undefined

		entity.setEnabled(enabled)

		this.tryTriggerLocalVariablesChanged(entity)

		this.reportChange({
			redraw: true,
			changedElementIds: affectedElementIds,
		})

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

		this.reportChange({
			redraw: false,
		})

		return true
	}

	/**
	 * Learn the options for an entity, by asking the connection for the current values
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

		this.reportChange({
			redraw: listId === 'feedbacks',
		})

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
			this.reportChange({
				redraw: true, // Need to recheck status icon
				changedElementIds: listId === 'feedbacks' ? removedEntity.styleOverrideAffectedElementIds : undefined,
			})

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

		let movedEntity: ControlEntityInstance | undefined

		if (
			isEqual(moveListId, newListId) &&
			oldInfo.parent.ownerId?.parentId === newOwnerId?.parentId &&
			oldInfo.parent.ownerId?.childGroup === newOwnerId?.childGroup
		) {
			movedEntity = oldInfo.parent.moveEntity(oldInfo.index, newIndex)
		} else {
			const newEntityList = this.getEntityList(newListId)
			if (!newEntityList) return false

			const newParent = newOwnerId ? newEntityList.findById(newOwnerId.parentId) : null
			if (newOwnerId && !newParent) return false

			// Ensure the new parent is not a child of the entity being moved
			if (newOwnerId && oldInfo.item.findChildById(newOwnerId.parentId)) return false

			// Check if the new parent can hold the entity being moved
			if (newParent && !newParent.canAcceptChild(newOwnerId!.childGroup, oldInfo.item)) return false
			if (!newParent && !newEntityList.canAcceptEntity(oldInfo.item)) return false

			movedEntity = oldInfo.parent.popEntity(oldInfo.index)
			if (!movedEntity) return false

			if (newParent) {
				newParent.pushChild(movedEntity, newOwnerId!.childGroup, newIndex)
			} else {
				newEntityList.pushEntity(movedEntity, newIndex)
			}
		}

		this.reportChange({
			redraw: true,
			// If it moved at all, that could invalidate the overrides. Play it safe
			changedElementIds: movedEntity?.styleOverrideAffectedElementIds,
		})

		return true
	}

	/**
	 * Replace an entity with an updated version
	 */
	entityReplace(newProps: SomeReplaceableEntityModel, skipNotifyModule = false): ControlEntityInstance | undefined {
		for (const entityList of this.getAllEntityLists()) {
			const entity = entityList.findById(newProps.id)
			if (!entity) continue

			// Ignore if the types do not match
			if (entity.type !== newProps.type) return undefined

			const oldElementIds = entity.styleOverrideAffectedElementIds

			// If this is a layered drawing, translate the style into the overrides format
			const existingStyleOverrides = entity.styleOverrides
			if (
				this.#isLayeredDrawing &&
				newProps.type === EntityModelType.Feedback &&
				newProps.style &&
				existingStyleOverrides
			) {
				const newOverrides: FeedbackEntityStyleOverride[] = []

				const parsedStyle = ParseLegacyStyle(newProps.style)

				// Translate the old advance feedback property lookup into the newly produced value
				for (const override of existingStyleOverrides) {
					if (!override.override.isExpression) {
						const newValue = GetLegacyStyleProperty(
							parsedStyle,
							newProps.style,
							override.override.value,
							override.elementProperty
						)

						// Only preserve ones which exist in the new style, otherwise they should be discarded as they wont have a real value to use
						if (newValue) {
							newOverrides.push({
								...override,
								override: newValue,
							})
						}
					}
				}

				newProps = { ...newProps, styleOverrides: newOverrides, style: undefined }
			}

			entity.replaceProps(newProps, skipNotifyModule)

			this.tryTriggerLocalVariablesChanged(entity)

			this.reportChange({
				redraw: true,
				changedElementIds: entity.styleOverrideAffectedElementIds?.union(oldElementIds || new Set<string>()),
			})

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

		this.reportChange({
			redraw: true,
			invalidateAllElements: listId === 'feedbacks',
		})

		return true
	}

	/**
	 * Update an option for an entity
	 * @param id the id of the entity
	 * @param key the key/name of the property
	 * @param value the new value
	 */
	entitySetOption(
		listId: SomeSocketEntityLocation,
		id: string,
		key: string,
		value: ExpressionOrValue<JsonValue | undefined>
	): boolean {
		const entityList = this.getEntityList(listId)
		if (!entityList) return false

		const entity = entityList.findById(id)
		if (!entity) return false

		entity.setOption(key, value)

		this.tryTriggerLocalVariablesChanged(entity)

		this.reportChange({ redraw: false })

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

		this.reportChange({
			redraw: true,
			// No need to invalidate caches, feedback values havent changed
		})

		return true
	}

	/**
	 * Set whether a boolean feedback should be inverted
	 * @param id the id of the entity
	 * @param isInverted the new value
	 */
	entitySetInverted(listId: SomeSocketEntityLocation, id: string, isInverted: ExpressionOrValue<boolean>): boolean {
		const entityList = this.getEntityList(listId)
		if (!entityList) return false

		const entity = entityList.findById(id)
		if (!entity) return false

		entity.setInverted(isInverted)

		this.tryTriggerLocalVariablesChanged(entity)

		this.reportChange({
			redraw: true,
			changedElementIds: listId === 'feedbacks' ? entity.styleOverrideAffectedElementIds : undefined,
		})

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

		// Make sure the new name is valid
		if (name !== '' && !isLabelValid(name)) {
			// throw new Error(`Invalid local variable name "${name}"`)
			return false
		}

		const oldLocalVariableName = entity.localVariableName

		entity.setVariableName(name)

		this.tryTriggerLocalVariablesChanged(entity, oldLocalVariableName)

		this.reportChange({ redraw: false })

		return true
	}

	/**
	 * Set the variable value for an entity, if this is a user local variable
	 * @param listId The list the entity is in
	 * @param id The id of the entity
	 * @param value The new value for the variable
	 */
	entitySetVariableValue(listId: SomeSocketEntityLocation, id: string, value: JsonValue | undefined): boolean {
		const entityList = this.getEntityList(listId)
		if (!entityList) return false

		const entity = entityList.findById(id)
		if (!entity) return false

		if (!isInternalUserValueFeedback(entity)) return false

		const needsPersistence = entity.setUserValue(value)

		// Persist value if needed
		if (needsPersistence) {
			this.reportChange({ redraw: false })
		}

		this.tryTriggerLocalVariablesChanged(entity)

		return true
	}

	entityReplaceStyleOverride(
		listId: SomeSocketEntityLocation,
		entityId: string,
		override: FeedbackEntityStyleOverride
	): boolean {
		const entityList = this.getEntityList(listId)
		if (!entityList) return false

		const entity = entityList.findById(entityId)
		if (!entity) return false

		// if (this.#booleanOnly) throw new Error('FragmentFeedbacks not setup to use styles')

		const result = entity.replaceStyleOverride(override)
		if (result) {
			// Invalidate the specific element if the feedback is enabled
			this.reportChange({
				redraw: !entity.disabled,
				changedElementIds: !entity.disabled ? new Set([result.elementId]) : undefined,
			})

			return true
		}

		return false
	}

	entityRemoveStyleOverride(listId: SomeSocketEntityLocation, entityId: string, overrideId: string): boolean {
		const entityList = this.getEntityList(listId)
		if (!entityList) return false

		const entity = entityList.findById(entityId)
		if (!entity) return false

		// if (this.#booleanOnly) throw new Error('FragmentFeedbacks not setup to use styles')

		const removed = entity.removeStyleOverride(overrideId)
		if (removed) {
			// Invalidate the specific element if the feedback is enabled
			this.reportChange({
				redraw: !entity.disabled,
				changedElementIds: !entity.disabled ? new Set([removed.elementId]) : undefined,
			})

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

		if (changed) {
			this.reportChange({
				redraw: true,
				invalidateAllElements: true,
			})
		}
	}

	/**
	 * Prune all entities referencing unknown connections
	 * Doesn't do any cleanup, as it is assumed that the connection has not been running
	 */
	verifyConnectionIds(knownConnectionIds: Set<string>): void {
		let changed = false

		for (const list of this.getAllEntityLists()) {
			if (list.verifyConnectionIds(knownConnectionIds)) changed = true
		}

		if (changed) {
			this.reportChange({
				redraw: true,
				invalidateAllElements: true,
			})
		}
	}

	/**
	 * Update the feedbacks on the control with new values
	 * @param connectionId The instance the feedbacks are for
	 * @param newValues The new feedback values
	 */
	abstract updateFeedbackValues(connectionId: string, newValues: ReadonlyMap<string, NewFeedbackValue>): void

	/**
	 * Update the isInverted values on the control with new calculated isInverted values
	 * @param newValues The new isInverted values
	 */
	protected abstract updateIsInvertedValues(newValues: ReadonlyMap<string, NewIsInvertedValue>): void

	/**
	 * Get all the connectionIds for entities which are active
	 */
	getAllEnabledConnectionIds(): Set<string> {
		const connectionIds = new Set<string>()

		for (const list of this.getAllEntityLists()) {
			list.getAllEnabledConnectionIds(connectionIds)
		}

		return connectionIds
	}

	/**
	 * Propagate variable changes
	 * @param changedVariables - variables with changes
	 */
	onVariablesChanged(changedVariables: ReadonlySet<string>): void {
		this.#isInvertedManager.onVariablesChanged(changedVariables)
	}
}

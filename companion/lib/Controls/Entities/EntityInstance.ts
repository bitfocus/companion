import isEqual from 'fast-deep-equal'
import { nanoid } from 'nanoid'
import type { JsonValue } from 'type-fest'
import {
	isCustomActionsConnectionId,
	isInternalConnectionId,
	isVirtualConnectionId,
} from '@companion-app/shared/ConnectionId.js'
import type { SomeControlId } from '@companion-app/shared/ControlId.js'
import { BANNED_PROPS } from '@companion-app/shared/Expressions.js'
import { LocalVariableNameRegex } from '@companion-app/shared/LocalVariable.js'
import type { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import {
	EntityModelType,
	FeedbackEntitySubType,
	isInternalUserValueFeedback as libIsInternalUserValueFeedback,
	type ActionEntityModel,
	type EntitySupportedChildGroupDefinition,
	type FeedbackEntityModel,
	type FeedbackEntityStyleOverride,
	type FeedbackValue,
	type RawStoreResult,
	type ReplaceableActionEntityModel,
	type ReplaceableFeedbackEntityModel,
	type SomeEntityModel,
	type SomeReplaceableEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import type { ExpressionableOptionsObject, ExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import type { VariableValues } from '@companion-app/shared/Model/Variables.js'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import type { InternalVisitor } from '../../Internal/Types.js'
import LogController, { type Logger } from '../../Log/Controller.js'
import { visitEntityModel } from '../../Resources/Visitors/EntityInstanceVisitor.js'
import type {
	ExpressionParserOptions,
	VariablesAndExpressionParser,
} from '../../Variables/VariablesAndExpressionParser.js'
import { ControlEntityList, type ControlEntityListDefinition } from './EntityList.js'
import type { NewSpecialExpressionValue } from './SpecialExpressions.js'
import type {
	EntityScope,
	FeedbackExecutionContext,
	InstanceDefinitionsForEntity,
	InternalControllerForEntity,
	NewEntityIds,
	NewFeedbackValue,
	ProcessManagerForEntity,
	StoreResult,
	TransientCopy,
} from './Types.js'

export class ControlEntityInstance {
	/**
	 * The logger
	 */
	readonly #logger: Logger

	readonly #instanceDefinitions: InstanceDefinitionsForEntity
	readonly #internalModule: InternalControllerForEntity
	readonly #processManager: ProcessManagerForEntity
	readonly #scope: EntityScope

	/**
	 * Id of the control this belongs to
	 */
	readonly #controlId: SomeControlId

	readonly #data: Omit<SomeEntityModel, 'children'>

	/**
	 * Value of the feedback when it was last executed
	 */
	#cachedFeedbackValue: FeedbackValue = undefined
	/**
	 * Value of whether the feedback value should be inverted
	 * Note: This only applies to boolean feedbacks
	 */
	#cachedIsInverted: boolean = false

	/**
	 * The target into which this action's result is stored, if it has one.
	 */
	#cachedStoreResult: StoreResult | undefined

	#children = new Map<string, ControlEntityList>()

	/**
	 * Child groups which exist only while Companion is running (eg the copy of a custom action held by an action
	 * which calls it). They are never persisted or shown in the ui, and parse their options in their own scope.
	 */
	/** Copies of something this holds, such as of a custom action, by key */
	#transientCopies = new Map<string, TransientCopy>()

	/** Whether this is a copy which exists only while running, such as of a custom action, so is never upgraded */
	get isTransient(): boolean {
		return this.#scope.isTransient
	}

	/**
	 * Get the id of this entity
	 */
	get id(): string {
		return this.#data.id
	}

	get disabled(): boolean {
		return !!this.#data.disabled
	}

	get definitionId(): string {
		return this.#data.definitionId
	}

	get type(): EntityModelType {
		return this.#data.type
	}

	/**
	 * Get the upgrade index of this entity.
	 * This _should_ always be defined now, but it may be msising for older entities
	 *
	 * Prior to 4.0, this was only stored for entities which were awaiting an upgrade.
	 * Since 4.0, this should always be set.
	 */
	get upgradeIndex(): number | undefined {
		return this.#data.upgradeIndex
	}

	/**
	 * Get the id of the connection this action belongs to
	 */
	get connectionId(): string {
		return this.#data.connectionId
	}

	/**
	 * Get a reference to the options for this action
	 * Note: This must not be a copy, but the raw object
	 */
	get rawOptions(): ExpressionableOptionsObject {
		return this.#data.options
	}

	/**
	 * Get the raw storeResult value for this action
	 */
	get rawStoreResult(): RawStoreResult | undefined {
		const data = this.#data
		if (data.type !== EntityModelType.Action) return undefined
		return (data as ActionEntityModel).storeResult
	}

	/**
	 * Get the raw targets of the outputs of this action, by the id of the output
	 */
	get rawOutputTargets(): Readonly<Record<string, RawStoreResult>> {
		const data = this.#data
		if (data.type !== EntityModelType.Action) return {}
		return (data as ActionEntityModel).outputTargets ?? {}
	}

	/**
	 * Get the raw isInverted value for this feedback
	 */
	get rawIsInverted(): ExpressionOrValue<boolean> | undefined {
		const data = this.#data
		if (data.type !== EntityModelType.Feedback) return undefined
		return (data as FeedbackEntityModel).isInverted
	}

	get feedbackValue(): FeedbackValue {
		return this.#cachedFeedbackValue
	}

	get styleOverrides(): FeedbackEntityStyleOverride[] | undefined {
		if (this.type !== EntityModelType.Feedback) return undefined
		return (this.#data as FeedbackEntityModel).styleOverrides
	}

	get styleOverrideAffectedElementIds(): ReadonlySet<string> | undefined {
		if (!this.styleOverrides) return undefined
		return new Set(this.styleOverrides.map((o) => o.elementId))
	}

	get localVariableName(): string | null {
		if (this.type !== EntityModelType.Feedback || this.disabled) return null

		const entity = this.#data as FeedbackEntityModel
		if (!entity.variableName) return null

		// Check if the variable name is valid
		if (!entity.variableName.match(LocalVariableNameRegex)) return null

		return `local:${entity.variableName}`
	}

	get rawLocalVariableName(): string | null {
		if (this.type !== EntityModelType.Feedback || this.disabled) return null

		const entity = this.#data as FeedbackEntityModel
		if (!entity.variableName) return null

		// Check if the variable name is valid
		if (!entity.variableName.match(LocalVariableNameRegex)) return null

		return entity.variableName
	}

	/**
	 * The location (if any) where this action's result should be written.
	 */
	get storeResult(): StoreResult | undefined {
		if (this.type !== EntityModelType.Action) return undefined
		return this.#cachedStoreResult
	}

	/**
	 * @param instanceDefinitions
	 * @param internalModule
	 * @param processManager
	 * @param controlId - id of the control
	 * @param data
	 * @param newIds How this entity and its children get their ids
	 */
	constructor(
		instanceDefinitions: InstanceDefinitionsForEntity,
		internalModule: InternalControllerForEntity,
		processManager: ProcessManagerForEntity,
		scope: EntityScope,
		controlId: SomeControlId,
		data: SomeEntityModel,
		newIds: NewEntityIds
	) {
		this.#logger = LogController.createLogger(`Controls/Fragments/EntityInstance/${controlId}/${data.id}`)

		this.#instanceDefinitions = instanceDefinitions
		this.#internalModule = internalModule
		this.#processManager = processManager
		this.#scope = scope
		this.#controlId = controlId

		{
			const newData = structuredClone(data)
			delete newData.children
			if (!newData.options) newData.options = {}
			this.#data = newData
		}

		if (newIds) {
			this.#data.id = newIds === true ? nanoid() : newIds(this.#data.id)
		}

		if (isInternalConnectionId(data.connectionId)) {
			let children = { ...data.children }

			// Perform the upgrade conversion now.
			// If we do this later, then any children will end up discarded
			const newProps = this.#internalModule.entityUpgrade(this.#data, this.#controlId)
			if (newProps) {
				this.replaceProps(newProps, false)

				children = { ...children, ...newProps.children }
			}

			const supportedChildGroups = this.getSupportedChildGroupDefinitions()
			for (const groupDefinition of supportedChildGroups) {
				try {
					const childGroup = this.#getOrCreateChildGroupFromDefinition(groupDefinition)
					childGroup.loadStorage(children?.[groupDefinition.groupId] ?? [], true, newIds)
				} catch (e) {
					this.#logger.error(`Error loading child entity group: ${stringifyError(e)}`)
				}
			}
		}

		this.#cachedFeedbackValue = this.#getStartupValue()
		this.#cachedIsInverted = this.#getStartupIsInverted()
		this.#cachedStoreResult = undefined
	}

	#getOrCreateChildGroupFromDefinition(listDefinition: EntitySupportedChildGroupDefinition): ControlEntityList {
		const existing = this.#children.get(listDefinition.groupId)
		if (existing) return existing

		const childGroup = new ControlEntityList(
			this.#instanceDefinitions,
			this.#internalModule,
			this.#processManager,
			this.#scope,
			this.#controlId,
			{ parentId: this.id, childGroup: listDefinition.groupId },
			listDefinition
		)
		this.#children.set(listDefinition.groupId, childGroup)

		return childGroup
	}

	#getOrCreateChildGroup(groupId: string): ControlEntityList {
		const existing = this.#children.get(groupId)
		if (existing) return existing

		// Check what names are allowed
		const supportedChildGroups = this.getSupportedChildGroupDefinitions()
		const listDefinition = supportedChildGroups.find((g) => g.groupId === groupId)
		if (!listDefinition) throw new Error('Entity cannot accept children in this group.')

		return this.#getOrCreateChildGroupFromDefinition(listDefinition)
	}

	getSupportedChildGroupDefinitions(): EntitySupportedChildGroupDefinition[] {
		if (!isInternalConnectionId(this.connectionId)) return []

		const entityDefinition = this.#instanceDefinitions.getEntityDefinition(
			this.#data.type,
			this.#data.connectionId,
			this.#data.definitionId
		)
		return entityDefinition?.supportsChildGroups ?? []
	}

	/**
	 * Inform the instance of a removed/disabled entity
	 */
	cleanup(): void {
		this.#cleanupSelf()

		for (const childGroup of this.#children.values()) {
			childGroup.cleanup()
		}
		for (const childGroup of this.#transientCopyLists()) {
			childGroup.cleanup()
		}
	}

	/**
	 * Inform the relevant module of a removed entity, without touching the entities inside it.
	 * The counterpart of #subscribeSelf. Any copy it holds (such as of a custom action) is dropped by whatever built
	 * it, when told this entity has gone, just as #subscribeSelf has it built
	 */
	#cleanupSelf(): void {
		// Inform relevant module
		if (isInternalConnectionId(this.#data.connectionId)) {
			this.#internalModule.entityDelete(this.asEntityModel())
		} else if (isCustomActionsConnectionId(this.#data.connectionId)) {
			this.#scope.customActionInstances.entityDelete(this)
		} else if (!isVirtualConnectionId(this.#data.connectionId)) {
			this.#processManager.connectionEntityDelete(this.asEntityModel(), this.#controlId).catch((e: unknown) => {
				this.#logger.silly(`entityDelete to connection "${this.connectionId}" failed: ${stringifyError(e)}`)
			})
		}

		this.#scope.specialExpressionManager.forgetEntity(this.id)

		// Remove from cached feedback values
		this.#cachedFeedbackValue = undefined
	}

	/**
	 * Create a list of entities for a copy held by this entity, such as of a custom action. It is never persisted or
	 * shown in the ui, its entities parse their options in the given scope, and they are not subscribed until the copy
	 * is held
	 * @param listId Id of the list, unique among the lists of the copies held by this entity
	 * @param scope The scope the entities of the list parse their options in
	 * @param listDefinition The type of entities in the list
	 * @param entities The entities of the list
	 * @param newIds How the entities get their ids, which must be unique within the control
	 */
	createTransientList(
		listId: string,
		scope: EntityScope,
		listDefinition: ControlEntityListDefinition,
		entities: SomeEntityModel[],
		newIds: NewEntityIds
	): ControlEntityList {
		const list = new ControlEntityList(
			this.#instanceDefinitions,
			this.#internalModule,
			this.#processManager,
			scope,
			this.#controlId,
			{ parentId: this.id, childGroup: listId },
			listDefinition
		)
		list.loadStorage(entities, true, newIds)
		return list
	}

	/**
	 * Hold a copy, replacing any held with the same key, so that it is included with the entities of this one, and
	 * subscribe its lists in order
	 */
	setTransientCopy(key: string, copy: TransientCopy): void {
		this.removeTransientCopy(key)
		this.#transientCopies.set(key, copy)

		// Only once held, so that the values its entities are given as they subscribe reach them.
		// A disabled entity has nothing subscribed, so neither should its copies
		if (!this.disabled) {
			for (const list of copy.lists) list.subscribe()
		}
	}

	/**
	 * Get a copy held by this entity
	 */
	getTransientCopy(key: string): TransientCopy | undefined {
		return this.#transientCopies.get(key)
	}

	/**
	 * Stop holding a copy, cleaning up its entities
	 */
	removeTransientCopy(key: string): void {
		const copy = this.#transientCopies.get(key)
		if (!copy) return

		this.#transientCopies.delete(key)
		for (const list of copy.lists) list.cleanup()
	}

	/** The lists of the copies held by this entity */
	#transientCopyLists(): ControlEntityList[] {
		return [...this.#transientCopies.values()].flatMap((copy) => copy.lists)
	}

	/**
	 * Inform the instance of an updated entity, and the entities inside it. The counterpart of cleanup
	 * @param onlyType If set, only re-subscribe entities of this type
	 * @param onlyConnectionId If set, only re-subscribe entities for this connection
	 */
	subscribe(onlyType?: EntityModelType, onlyConnectionId?: string): void {
		if (
			(!onlyConnectionId || this.#data.connectionId === onlyConnectionId) &&
			(!onlyType || this.#data.type === onlyType)
		) {
			this.#subscribeSelf()
		}

		for (const childGroup of this.#children.values()) {
			childGroup.subscribe(onlyType, onlyConnectionId)
		}
		for (const childGroup of this.#transientCopyLists()) {
			childGroup.subscribe(onlyType, onlyConnectionId)
		}
	}

	/**
	 * Inform the relevant module of an updated entity, without touching the entities inside it.
	 * The counterpart of #cleanupSelf
	 */
	#subscribeSelf(): void {
		const thisData = this.#data

		if (isInternalConnectionId(thisData.connectionId)) {
			// Children-of-actions are cached here too, not just evaluated live - see getBooleanFeedbackValue.
			this.#internalModule.entityUpdate(this.asEntityModel(), this.#controlId, () =>
				this.createVariablesAndExpressionParser(null)
			)
		} else if (isCustomActionsConnectionId(thisData.connectionId)) {
			// Build or update the copy of the custom action held by this action
			this.#scope.customActionInstances.entityUpdate(this, this.#controlId, this.#scope)
		} else if (!isVirtualConnectionId(thisData.connectionId)) {
			// Always notify, even when disabled, so the EntityManager can run upgrade scripts.
			// The EntityManager will not subscribe disabled entities to the module.
			this.#processManager.connectionEntityUpdate(this, this.#controlId).catch((e: unknown) => {
				this.#logger.silly(`entityUpdate to connection "${this.connectionId}" failed: ${stringifyError(e)}`)
			})
		}

		if (thisData.disabled) {
			this.#scope.specialExpressionManager.forgetEntity(this.id)
		} else {
			const specialExpression = thisData.type === EntityModelType.Feedback ? 'isInverted' : 'storeResult'
			this.#scope.specialExpressionManager.trackEntity(this, specialExpression)
		}
	}

	#getStartupValue(): JsonValue | undefined {
		if (!isInternalUserValueFeedback(this)) return undefined

		return this.#data.options.startup_value?.value
	}

	#getStartupIsInverted(): boolean {
		if (this.#data.type !== EntityModelType.Feedback) return false

		const thisData = this.#data as FeedbackEntityModel
		if (thisData.isInverted?.isExpression) return false
		return !!thisData.isInverted?.value
	}

	/**
	 * Set whether this entity is enabled
	 */
	setEnabled(enabled: boolean): void {
		this.#data.disabled = !enabled

		// Only this entity is enabled or disabled. The entities inside it keep their own state and stay subscribed: a
		// disabled entity doesn't run or evaluate them, so that is only wasted work, and it keeps every entity's
		// subscription down to its own enabled state, however it is moved around or subscribed
		if (!this.#data.disabled) {
			// Start again from the startup value
			this.#cachedFeedbackValue = this.#getStartupValue()

			this.#subscribeSelf()
		} else {
			// This clears the cached feedback value
			this.#cleanupSelf()
		}
	}

	/**
	 * Set the headline for this entity
	 */
	setHeadline(headline: string): void {
		this.#data.headline = headline

		// Don't need to resubscribe
	}

	/**
	 * Set the connection of this entity
	 */
	setConnectionId(connectionId: string): boolean {
		// The definitions (and children) of the internal module and of custom actions mean nothing to a connection, and
		// the reverse. So only a module entity, which has no children, can change connection
		if (isVirtualConnectionId(this.#data.connectionId) || isVirtualConnectionId(connectionId)) return false

		// first unsubscribe action from old connection
		this.#cleanupSelf()
		// next change connectionId
		this.#data.connectionId = connectionId
		// last subscribe to new connection
		this.#subscribeSelf()

		return true
	}

	/**
	 * Set whether this feedback is inverted
	 */
	setInverted(isInverted: ExpressionOrValue<boolean>): void {
		if (this.#data.type !== EntityModelType.Feedback) return

		const thisData = this.#data as FeedbackEntityModel

		// TODO - verify this is a boolean feedback

		thisData.isInverted = isInverted

		if (isInverted.isExpression) {
			// Trigger a re-evaluation of the expression
			this.#subscribeSelf()
		} else {
			this.#cachedIsInverted = !!isInverted.value
		}
	}

	/**
	 * Set the variable name for this feedback
	 */
	setVariableName(variableName: string): void {
		if (this.#data.type !== EntityModelType.Feedback) return

		const thisData = this.#data as FeedbackEntityModel

		thisData.variableName = variableName

		// Don't need to resubscribe
	}

	/**
	 * Set the options for this entity
	 */
	setOptions(options: ExpressionableOptionsObject): void {
		this.#data.options = options

		// Remove from cached feedback values
		if (this.#getStartupValue() === undefined) {
			this.#cachedFeedbackValue = undefined
		}

		// Inform relevant module
		this.#subscribeSelf()
	}

	/** Set the target into which an action's result is stored (if any). */
	setRawStoreResult(target: RawStoreResult | undefined): void {
		if (this.type !== EntityModelType.Action) return

		const data = this.#data as ActionEntityModel

		data.storeResult = target
		// Only the storeResult expression of this entity changes, which trackEntity replaces. Nothing else needs to be
		// cleaned up, least of all the entities inside it
		this.#subscribeSelf()
	}

	/**
	 * Set the target into which an output of this action is written
	 * @param outputId The id of the output
	 * @param target The target, or null to discard the output
	 * @returns Whether it was set, as only an action has outputs
	 */
	setRawOutputTarget(outputId: string, target: RawStoreResult | null): boolean {
		if (this.type !== EntityModelType.Action) return false
		// The id is used as a key, so it can't be one which every object has
		if (BANNED_PROPS.has(outputId)) return false

		const data = this.#data as ActionEntityModel
		const targets = { ...data.outputTargets }
		if (target) {
			targets[outputId] = target
		} else {
			delete targets[outputId]
		}
		data.outputTargets = Object.keys(targets).length > 0 ? targets : undefined
		return true
	}

	/**
	 * Set the upgradeIndex for this entity or throw an error if it is already set
	 */
	setMissingUpgradeIndex(upgradeIndex: number): void {
		if (this.#data.upgradeIndex !== undefined)
			throw new Error(`Entity ${this.#data.id} already has an upgrade index set`)

		this.#data.upgradeIndex = upgradeIndex
	}

	/**
	 * Learn the options for an entity, by asking the connection for the current values
	 */
	async learnOptions(signal: AbortSignal): Promise<boolean> {
		const newOptions = await this.#processManager.connectionEntityLearnOptions(
			this.asEntityModel(),
			this.#controlId,
			signal
		)
		if (newOptions && !signal.aborted) {
			this.setOptions(newOptions)

			return true
		}

		return false
	}

	/**
	 * Set an option for this entity
	 */
	setOption(key: string, value: ExpressionOrValue<JsonValue | undefined>): void {
		if (BANNED_PROPS.has(key)) throw new Error(`Setting option "${key}" is not allowed`)
		this.#data.options[key] = value

		// Remove from cached feedback values
		if (this.#getStartupValue() === undefined) {
			this.#cachedFeedbackValue = undefined
		}

		// Inform relevant module
		this.#subscribeSelf()
	}

	/**
	 * Create a parser for the options of this entity, using the variables of the scope it belongs to
	 */
	createVariablesAndExpressionParser(
		overrideVariableValues: VariableValues | null,
		options?: ExpressionParserOptions
	): VariablesAndExpressionParser {
		return this.#scope.createVariablesAndExpressionParser(overrideVariableValues, options)
	}

	getEntityDefinition(): ClientEntityDefinition | undefined {
		return this.#instanceDefinitions.getEntityDefinition(
			this.#data.type,
			this.#data.connectionId,
			this.#data.definitionId
		)
	}

	/**
	 * Replace a style override for a feedback entity
	 * @param override the new style override
	 * @returns the override if successful, null otherwise
	 */
	replaceStyleOverride(override: FeedbackEntityStyleOverride): FeedbackEntityStyleOverride | null {
		if (this.#data.type !== EntityModelType.Feedback) return null

		const feedbackData = this.#data as FeedbackEntityModel

		if (!feedbackData.styleOverrides) feedbackData.styleOverrides = []

		const index = feedbackData.styleOverrides.findIndex((o) => o.overrideId === override.overrideId)
		if (index !== -1) {
			feedbackData.styleOverrides[index] = override
		} else {
			feedbackData.styleOverrides.push(override)
		}

		return override
	}

	/**
	 * Remove a style override for a feedback entity
	 * @param id the id of the override to remove
	 * @returns the removed override if successful, null otherwise
	 */
	removeStyleOverride(id: string): FeedbackEntityStyleOverride | null {
		if (this.#data.type !== EntityModelType.Feedback) return null

		const feedbackData = this.#data as FeedbackEntityModel

		if (!feedbackData.styleOverrides) return null

		const index = feedbackData.styleOverrides.findIndex((o) => o.overrideId === id)
		if (index === -1) return null

		const [removed] = feedbackData.styleOverrides.splice(index, 1)

		return removed
	}

	/**
	 * Find a child entity by id
	 */
	findChildById(id: string): ControlEntityInstance | undefined {
		for (const childGroup of this.#children.values()) {
			const result = childGroup.findById(id)
			if (result) return result
		}
		// Transient children are included, so that they can be given values
		for (const childGroup of this.#transientCopyLists()) {
			const result = childGroup.findById(id)
			if (result) return result
		}
		return undefined
	}

	/**
	 * Find the index of a child action, and the parent list
	 */
	findParentAndIndex(
		id: string
	): { parent: ControlEntityList; index: number; item: ControlEntityInstance } | undefined {
		for (const childGroup of this.#children.values()) {
			const result = childGroup.findParentAndIndex(id)
			if (result) return result
		}
		return undefined
	}

	/**
	 * Add a child entity to this entity
	 */
	addChild(groupId: string, entityModel: SomeEntityModel): ControlEntityInstance {
		const childGroup = this.#getOrCreateChildGroup(groupId)
		return childGroup.addEntity(entityModel)
	}

	/**
	 * Remove a child entity
	 */
	removeChild(id: string): ControlEntityInstance | undefined {
		for (const childGroup of this.#children.values()) {
			const removed = childGroup.removeEntity(id)
			if (removed) return removed
		}
		return undefined
	}

	/**
	 * Duplicate a child entity
	 */
	duplicateChild(id: string): ControlEntityInstance | undefined {
		for (const childGroup of this.#children.values()) {
			const newAction = childGroup.duplicateEntity(id)
			if (newAction) return newAction
		}
		return undefined
	}

	// // /**
	// //  * Reorder a action in the list
	// //  */
	// // moveChild(groupId: string, oldIndex: number, newIndex: number): void {
	// // 	const actionGroup = this.#children.get(groupId)
	// // 	if (!actionGroup) return

	// // 	return actionGroup.moveAction(oldIndex, newIndex)
	// // }

	// // /**
	// //  * Pop a child action from the list
	// //  * Note: this is used when moving a action to a different parent. Lifecycle is not managed
	// //  */
	// // popChild(index: number): FragmentActionInstance | undefined {
	// // 	return this.#children.popAction(index)
	// // }

	/**
	 * Push a child entity to the list
	 * Note: this is used when moving an entity from a different parent. Lifecycle is not managed
	 */
	pushChild(entity: ControlEntityInstance, groupId: string, index: number): void {
		const actionGroup = this.#getOrCreateChildGroup(groupId)
		return actionGroup.pushEntity(entity, index)
	}

	/**
	 * Check if this list can accept a provided entity
	 */
	canAcceptChild(groupId: string, entity: ControlEntityInstance): boolean {
		const childGroup = this.#getOrCreateChildGroup(groupId)
		return childGroup.canAcceptEntity(entity)
	}

	/**
	 * Recursively get all the child entities
	 */
	getAllChildren(): ControlEntityInstance[] {
		if (!isInternalConnectionId(this.connectionId)) return []

		const entities: ControlEntityInstance[] = []

		for (const childGroup of this.#children.values()) {
			entities.push(...childGroup.getAllEntities())
		}

		return entities
	}

	/**
	 * Recursively get all the child entities, including those in transient child groups
	 */
	getAllChildrenWithTransient(): ControlEntityInstance[] {
		const entities: ControlEntityInstance[] = []

		if (isInternalConnectionId(this.connectionId)) {
			for (const childGroup of this.#children.values()) {
				entities.push(...childGroup.getAllEntitiesWithTransient())
			}
		}
		for (const childGroup of this.#transientCopyLists()) {
			entities.push(...childGroup.getAllEntitiesWithTransient())
		}

		return entities
	}

	/**
	 * This entity and those inside it which are enabled. A disabled entity, and everything inside it, is left out
	 * @param includeTransient Whether to include the entities of transient child groups
	 */
	getAllEnabledEntities(includeTransient: boolean): ControlEntityInstance[] {
		if (this.disabled) return []

		const entities: ControlEntityInstance[] = [this]
		if (isInternalConnectionId(this.connectionId)) {
			for (const childGroup of this.#children.values()) {
				entities.push(...childGroup.getAllEnabledEntities(includeTransient))
			}
		}
		if (includeTransient) {
			for (const childGroup of this.#transientCopyLists()) {
				entities.push(...childGroup.getAllEnabledEntities(includeTransient))
			}
		}
		return entities
	}

	/**
	 * Recursively get all the child entities
	 */
	getChildren(groupId: string): ControlEntityList | undefined {
		if (!isInternalConnectionId(this.connectionId)) return undefined

		return this.#children.get(groupId)
	}

	/**
	 * Cleanup and forget any children belonging to the given connection
	 */
	forgetChildrenForConnection(connectionId: string): boolean {
		let changed = false
		for (const childGroup of this.#children.values()) {
			if (childGroup.forgetForConnection(connectionId)) {
				changed = true
			}
		}
		return changed
	}

	/**
	 * Prune all entities referencing unknown connections
	 * Doesn't do any cleanup, as it is assumed that the connection has not been running
	 */
	verifyChildConnectionIds(knownConnectionIds: ReadonlySet<string>): boolean {
		let changed = false
		for (const childGroup of this.#children.values()) {
			if (childGroup.verifyConnectionIds(knownConnectionIds)) {
				changed = true
			}
		}
		return changed
	}

	/**
	 * Replace portions of the action with an updated version
	 */
	replaceProps(newProps: SomeReplaceableEntityModel, skipNotifyModule = false): void {
		this.#data.definitionId = newProps.definitionId
		this.#data.options = newProps.options
		this.#data.upgradeIndex = newProps.upgradeIndex

		if (this.#data.type === EntityModelType.Feedback) {
			const feedbackData = this.#data as FeedbackEntityModel
			const newPropsData = newProps as ReplaceableFeedbackEntityModel
			feedbackData.isInverted = newPropsData.isInverted ?? feedbackData.isInverted

			// Replace the style overrides only if the new one is non-empty
			feedbackData.styleOverrides =
				newPropsData.styleOverrides && newPropsData.styleOverrides.length > 0
					? newPropsData.styleOverrides
					: feedbackData.styleOverrides
		}

		if (this.#data.type === EntityModelType.Action) {
			const actionData = this.#data as ActionEntityModel
			const newActionProps = newProps as ReplaceableActionEntityModel
			// Preserve any existing target chosen by the user, an upgrade must not clobber it
			actionData.storeResult = actionData.storeResult ?? newActionProps.storeResult
		}

		if (!skipNotifyModule) {
			this.#subscribeSelf()
		}
	}

	/**
	 * Visit any references in the current action
	 */
	visitReferences(visitor: InternalVisitor): void {
		visitEntityModel(visitor, this.#data)
	}

	asEntityModel(deep = true): SomeEntityModel {
		const data: SomeEntityModel = { ...this.#data }

		if (deep && isInternalConnectionId(this.connectionId)) {
			data.children = {}

			for (const [groupId, childGroup] of this.#children) {
				data.children[groupId] = childGroup.getDirectEntities().map((ent) => ent.asEntityModel(true))
			}
		}

		return data
	}

	/**
	 * Clear cached values for any feedback belonging to the given connection
	 * @returns Whether a value was changed
	 */
	clearCachedValueForConnectionId(connectionId: string): boolean {
		let changed = false

		if (this.#data.connectionId === connectionId) {
			this.#cachedFeedbackValue = this.#getStartupValue()
			this.#cachedIsInverted = this.#getStartupIsInverted()

			changed = true
		}

		for (const childGroup of [...this.#children.values(), ...this.#transientCopyLists()]) {
			if (childGroup.clearCachedValueForConnectionId(connectionId).length > 0) {
				changed = true
			}
		}

		return changed
	}

	/**
	 * Resolve the value of this feedback (boolean feedbacks as a boolean, otherwise the raw value).
	 * `context` selects cached vs live evaluation - see {@link getBooleanFeedbackValue}. A user value is state
	 * held by this entity rather than something computed, so it always comes from the cache.
	 */
	getResolvedFeedbackValue(context: FeedbackExecutionContext | null): FeedbackValue {
		if (this.#data.type !== EntityModelType.Feedback) return null

		const definition = this.getEntityDefinition()

		if (definition?.feedbackType === FeedbackEntitySubType.Boolean) {
			return this.getBooleanFeedbackValue(context)
		}

		// Lazy path (internal feedbacks only); module feedbacks fall through to the cache below.
		if (
			context &&
			!this.#data.disabled &&
			isInternalConnectionId(this.#data.connectionId) &&
			!isInternalUserValueFeedback(this)
		) {
			return this.#internalModule.evaluateFeedbackValue(
				this.asEntityModel(false) as FeedbackEntityModel,
				this.#controlId,
				context.parser
			)
		}

		return this.feedbackValue
	}

	/**
	 * Get the value of this feedback as a boolean.
	 *
	 * `context` null → cached value. Non-null → evaluate live with its parser so the running action's
	 * `$(this:*)` are visible; internal feedbacks only, module feedbacks fall back to the cache. `isInverted`
	 * always comes from the cache.
	 *
	 * A child-of-action internal feedback is therefore evaluated twice - eagerly cached, and live here (only
	 * the live value sees the execution context). Skipping the eager caching for these (tracking whether a
	 * feedback is inside an action subtree, and re-registering it when moved between lists) was considered and
	 * rejected: the sole gain is avoiding one evaluation of feedbacks that are cheap and rarely run, which
	 * isn't worth the extra moving parts. Revisit if these child feedbacks ever become expensive.
	 */
	getBooleanFeedbackValue(context: FeedbackExecutionContext | null): boolean {
		if (this.#data.disabled) return false

		if (this.#data.type !== EntityModelType.Feedback) return false

		const definition = this.getEntityDefinition()

		// Special case to handle the internal 'logic' operators, which need to be executed live
		if (isInternalLogicFeedback(this)) {
			// Future: This could probably be made a bit more generic by checking `definition.supportsChildFeedbacks`
			const childGroup = this.#children.get('default') || this.#children.get('children')
			const childValues = childGroup?.getChildBooleanFeedbackValues(context) ?? []

			return this.#internalModule.executeLogicFeedback(
				this.asEntityModel() as FeedbackEntityModel,
				this.#cachedIsInverted,
				childValues
			)
		}

		if (
			!definition ||
			definition.entityType !== EntityModelType.Feedback ||
			definition.feedbackType !== FeedbackEntitySubType.Boolean
		)
			return false

		// Lazy path (internal feedbacks only); module feedbacks fall through to the cache below.
		if (context && isInternalConnectionId(this.#data.connectionId)) {
			const value = this.#internalModule.evaluateFeedbackValue(
				this.asEntityModel(false) as FeedbackEntityModel,
				this.#controlId,
				context.parser
			)

			if (typeof value === 'boolean') {
				if (definition.showInvert && this.#cachedIsInverted) return !value
				return value
			}
			return false
		}

		if (typeof this.#cachedFeedbackValue === 'boolean') {
			if (definition.showInvert && this.#cachedIsInverted) return !this.#cachedFeedbackValue

			return this.#cachedFeedbackValue
		} else {
			// An invalid value is falsey, it probably means that the feedback has no value
			return false
		}
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
		const changed: ControlEntityInstance[] = []

		const newValue = newValues.get(this.#data.id)

		let thisChanged = false
		if (
			this.type === EntityModelType.Feedback &&
			this.#data.connectionId === connectionId &&
			newValue &&
			!isInternalUserValueFeedback(this)
		) {
			if (!isEqual(newValue.value, this.#cachedFeedbackValue)) {
				this.#cachedFeedbackValue = newValue.value
				changed.push(this)
				thisChanged = true
			}
		}

		for (const childGroup of this.#transientCopyLists()) {
			changed.push(...childGroup.updateFeedbackValues(connectionId, newValues))
		}

		for (const childGroup of this.#children.values()) {
			const childrenChanged = childGroup.updateFeedbackValues(connectionId, newValues)
			changed.push(...childrenChanged)

			if (!thisChanged && isInternalLogicFeedback(this) && childrenChanged.length > 0) {
				// If this is a logic operator, and one of its children changed, we need to re-evaluate
				changed.push(this)
			}
		}

		return changed
	}

	/**
	 * Update the isInverted values on the control with new calculated isInverted values
	 * @param newValues The new isInverted values
	 */
	updateIsInvertedValues(
		newValues: ReadonlyMap<string, NewSpecialExpressionValue<'isInverted'>>
	): ControlEntityInstance[] {
		const changed: ControlEntityInstance[] = []

		const newValue = newValues.get(this.#data.id)

		let thisChanged = false
		if (this.type === EntityModelType.Feedback && newValue && !isInternalUserValueFeedback(this)) {
			if (newValue.value !== this.#cachedIsInverted) {
				this.#cachedIsInverted = newValue.value
				changed.push(this)
				thisChanged = true
			}
		}

		for (const childGroup of this.#transientCopyLists()) {
			changed.push(...childGroup.updateIsInvertedValues(newValues))
		}

		for (const childGroup of this.#children.values()) {
			const childrenChanged = childGroup.updateIsInvertedValues(newValues)
			changed.push(...childrenChanged)

			if (!thisChanged && isInternalLogicFeedback(this) && childrenChanged.length > 0) {
				// If this is a logic operator, and one of its children changed, we need to re-evaluate
				changed.push(this)
			}
		}

		return changed
	}

	/**
	 * Update the storeResult values on the control with new calculated
	 * storeResult values
	 * @param newValues The updated storeResult values
	 */
	updateStoreResultValues(
		newValues: ReadonlyMap<string, NewSpecialExpressionValue<'storeResult'>>
	): ControlEntityInstance[] {
		const changed: ControlEntityInstance[] = []

		const newValue = newValues.get(this.#data.id)

		if (this.type === EntityModelType.Action && newValue) {
			if (!isEqual(this.#cachedStoreResult, newValue.value)) {
				this.#cachedStoreResult = newValue.value
				changed.push(this)
			}
		}

		for (const childGroup of [...this.#children.values(), ...this.#transientCopyLists()]) {
			const childrenChanged = childGroup.updateStoreResultValues(newValues)
			changed.push(...childrenChanged)
		}

		return changed
	}

	/**
	 * Take the runtime values (feedback value, isInverted and storeResult) of another entity, which is a copy of the
	 * same entity in the same circumstances. This lets a new copy be used straight away, without waiting for them to
	 * be recomputed
	 */
	copyRuntimeValuesFrom(other: ControlEntityInstance): void {
		if (other.type !== this.type || other.definitionId !== this.definitionId) return

		this.#cachedFeedbackValue = other.#cachedFeedbackValue
		this.#cachedIsInverted = other.#cachedIsInverted
		this.#cachedStoreResult = other.#cachedStoreResult
	}

	/**
	 * If this is the user value feedback, set the value
	 * @returns Whether the entity options were changed and need to be persisted
	 */
	setUserValue(value: JsonValue | undefined): boolean {
		if (!isInternalUserValueFeedback(this)) return false

		this.#cachedFeedbackValue = value

		// Persist value if needed
		if (this.#data.options.persist_value?.value) {
			this.#data.options.startup_value = { isExpression: false, value }

			return true
		}

		return false
	}

	getUserValue(): JsonValue | undefined {
		return this.#cachedFeedbackValue
	}

	/**
	 * Get all the connection ids that are enabled
	 */
}

export function isInternalLogicFeedback(entity: ControlEntityInstance): boolean {
	return (
		entity.type === EntityModelType.Feedback &&
		isInternalConnectionId(entity.connectionId) &&
		entity.definitionId.startsWith('logic_')
	)
}

export function isInternalUserValueFeedback(entity: ControlEntityInstance): boolean {
	return libIsInternalUserValueFeedback(entity.asEntityModel(false))
}

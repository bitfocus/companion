import LogController, { Logger } from '../../Log/Controller.js'
import {
	EntityModelType,
	EntitySupportedChildGroupDefinition,
	FeedbackEntityModel,
	FeedbackEntitySubType,
	SomeEntityModel,
	SomeReplaceableEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import { cloneDeep, isEqual } from 'lodash-es'
import { nanoid } from 'nanoid'
import { ControlEntityList } from './EntityList.js'
import type { FeedbackStyleBuilder } from './FeedbackStyleBuilder.js'
import type { ButtonStyleProperties } from '@companion-app/shared/Model/StyleModel.js'
import type { CompanionButtonStyleProps } from '@companion-module/base'
import type { InternalVisitor } from '../../Internal/Types.js'
import { visitEntityModel } from '../../Resources/Visitors/EntityInstanceVisitor.js'
import type { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import type { InstanceDefinitionsForEntity, InternalControllerForEntity, ModuleHostForEntity } from './Types.js'
import { assertNever } from '@companion-app/shared/Util.js'

export class ControlEntityInstance {
	/**
	 * The logger
	 */
	readonly #logger: Logger

	readonly #instanceDefinitions: InstanceDefinitionsForEntity
	readonly #internalModule: InternalControllerForEntity
	readonly #moduleHost: ModuleHostForEntity

	/**
	 * Id of the control this belongs to
	 */
	readonly #controlId: string

	readonly #data: Omit<SomeEntityModel, 'children'>

	/**
	 * Value of the feedback when it was last executed
	 */
	#cachedFeedbackValue: any = undefined

	#children = new Map<string, ControlEntityList>()

	/**
	 * Get the id of this action instance
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
	 * Get the id of the connection this action belongs to
	 */
	get connectionId(): string {
		return this.#data.connectionId
	}

	/**
	 * Get a reference to the options for this action
	 * Note: This must not be a copy, but the raw object
	 */
	get rawOptions(): Record<string, any> {
		return this.#data.options
	}

	get feedbackValue(): any {
		return this.#cachedFeedbackValue
	}

	get localVariableName(): string | null {
		if (this.type !== EntityModelType.Feedback || this.disabled) return null

		const entity = this.#data as FeedbackEntityModel
		if (!entity.variableName) return null

		// Check if the variable name is valid
		const idCheckRegex = /^([a-zA-Z0-9-_.]+)$/
		if (!entity.variableName.match(idCheckRegex)) return null

		return `local:${entity.variableName}`
	}

	get rawLocalVariableName(): string | null {
		if (this.type !== EntityModelType.Feedback || this.disabled) return null

		const entity = this.#data as FeedbackEntityModel
		if (!entity.variableName) return null

		// Check if the variable name is valid
		const idCheckRegex = /^([a-zA-Z0-9-_.]+)$/
		if (!entity.variableName.match(idCheckRegex)) return null

		return entity.variableName
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
		instanceDefinitions: InstanceDefinitionsForEntity,
		internalModule: InternalControllerForEntity,
		moduleHost: ModuleHostForEntity,
		controlId: string,
		data: SomeEntityModel,
		isCloned: boolean
	) {
		this.#logger = LogController.createLogger(`Controls/Fragments/EntityInstance/${controlId}/${data.id}`)

		this.#instanceDefinitions = instanceDefinitions
		this.#internalModule = internalModule
		this.#moduleHost = moduleHost
		this.#controlId = controlId

		{
			const newData = cloneDeep(data)
			delete newData.children
			if (!newData.options) newData.options = {}
			this.#data = newData
		}

		if (isCloned) {
			this.#data.id = nanoid()
		}

		if (data.connectionId === 'internal') {
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
					childGroup.loadStorage(children?.[groupDefinition.groupId] ?? [], true, isCloned)
				} catch (e: any) {
					this.#logger.error(`Error loading child entity group: ${e.message}`)
				}
			}
		}

		this.#cachedFeedbackValue = this.#getStartupValue()
	}

	#getOrCreateChildGroupFromDefinition(listDefinition: EntitySupportedChildGroupDefinition): ControlEntityList {
		const existing = this.#children.get(listDefinition.groupId)
		if (existing) return existing

		const childGroup = new ControlEntityList(
			this.#instanceDefinitions,
			this.#internalModule,
			this.#moduleHost,
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
		if (this.connectionId !== 'internal') return []

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
		// Inform relevant module
		if (this.#data.connectionId === 'internal') {
			this.#internalModule.entityDelete(this.asEntityModel())
		} else {
			this.#moduleHost.connectionEntityDelete(this.asEntityModel(), this.#controlId).catch((e) => {
				this.#logger.silly(`entityDelete to connection "${this.connectionId}" failed: ${e.message} ${e.stack}`)
			})
		}

		// Remove from cached feedback values
		this.#cachedFeedbackValue = undefined

		for (const childGroup of this.#children.values()) {
			childGroup.cleanup()
		}
	}

	/**
	 * Inform the instance of an updated entity
	 * @param recursive whether to call recursively
	 * @param onlyType If set, only re-subscribe entities of this type
	 * @param onlyConnectionId If set, only re-subscribe entities for this connection
	 */
	subscribe(recursive: boolean, onlyType?: EntityModelType, onlyConnectionId?: string): void {
		if (
			!this.#data.disabled &&
			(!onlyConnectionId || this.#data.connectionId === onlyConnectionId) &&
			(!onlyType || this.#data.type === onlyType)
		) {
			if (this.#data.connectionId === 'internal') {
				this.#internalModule.entityUpdate(this.asEntityModel(), this.#controlId)
			} else {
				this.#moduleHost.connectionEntityUpdate(this.asEntityModel(), this.#controlId).catch((e) => {
					this.#logger.silly(`entityUpdate to connection "${this.connectionId}" failed: ${e.message} ${e.stack}`)
				})
			}
		}

		if (recursive) {
			for (const childGroup of this.#children.values()) {
				childGroup.subscribe(recursive, onlyType, onlyConnectionId)
			}
		}
	}

	#getStartupValue(): any {
		if (!isInternalUserValueFeedback(this)) return undefined

		return this.#data.options.startup_value
	}

	/**
	 * Set whether this entity is enabled
	 */
	setEnabled(enabled: boolean): void {
		this.#data.disabled = !enabled

		// Remove from cached feedback values
		this.#cachedFeedbackValue = this.#getStartupValue()

		// Inform relevant module
		if (!this.#data.disabled) {
			this.subscribe(true)
		} else {
			this.cleanup()
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
	setConnectionId(connectionId: string | number): void {
		// TODO - why can this be a number?
		connectionId = String(connectionId)

		// first unsubscribe action from old connection
		this.cleanup()
		// next change connectionId
		this.#data.connectionId = connectionId
		// last subscribe to new connection
		this.subscribe(false)
	}

	/**
	 * Set whether this feedback is inverted
	 */
	setInverted(isInverted: boolean): void {
		if (this.#data.type !== EntityModelType.Feedback) return

		const thisData = this.#data as FeedbackEntityModel

		// TODO - verify this is a boolean feedback

		thisData.isInverted = isInverted

		// Don't need to resubscribe
		// Don't need to clear cached value
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
	setOptions(options: Record<string, any>): void {
		this.#data.options = options

		// Remove from cached feedback values
		if (this.#getStartupValue() === undefined) {
			this.#cachedFeedbackValue = undefined
		}

		// Inform relevant module
		this.subscribe(false)
	}

	/**
	 * Learn the options for an entity, by asking the connection for the current values
	 */
	async learnOptions(): Promise<boolean> {
		const newOptions = await this.#moduleHost.connectionEntityLearnOptions(this.asEntityModel(), this.#controlId)
		if (newOptions) {
			this.setOptions(newOptions)

			return true
		}

		return false
	}

	/**
	 * Set an option for this entity
	 */
	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	setOption(key: string, value: any): void {
		this.#data.options[key] = value

		// Remove from cached feedback values
		if (this.#getStartupValue() === undefined) {
			this.#cachedFeedbackValue = undefined
		}

		// Inform relevant module
		this.subscribe(false)
	}

	getEntityDefinition(): ClientEntityDefinition | undefined {
		return this.#instanceDefinitions.getEntityDefinition(
			this.#data.type,
			this.#data.connectionId,
			this.#data.definitionId
		)
	}

	/**
	 * Update an style property for a boolean feedback
	 * @param key the key/name of the property
	 * @param value the new value
	 * @returns success
	 */
	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	setStyleValue(key: string, value: any): boolean {
		if (this.#data.type !== EntityModelType.Feedback) return false

		const feedbackData = this.#data as FeedbackEntityModel

		if (key === 'png64' && value !== null) {
			if (!value.match(/data:.*?image\/png/)) {
				return false
			}

			value = value.replace(/^.*base64,/, '')
		}

		const definition = this.getEntityDefinition()
		if (
			!definition ||
			definition.entityType !== EntityModelType.Feedback ||
			definition.feedbackType !== FeedbackEntitySubType.Boolean
		)
			return false

		if (!feedbackData.style) feedbackData.style = {}
		feedbackData.style[key as keyof ButtonStyleProperties] = value

		return true
	}

	/**
	 * Update the selected style properties for a boolean feedback
	 * @param selected the properties to be selected
	 * @param baseStyle Style of the button without feedbacks applied
	 * @returns success
	 * @access public
	 */
	setStyleSelection(selected: string[], baseStyle: ButtonStyleProperties): boolean {
		if (this.#data.type !== EntityModelType.Feedback) return false

		const feedbackData = this.#data as FeedbackEntityModel

		const definition = this.getEntityDefinition()
		if (
			!definition ||
			definition.entityType !== EntityModelType.Feedback ||
			definition.feedbackType !== FeedbackEntitySubType.Boolean
		)
			return false

		const defaultStyle: Partial<CompanionButtonStyleProps> = definition.feedbackStyle || {}
		const oldStyle: Record<string, any> = feedbackData.style || {}
		const newStyle: Record<string, any> = {}

		for (const key0 of selected) {
			const key = key0 as keyof ButtonStyleProperties
			if (key in oldStyle) {
				// preserve existing value
				newStyle[key] = oldStyle[key]
			} else {
				// copy button value as a default
				newStyle[key] = defaultStyle[key] !== undefined ? defaultStyle[key] : baseStyle[key]

				// png needs to be set to something harmless
				if (key === 'png64' && !newStyle[key]) {
					newStyle[key] = null
				}
			}

			if (key === 'text') {
				// also preserve textExpression
				newStyle['textExpression'] =
					oldStyle['textExpression'] ??
					/*defaultStyle['textExpression'] !== undefined
									? defaultStyle['textExpression']
									: */ baseStyle['textExpression']
			}
		}
		feedbackData.style = newStyle

		return true
	}

	/**
	 * Find a child entity by id
	 */
	findChildById(id: string): ControlEntityInstance | undefined {
		for (const childGroup of this.#children.values()) {
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
		if (this.connectionId !== 'internal') return []

		const entities: ControlEntityInstance[] = []

		for (const childGroup of this.#children.values()) {
			entities.push(...childGroup.getAllEntities())
		}

		return entities
	}

	/**
	 * Recursively get all the child entities
	 */
	getChildren(groupId: string): ControlEntityList | undefined {
		if (this.connectionId !== 'internal') return undefined

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
	 * Prune all entities referencing unknown conncetions
	 * Doesn't do any cleanup, as it is assumed that the connection has not been running
	 */
	verifyChildConnectionIds(knownConnectionIds: Set<string>): boolean {
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

		if (this.#data.type === EntityModelType.Feedback) {
			const feedbackData = this.#data as FeedbackEntityModel
			const newPropsData = newProps as FeedbackEntityModel
			feedbackData.isInverted = !!newPropsData.isInverted
			feedbackData.style = Object.keys(feedbackData.style || {}).length > 0 ? feedbackData.style : newPropsData.style
		}

		delete this.#data.upgradeIndex

		if (!skipNotifyModule) {
			this.subscribe(false)
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

		if (deep && this.connectionId === 'internal') {
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

			changed = true
		}

		for (const childGroup of this.#children.values()) {
			if (childGroup.clearCachedValueForConnectionId(connectionId)) {
				changed = true
			}
		}

		return changed
	}

	/**
	 * Get the value of this feedback as a boolean
	 */
	getBooleanFeedbackValue(): boolean {
		if (this.#data.disabled) return false

		if (this.#data.type !== EntityModelType.Feedback) return false

		const definition = this.getEntityDefinition()

		// Special case to handle the internal 'logic' operators, which need to be executed live
		if (isInternalLogicFeedback(this)) {
			// Future: This could probably be made a bit more generic by checking `definition.supportsChildFeedbacks`
			const childGroup = this.#children.get('default') || this.#children.get('children')
			const childValues = childGroup?.getChildBooleanFeedbackValues() ?? []

			return this.#internalModule.executeLogicFeedback(this.asEntityModel() as FeedbackEntityModel, childValues)
		}

		if (
			!definition ||
			definition.entityType !== EntityModelType.Feedback ||
			definition.feedbackType !== FeedbackEntitySubType.Boolean
		)
			return false

		if (typeof this.#cachedFeedbackValue === 'boolean') {
			const feedbackData = this.#data as FeedbackEntityModel
			if (definition.showInvert && feedbackData.isInverted) return !this.#cachedFeedbackValue

			return this.#cachedFeedbackValue
		} else {
			// An invalid value is falsey, it probably means that the feedback has no value
			return false
		}
	}

	/**
	 * Apply the unparsed style for the feedbacks
	 * Note: Does not clone the style
	 */
	buildFeedbackStyle(styleBuilder: FeedbackStyleBuilder): void {
		if (this.disabled) return

		const feedback = this.#data as FeedbackEntityModel
		if (feedback.type !== EntityModelType.Feedback) return

		const definition = this.getEntityDefinition()
		if (!definition || definition.entityType !== EntityModelType.Feedback) return

		switch (definition.feedbackType) {
			case FeedbackEntitySubType.Boolean:
				if (this.getBooleanFeedbackValue()) styleBuilder.applySimpleStyle(feedback.style)
				break
			case FeedbackEntitySubType.Advanced:
				// Special case to handle the internal 'logic' operators, which need to be done differently
				if (this.connectionId === 'internal' && this.definitionId === 'logic_conditionalise_advanced') {
					if (this.getBooleanFeedbackValue()) {
						for (const child of this.#children.get('feedbacks')?.getDirectEntities() || []) {
							child.buildFeedbackStyle(styleBuilder)
						}
					}
				} else {
					styleBuilder.applyComplexStyle(this.#cachedFeedbackValue)
				}
				break
			case FeedbackEntitySubType.Value:
				// Not valid for building a style
				break
			case null:
				// Not a valid feedback
				break
			default:
				assertNever(definition.feedbackType)
				break
		}
	}

	/**
	 * Update the feedbacks on the button with new values
	 * @param connectionId The instance the feedbacks are for
	 * @param newValues The new feedback values
	 */
	updateFeedbackValues(connectionId: string, newValues: Record<string, any>): ControlEntityInstance[] {
		const changed: ControlEntityInstance[] = []

		let thisChanged = false
		if (
			this.type === EntityModelType.Feedback &&
			this.#data.connectionId === connectionId &&
			this.#data.id in newValues &&
			!isInternalUserValueFeedback(this)
		) {
			const newValue = newValues[this.#data.id]
			if (!isEqual(newValue, this.#cachedFeedbackValue)) {
				this.#cachedFeedbackValue = newValue
				changed.push(this)
				thisChanged = true
			}
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
	 * If this is the user value feedback, set the value
	 */
	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	setUserValue(value: any): void {
		if (!isInternalUserValueFeedback(this)) return

		this.#cachedFeedbackValue = value
	}

	getUserValue(): any {
		return this.#cachedFeedbackValue
	}

	/**
	 * Get all the connection ids that are enabled
	 */
	getAllEnabledConnectionIds(connectionIds: Set<string>): void {
		if (this.disabled) return

		connectionIds.add(this.connectionId)

		for (const childGroup of this.#children.values()) {
			childGroup.getAllEnabledConnectionIds(connectionIds)
		}
	}
}

export function isInternalLogicFeedback(entity: ControlEntityInstance): boolean {
	return (
		entity.type === EntityModelType.Feedback &&
		entity.connectionId === 'internal' &&
		entity.definitionId.startsWith('logic_')
	)
}

export function isInternalUserValueFeedback(entity: ControlEntityInstance): boolean {
	return (
		entity.type === EntityModelType.Feedback &&
		entity.connectionId === 'internal' &&
		entity.definitionId === 'user_value'
	)
}

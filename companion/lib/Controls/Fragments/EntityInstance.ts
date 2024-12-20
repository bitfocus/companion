import type { InstanceDefinitions } from '../../Instance/Definitions.js'
import LogController, { Logger } from '../../Log/Controller.js'
import type { InternalController } from '../../Internal/Controller.js'
import type { ModuleHost } from '../../Instance/Host.js'
import {
	EntityModelType,
	EntitySupportedChildGroupDefinition,
	FeedbackEntityModel,
	SomeEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import { cloneDeep, isEqual } from 'lodash-es'
import { nanoid } from 'nanoid'
import { assertNever } from '@companion-app/shared/Util.js'
import { ControlEntityList } from './EntityList.js'
import type { FeedbackStyleBuilder } from './FeedbackStyleBuilder.js'
import type { ButtonStyleProperties } from '@companion-app/shared/Model/StyleModel.js'
import type { CompanionButtonStyleProps } from '@companion-module/base'
import type { InternalVisitor } from '../../Internal/Types.js'
import { visitEntityModel } from '../../Resources/Visitors/FeedbackInstanceVisitor.js'

export class ControlEntityInstance {
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

	readonly #data: Omit<SomeEntityModel, 'children'>

	/**
	 * Value of the feedback when it was last executed
	 */
	#cachedValue: any = undefined

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
		data: SomeEntityModel,
		isCloned: boolean
	) {
		this.#logger = LogController.createLogger(`Controls/Fragments/EntityInstance/${controlId}/${data.id}`)

		this.#instanceDefinitions = instanceDefinitions
		this.#internalModule = internalModule
		this.#moduleHost = moduleHost
		this.#controlId = controlId

		this.#data = cloneDeep(data) // TODO - cleanup unwanted properties
		if (!this.#data.options) this.#data.options = {}

		if (isCloned) {
			this.#data.id = nanoid()
		}

		if (data.connectionId === 'internal') {
			const supportedChildGroups = this.getSupportedChildGroupDefinitions()
			for (const groupDefinition of supportedChildGroups) {
				try {
					const childGroup = this.#getOrCreateChildGroup(groupDefinition.groupId)
					childGroup.loadStorage(data.children?.[groupDefinition.groupId] ?? [], true, isCloned)
				} catch (e: any) {
					this.#logger.error(`Error loading child entity group: ${e.message}`)
				}
			}
		}
	}

	#getOrCreateChildGroup(groupId: string): ControlEntityList {
		const existing = this.#children.get(groupId)
		if (existing) return existing

		// Check what names are allowed
		const supportedChildGroups = this.getSupportedChildGroupDefinitions()
		const listDefinition = supportedChildGroups.find((g) => g.groupId === groupId)
		if (!listDefinition) throw new Error('Entity cannot accept children in this group.')

		const childGroup = new ControlEntityList(
			this.#instanceDefinitions,
			this.#internalModule,
			this.#moduleHost,
			this.#controlId,
			{ parentId: this.id, childGroup: groupId },
			listDefinition
		)
		this.#children.set(groupId, childGroup)

		return childGroup
	}

	getSupportedChildGroupDefinitions(): EntitySupportedChildGroupDefinition[] {
		if (this.connectionId !== 'internal') return []

		switch (this.#data.type) {
			case EntityModelType.Action: {
				const actionDefinition = this.#instanceDefinitions.getActionDefinition(
					this.#data.connectionId,
					this.#data.definitionId
				)
				return actionDefinition?.supportsChildGroups ?? []
			}
			case EntityModelType.Feedback: {
				const feedbackDefinition = this.#instanceDefinitions.getActionDefinition(
					this.#data.connectionId,
					this.#data.definitionId
				)
				return feedbackDefinition?.supportsChildGroups ?? []
			}
			default:
				assertNever(this.#data.type)
				return []
		}
	}

	/**
	 * Inform the instance of a removed entity
	 */
	cleanup() {
		// Inform relevant module
		const connection = this.#moduleHost.getChild(this.#data.connectionId, true)
		if (connection) {
			// nocommit - implement this
			// connection.feedbackDelete(this.asFeedbackInstance()).catch((e) => {
			// connection.actionDelete(this.asActionInstance()).catch((e) => {
			// 	this.#logger.silly(`action_delete to connection failed: ${e.message}`)
			// })
		}

		// Remove from cached feedback values
		this.#cachedValue = undefined

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
		if (this.#data.disabled) return

		if (
			(!onlyConnectionId || this.#data.connectionId === onlyConnectionId) &&
			(!onlyType || this.#data.type === onlyType)
		) {
			if (this.#data.connectionId === 'internal') {
				// nocommit - implement this
				// this.#internalModule.actionUpdate(this.asActionInstance(), this.#controlId)
			} else {
				const connection = this.#moduleHost.getChild(this.#data.connectionId, true)
				if (connection) {
					// nocommit - implement this
					// connection.actionUpdate(this.asActionInstance(), this.#controlId).catch((e) => {
					// 	this.#logger.silly(`action_update to connection failed: ${e.message} ${e.stack}`)
					// })
				}
			}
		}

		if (recursive) {
			for (const childGroup of this.#children.values()) {
				childGroup.subscribe(recursive, onlyType, onlyConnectionId)
			}
		}
	}

	/**
	 * Set whether this entity is enabled
	 */
	setEnabled(enabled: boolean): void {
		this.#data.disabled = !enabled

		// Remove from cached feedback values
		this.#cachedValue = undefined

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

		// TODO - verify this is a boolean feedback

		this.#data.isInverted = isInverted

		// Don't need to resubscribe
		// Don't need to clear cached value
	}

	/**
	 * Set the options for this entity
	 */
	setOptions(options: Record<string, any>): void {
		this.#data.options = options

		// Remove from cached feedback values
		this.#cachedValue = undefined

		// Inform relevant module
		this.subscribe(false)
	}

	/**
	 * Learn the options for an entity, by asking the connection for the current values
	 */
	async learnOptions(): Promise<boolean> {
		const connection = this.#moduleHost.getChild(this.connectionId)
		if (!connection) return false

		// nocommit - implement this
		// const newOptions = await instance.feedbackLearnValues(this.asFeedbackInstance(), this.#controlId)
		// const newOptions = await connection.actionLearnValues(this.asActionInstance(), this.#controlId)
		// if (newOptions) {
		// 	this.setOptions(newOptions)

		// 	return true
		// }

		return false
	}

	/**
	 * Set an option for this entity
	 */
	setOption(key: string, value: any): void {
		this.#data.options[key] = value

		// Remove from cached feedback values
		this.#cachedValue = undefined

		// Inform relevant module
		this.subscribe(false)
	}

	/**
	 * Update an style property for a boolean feedback
	 * @param key the key/name of the property
	 * @param value the new value
	 * @returns success
	 */
	setStyleValue(key: string, value: any): boolean {
		if (this.#data.type !== EntityModelType.Feedback) return false

		if (key === 'png64' && value !== null) {
			if (!value.match(/data:.*?image\/png/)) {
				return false
			}

			value = value.replace(/^.*base64,/, '')
		}

		const definition = this.getDefinition()
		if (!definition || definition.type !== 'boolean') return false

		if (!this.#data.style) this.#data.style = {}
		// @ts-ignore
		this.#data.style[key] = value

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

		const definition = this.getDefinition()
		if (!definition || definition.type !== 'boolean') return false

		const defaultStyle: Partial<CompanionButtonStyleProps> = definition.style || {}
		const oldStyle: Record<string, any> = this.#data.style || {}
		const newStyle: Record<string, any> = {}

		for (const key of selected) {
			if (key in oldStyle) {
				// preserve existing value
				newStyle[key] = oldStyle[key]
			} else {
				// copy button value as a default
				// @ts-ignore
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
		this.#data.style = newStyle

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
	removeChild(id: string): boolean {
		for (const childGroup of this.#children.values()) {
			if (childGroup.removeEntity(id)) return true
		}
		return false
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

		const actions: ControlEntityInstance[] = []

		for (const childGroup of this.#children.values()) {
			actions.push(...childGroup.getAllEntities())
		}

		return actions
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
	 * If this control was imported to a running system, do some data cleanup/validation
	 */
	postProcessImport(): Promise<void>[] {
		const ps: Promise<void>[] = []

		if (this.#data.connectionId === 'internal') {
			// nocommit - implement this
			// const newProps = this.#internalModule.feedbackUpgrade(this.asFeedbackInstance(), this.#controlId)
			// const newProps = this.#internalModule.actionUpgrade(this.asActionInstance(), this.#controlId)
			// if (newProps) {
			// 	this.replaceProps(newProps, false)
			// }
			// setImmediate(() => {
			// 	this.#internalModule.actionUpdate(this.asActionInstance(), this.#controlId)
			// this.#internalModule.feedbackUpdate(this.asFeedbackInstance(), this.#controlId)
			// })
		} else {
			// nocommit - implement this
			// const instance = this.#moduleHost.getChild(this.connectionId, true)
			// if (instance) {
			// 	ps.push(instance.actionUpdate(this.asActionInstance(), this.#controlId))
			// ps.push(instance.feedbackUpdate(this.asFeedbackInstance(), this.#controlId))
			// }
		}

		for (const childGroup of this.#children.values()) {
			ps.push(...childGroup.postProcessImport())
		}

		return ps
	}

	// /**
	//  * Replace portions of the action with an updated version
	//  */
	// replaceProps(newProps: Pick<ActionInstance, 'action' | 'options'>, skipNotifyModule = false): void {
	// 	this.#data.action = newProps.action // || newProps.actionId
	// 	this.#data.options = newProps.options

	// 	delete this.#data.upgradeIndex

	// 	if (!skipNotifyModule) {
	// 		this.subscribe(false)
	// 	}
	// }

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
			this.#cachedValue = undefined

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

		const definition = this.getDefinition()

		// Special case to handle the internal 'logic' operators, which need to be executed live
		if (this.connectionId === 'internal' && this.#data.type.startsWith('logic_')) {
			// Future: This could probably be made a bit more generic by checking `definition.supportsChildFeedbacks`
			const childValues = this.#children.get('children')?.getChildBooleanFeedbackValues() ?? []

			return this.#internalModule.executeLogicFeedback(this.asFeedbackInstance(), childValues)
		}

		if (!definition || definition.type !== 'boolean') return false

		if (typeof this.#cachedValue === 'boolean') {
			const feedbackData = this.#data as FeedbackEntityModel
			if (definition.showInvert && feedbackData.isInverted) return !this.#cachedValue

			return this.#cachedValue
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

		const definition = this.getDefinition()
		if (definition?.type === 'boolean') {
			if (this.getBooleanFeedbackValue()) styleBuilder.applySimpleStyle(feedback.style)
		} else if (definition?.type === 'advanced') {
			if (this.connectionId === 'internal' && this.definitionId === 'logic_conditionalise_advanced') {
				if (this.getBooleanFeedbackValue()) {
					for (const child of feedback.getChildrenOfGroup('advancedChildren')) {
						styleBuilder.applyComplexStyle(child.cachedValue)
					}
				}
			} else {
				styleBuilder.applyComplexStyle(this.#cachedValue)
			}
		}
	}

	/**
	 * Set the cached value of this feedback
	 */
	setCachedValue(value: any): boolean {
		if (!isEqual(value, this.#cachedValue)) {
			this.#cachedValue = value
			return true
		} else {
			return false
		}
	}

	/**
	 * Update the feedbacks on the button with new values
	 * @param connectionId The instance the feedbacks are for
	 * @param newValues The new feedback values
	 */
	updateFeedbackValues(connectionId: string, newValues: Record<string, any>): boolean {
		let changed = false

		if (this.#data.connectionId === connectionId && this.#data.id in newValues) {
			if (this.setCachedValue(newValues[this.#data.id])) changed = true
		}

		for (const childGroup of this.#children.values()) {
			if (childGroup.updateFeedbackValues(connectionId, newValues)) changed = true
		}

		return changed
	}
}

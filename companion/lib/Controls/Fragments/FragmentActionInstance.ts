import { cloneDeep } from 'lodash-es'
import { nanoid } from 'nanoid'
import LogController, { Logger } from '../../Log/Controller.js'
import { FragmentActionList } from './FragmentActionList.js'
import type { InstanceDefinitions } from '../../Instance/Definitions.js'
import type { InternalController } from '../../Internal/Controller.js'
import type { ModuleHost } from '../../Instance/Host.js'
import type { InternalVisitor } from '../../Internal/Types.js'
import type { ActionDefinition } from '@companion-app/shared/Model/ActionDefinitionModel.js'
import type { ActionInstance } from '@companion-app/shared/Model/ActionModel.js'
import { visitActionInstance } from '../../Resources/Visitors/ActionInstanceVisitor.js'

export class FragmentActionInstance {
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

	readonly #data: Omit<ActionInstance, 'children'>

	#children = new Map<string, FragmentActionList>()

	/**
	 * Get the id of this action instance
	 */
	get id(): string {
		return this.#data.id
	}

	get disabled(): boolean {
		return !!this.#data.disabled
	}

	/**
	 * Get the id of the connection this action belongs to
	 */
	get connectionId(): string {
		return this.#data.instance
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
		data: ActionInstance,
		isCloned: boolean
	) {
		this.#logger = LogController.createLogger(`Controls/Fragments/Actions/${controlId}`)

		this.#instanceDefinitions = instanceDefinitions
		this.#internalModule = internalModule
		this.#moduleHost = moduleHost
		this.#controlId = controlId

		this.#data = cloneDeep(data) // TODO - cleanup unwanted properties
		if (!this.#data.options) this.#data.options = {}

		if (isCloned) {
			this.#data.id = nanoid()
		}

		if (data.instance === 'internal' && data.children) {
			for (const [groupId, actions] of Object.entries(data.children)) {
				if (!actions) continue

				try {
					const childGroup = this.#getOrCreateActionGroup(groupId)
					childGroup.loadStorage(actions, true, isCloned)
				} catch (e: any) {
					this.#logger.error(`Error loading child action group: ${e.message}`)
				}
			}
		}
	}

	#getOrCreateActionGroup(groupId: string): FragmentActionList {
		const existing = this.#children.get(groupId)
		if (existing) return existing

		// Check what names are allowed
		const definition = this.connectionId === 'internal' && this.getDefinition()
		if (!definition) throw new Error('Action cannot accept children.')

		if (!definition.supportsChildActionGroups.includes(groupId)) {
			throw new Error('Action cannot accept children in this group.')
		}

		const childGroup = new FragmentActionList(
			this.#instanceDefinitions,
			this.#internalModule,
			this.#moduleHost,
			this.#controlId,
			{ parentActionId: this.id, childGroup: groupId }
		)
		this.#children.set(groupId, childGroup)

		return childGroup
	}

	/**
	 * Get this action as a `ActionInstance`
	 */
	asActionInstance(): ActionInstance {
		const actionInstance: ActionInstance = { ...this.#data }

		if (this.connectionId === 'internal') {
			actionInstance.children = {}

			for (const [groupId, actionGroup] of this.#children) {
				actionInstance.children[groupId] = actionGroup.asActionInstances()
			}
		}

		return actionInstance
	}

	/**
	 * Get the definition for this action
	 */
	getDefinition(): ActionDefinition | undefined {
		return this.#instanceDefinitions.getActionDefinition(this.#data.instance, this.#data.action)
	}

	/**
	 * Inform the instance of a removed action
	 */
	cleanup() {
		// Inform relevant module
		const connection = this.#moduleHost.getChild(this.#data.instance, true)
		if (connection) {
			connection.actionDelete(this.asActionInstance()).catch((e) => {
				this.#logger.silly(`action_delete to connection failed: ${e.message}`)
			})
		}

		for (const actionGroup of this.#children.values()) {
			actionGroup.cleanup()
		}
	}

	/**
	 * Inform the instance of an updated action
	 * @param recursive whether to call recursively
	 * @param onlyConnectionId If set, only subscribe actions for this connection
	 */
	subscribe(recursive: boolean, onlyConnectionId?: string): void {
		if (this.#data.disabled) return

		if (!onlyConnectionId || this.#data.instance === onlyConnectionId) {
			if (this.#data.instance === 'internal') {
				// this.#internalModule.actionUpdate(this.asActionInstance(), this.#controlId)
			} else {
				const connection = this.#moduleHost.getChild(this.#data.instance, true)
				if (connection) {
					connection.actionUpdate(this.asActionInstance(), this.#controlId).catch((e) => {
						this.#logger.silly(`action_update to connection failed: ${e.message} ${e.stack}`)
					})
				}
			}
		}

		if (recursive) {
			for (const actionGroup of this.#children.values()) {
				actionGroup.subscribe(recursive, onlyConnectionId)
			}
		}
	}

	/**
	 * Find a child action by id
	 */
	findChildById(id: string): FragmentActionInstance | undefined {
		for (const actionGroup of this.#children.values()) {
			const result = actionGroup.findById(id)
			if (result) return result
		}
		return undefined
	}

	/**
	 * Find the index of a child action, and the parent list
	 */
	findParentAndIndex(
		id: string
	): { parent: FragmentActionList; index: number; item: FragmentActionInstance } | undefined {
		for (const actionGroup of this.#children.values()) {
			const result = actionGroup.findParentAndIndex(id)
			if (result) return result
		}
		return undefined
	}

	/**
	 * Add a child action to this action
	 */
	addChild(groupId: string, action: ActionInstance): FragmentActionInstance {
		if (this.connectionId !== 'internal') {
			throw new Error('Only internal actions can have children')
		}

		const actionGroup = this.#getOrCreateActionGroup(groupId)
		return actionGroup.addAction(action)
	}

	/**
	 * Push a child action to the list
	 * Note: this is used when moving a action from a different parent. Lifecycle is not managed
	 */
	pushChild(action: FragmentActionInstance, groupId: string, index: number): void {
		const actionGroup = this.#getOrCreateActionGroup(groupId)
		return actionGroup.pushAction(action, index)
	}

	/**
	 * Check if this list can accept a specified child
	 */
	canAcceptChild(groupId: string, action: FragmentActionInstance): boolean {
		const actionGroup = this.#getOrCreateActionGroup(groupId)
		return actionGroup.canAcceptAction(action)
	}

	/**
	 * Recursively get all the actions
	 */
	getAllChildren(): FragmentActionInstance[] {
		const actions: FragmentActionInstance[] = []

		for (const actionGroup of this.#children.values()) {
			actions.push(...actionGroup.getAllActions())
		}

		return actions
	}

	/**
	 * Replace portions of the action with an updated version
	 */
	replaceProps(newProps: Pick<ActionInstance, 'action' | 'options'>, skipNotifyModule = false): void {
		this.#data.action = newProps.action // || newProps.actionId
		this.#data.options = newProps.options

		delete this.#data.upgradeIndex

		if (!skipNotifyModule) {
			this.subscribe(false)
		}
	}

	/**
	 * Visit any references in the current action
	 */
	visitReferences(visitor: InternalVisitor): void {
		visitActionInstance(visitor, this.#data)
	}
}

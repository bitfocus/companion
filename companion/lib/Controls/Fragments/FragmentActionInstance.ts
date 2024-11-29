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

	#children: FragmentActionList

	/**
	 * Get the id of this action instance
	 */
	get id(): string {
		return this.#data.id
	}

	get disabled(): boolean {
		return !!this.#data.disabled
	}

	get delay(): number {
		if (isNaN(this.#data.delay) || this.#data.delay < 0) return 0
		return this.#data.delay || 0
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

		this.#children = new FragmentActionList(
			this.#instanceDefinitions,
			this.#internalModule,
			this.#moduleHost,
			this.#controlId,
			this.id
		)
		if (data.instance === 'internal' && data.children) {
			this.#children.loadStorage(data.children, true, isCloned)
		}
	}

	/**
	 * Get this action as a `ActionInstance`
	 */
	asActionInstance(): ActionInstance {
		return {
			...this.#data,
			children: this.connectionId === 'internal' ? this.#children.asActionInstances() : undefined,
		}
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

		this.#children.cleanup()
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
			this.#children.subscribe(recursive, onlyConnectionId)
		}
	}

	/**
	 * Set whether this action is enabled
	 */
	setEnabled(enabled: boolean): void {
		this.#data.disabled = !enabled

		// Inform relevant module
		if (!this.#data.disabled) {
			this.subscribe(true)
		} else {
			this.cleanup()
		}
	}

	/**
	 * Set the headline for this action
	 */
	setHeadline(headline: string): void {
		this.#data.headline = headline

		// Don't need to resubscribe
	}

	/**
	 * Set the connection instance of this action
	 */
	setInstance(instanceId: string | number): void {
		const instance = `${instanceId}`

		// first unsubscribe action from old instance
		this.cleanup()
		// next change instance
		this.#data.instance = instance
		// last subscribe to new instance
		this.subscribe(true, instance)
	}

	/**
	 * Set the delay of the action
	 */
	setDelay(delay: number): void {
		delay = Number(delay)
		if (isNaN(delay)) delay = 0

		this.#data.delay = delay

		// Don't need to resubscribe
	}

	/**
	 * Set the options for this action
	 */
	setOptions(options: Record<string, any>): void {
		this.#data.options = options

		// Inform relevant module
		this.subscribe(false)
	}

	/**
	 * Learn the options for a action, by asking the instance for the current values
	 */
	async learnOptions(): Promise<boolean> {
		const instance = this.#moduleHost.getChild(this.connectionId)
		if (!instance) return false

		const newOptions = await instance.actionLearnValues(this.asActionInstance(), this.#controlId)
		if (newOptions) {
			this.setOptions(newOptions)

			return true
		}

		return false
	}

	/**
	 * Set an option for this action
	 */
	setOption(key: string, value: any): void {
		this.#data.options[key] = value

		// Inform relevant module
		this.subscribe(false)
	}

	/**
	 * Find a child action by id
	 */
	findChildById(id: string): FragmentActionInstance | undefined {
		return this.#children.findById(id)
	}

	/**
	 * Find the index of a child action, and the parent list
	 */
	findParentAndIndex(
		id: string
	): { parent: FragmentActionList; index: number; item: FragmentActionInstance } | undefined {
		return this.#children.findParentAndIndex(id)
	}

	/**
	 * Add a child action to this action
	 */
	addChild(action: ActionInstance): FragmentActionInstance {
		if (this.connectionId !== 'internal') {
			throw new Error('Only internal actions can have children')
		}

		return this.#children.addAction(action)
	}

	/**
	 * Remove a child action
	 */
	removeChild(id: string): boolean {
		return this.#children.removeAction(id)
	}

	/**
	 * Duplicate a child action
	 */
	duplicateChild(id: string): FragmentActionInstance | undefined {
		return this.#children.duplicateAction(id)
	}

	/**
	 * Reorder a action in the list
	 */
	moveChild(oldIndex: number, newIndex: number): void {
		return this.#children.moveAction(oldIndex, newIndex)
	}

	/**
	 * Pop a child action from the list
	 * Note: this is used when moving a action to a different parent. Lifecycle is not managed
	 */
	popChild(index: number): FragmentActionInstance | undefined {
		return this.#children.popAction(index)
	}

	/**
	 * Push a child action to the list
	 * Note: this is used when moving a action from a different parent. Lifecycle is not managed
	 */
	pushChild(action: FragmentActionInstance, index: number): void {
		return this.#children.pushAction(action, index)
	}

	/**
	 * Check if this list can accept a specified child
	 */
	canAcceptChild(action: FragmentActionInstance): boolean {
		return this.#children.canAcceptAction(action)
	}

	/**
	 * Recursively get all the actions
	 */
	getAllChildren(): FragmentActionInstance[] {
		return this.#children.getAllActions()
	}

	/**
	 * Cleanup and forget any children belonging to the given connection
	 */
	forgetChildrenForConnection(connectionId: string): boolean {
		return this.#children.forgetForConnection(connectionId)
	}

	/**
	 * Prune all actions/feedbacks referencing unknown conncetions
	 * Doesn't do any cleanup, as it is assumed that the connection has not been running
	 */
	verifyChildConnectionIds(knownConnectionIds: Set<string>): boolean {
		return this.#children.verifyConnectionIds(knownConnectionIds)
	}

	/**
	 * If this control was imported to a running system, do some data cleanup/validation
	 */
	postProcessImport(): Promise<void>[] {
		const ps: Promise<void>[] = []

		if (this.#data.instance === 'internal') {
			const newProps = this.#internalModule.actionUpgrade(this.asActionInstance(), this.#controlId)
			if (newProps) {
				this.replaceProps(newProps, false)
			}

			// setImmediate(() => {
			// 	this.#internalModule.actionUpdate(this.asActionInstance(), this.#controlId)
			// })
		} else {
			const instance = this.#moduleHost.getChild(this.connectionId, true)
			if (instance) {
				ps.push(instance.actionUpdate(this.asActionInstance(), this.#controlId))
			}
		}

		ps.push(...this.#children.postProcessImport())

		return ps
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

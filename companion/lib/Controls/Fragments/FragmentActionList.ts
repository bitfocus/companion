import { FragmentActionInstance } from './FragmentActionInstance.js'
import { clamp } from '../../Resources/Util.js'
import type { InstanceDefinitions } from '../../Instance/Definitions.js'
import type { InternalController } from '../../Internal/Controller.js'
import type { ModuleHost } from '../../Instance/Host.js'
import type { ActionInstance } from '@companion-app/shared/Model/ActionModel.js'

export class FragmentActionList {
	readonly #instanceDefinitions: InstanceDefinitions
	readonly #internalModule: InternalController
	readonly #moduleHost: ModuleHost

	/**
	 * Id of the control this belongs to
	 */
	readonly #controlId: string

	readonly #id: string | null

	#actions: FragmentActionInstance[] = []

	get id(): string | null {
		return this.#id
	}

	constructor(
		instanceDefinitions: InstanceDefinitions,
		internalModule: InternalController,
		moduleHost: ModuleHost,
		controlId: string,
		id: string | null
	) {
		this.#instanceDefinitions = instanceDefinitions
		this.#internalModule = internalModule
		this.#moduleHost = moduleHost
		this.#controlId = controlId
		this.#id = id
	}

	/**
	 * Get all the actions
	 */
	getAllActions(): FragmentActionInstance[] {
		return [...this.#actions, ...this.#actions.flatMap((action) => action.getAllChildren())]
	}

	/**
	 * Get the contained actions as `ActionInstance`s
	 */
	asActionInstances(): ActionInstance[] {
		return this.#actions.map((action) => action.asActionInstance())
	}

	/**
	 * Initialise from storage
	 * @param actions
	 * @param skipSubscribe Whether to skip calling subscribe for the new actions
	 * @param isCloned Whether this is a cloned instance
	 */
	loadStorage(actions: ActionInstance[], skipSubscribe: boolean, isCloned: boolean): void {
		// Inform modules of action cleanup
		for (const action of this.#actions) {
			action.cleanup()
		}

		this.#actions =
			actions?.map(
				(action) =>
					new FragmentActionInstance(
						this.#instanceDefinitions,
						this.#internalModule,
						this.#moduleHost,
						this.#controlId,
						action,
						!!isCloned
					)
			) || []

		if (!skipSubscribe) {
			this.subscribe(true)
		}
	}

	/**
	 * Inform the instance of any removed actions
	 * @access public
	 */
	cleanup() {
		for (const action of this.#actions) {
			action.cleanup()
		}
		this.#actions = []
	}

	/**
	 * Inform the instance of an updated action
	 * @param recursive whether to call recursively
	 * @param onlyConnectionId If set, only subscribe actions for this connection
	 */
	subscribe(recursive: boolean, onlyConnectionId?: string): void {
		for (const child of this.#actions) {
			child.subscribe(recursive, onlyConnectionId)
		}
	}

	/**
	 * Find a child action by id
	 */
	findById(id: string): FragmentActionInstance | undefined {
		for (const action of this.#actions) {
			if (action.id === id) return action

			const found = action.findChildById(id)
			if (found) return found
		}

		return undefined
	}

	/**
	 * Find the index of a child action, and the parent list
	 */
	findParentAndIndex(
		id: string
	): { parent: FragmentActionList; index: number; item: FragmentActionInstance } | undefined {
		const index = this.#actions.findIndex((fb) => fb.id === id)
		if (index !== -1) {
			return { parent: this, index, item: this.#actions[index] }
		}

		for (const action of this.#actions) {
			const found = action.findParentAndIndex(id)
			if (found) return found
		}

		return undefined
	}

	/**
	 * Add a child action to this action
	 * @param action
	 * @param isCloned Whether this is a cloned instance
	 */
	addAction(action: ActionInstance, isCloned?: boolean): FragmentActionInstance {
		const newAction = new FragmentActionInstance(
			this.#instanceDefinitions,
			this.#internalModule,
			this.#moduleHost,
			this.#controlId,
			action,
			!!isCloned
		)

		this.#actions.push(newAction)

		return newAction
	}

	/**
	 * Remove a child action
	 */
	removeAction(id: string): boolean {
		const index = this.#actions.findIndex((fb) => fb.id === id)
		if (index !== -1) {
			const action = this.#actions[index]
			this.#actions.splice(index, 1)

			action.cleanup()

			return true
		}

		for (const action of this.#actions) {
			if (action.removeChild(id)) return true
		}

		return false
	}

	/**
	 * Reorder a action in the list
	 */
	moveAction(oldIndex: number, newIndex: number): void {
		oldIndex = clamp(oldIndex, 0, this.#actions.length)
		newIndex = clamp(newIndex, 0, this.#actions.length)
		this.#actions.splice(newIndex, 0, ...this.#actions.splice(oldIndex, 1))
	}

	/**
	 * Pop a child action from the list
	 * Note: this is used when moving a action to a different parent. Lifecycle is not managed
	 */
	popAction(index: number): FragmentActionInstance | undefined {
		const action = this.#actions[index]
		if (!action) return undefined

		this.#actions.splice(index, 1)

		return action
	}

	/**
	 * Push a child action to the list
	 * Note: this is used when moving a action from a different parent. Lifecycle is not managed
	 */
	pushAction(action: FragmentActionInstance, index: number): void {
		index = clamp(index, 0, this.#actions.length)

		this.#actions.splice(index, 0, action)
	}

	/**
	 * Check if this list can accept a specified child
	 */
	canAcceptAction(action: FragmentActionInstance): boolean {
		const definition = action.getDefinition()
		if (!definition) return false

		return true
	}

	/**
	 * Duplicate a action
	 */
	duplicateAction(id: string): FragmentActionInstance | undefined {
		const actionIndex = this.#actions.findIndex((fb) => fb.id === id)
		if (actionIndex !== -1) {
			const actionInstance = this.#actions[actionIndex].asActionInstance()
			const newAction = new FragmentActionInstance(
				this.#instanceDefinitions,
				this.#internalModule,
				this.#moduleHost,
				this.#controlId,
				actionInstance,
				true
			)

			this.#actions.splice(actionIndex + 1, 0, newAction)

			newAction.subscribe(true)

			return newAction
		}

		for (const action of this.#actions) {
			const newAction = action.duplicateChild(id)
			if (newAction) return newAction
		}

		return undefined
	}

	/**
	 * Cleanup and forget any children belonging to the given connection
	 */
	forgetForConnection(connectionId: string): boolean {
		let changed = false

		this.#actions = this.#actions.filter((action) => {
			if (action.connectionId === connectionId) {
				action.cleanup()

				return false
			} else {
				changed = action.forgetChildrenForConnection(connectionId)
				return true
			}
		})

		return changed
	}

	/**
	 * Prune all actions/actions referencing unknown conncetions
	 * Doesn't do any cleanup, as it is assumed that the connection has not been running
	 */
	verifyConnectionIds(knownConnectionIds: Set<string>): boolean {
		// Clean out actions
		const actionLength = this.#actions.length
		this.#actions = this.#actions.filter((action) => !!action && knownConnectionIds.has(action.connectionId))
		let changed = this.#actions.length !== actionLength

		for (const action of this.#actions) {
			if (action.verifyChildConnectionIds(knownConnectionIds)) {
				changed = true
			}
		}

		return changed
	}

	/**
	 * If this control was imported to a running system, do some data cleanup/validation
	 */
	postProcessImport(): Promise<void>[] {
		return this.#actions.flatMap((action) => action.postProcessImport())
	}
}

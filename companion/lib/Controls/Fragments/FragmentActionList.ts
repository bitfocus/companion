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

	#actions: FragmentActionInstance[] = []

	constructor(
		instanceDefinitions: InstanceDefinitions,
		internalModule: InternalController,
		moduleHost: ModuleHost,
		controlId: string
	) {
		this.#instanceDefinitions = instanceDefinitions
		this.#internalModule = internalModule
		this.#moduleHost = moduleHost
		this.#controlId = controlId
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
}

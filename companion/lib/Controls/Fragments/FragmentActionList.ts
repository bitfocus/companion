import { FragmentActionInstance } from './FragmentActionInstance.js'
import { clamp } from '../../Resources/Util.js'
import type { ActionInstance } from '@companion-app/shared/Model/ActionModel.js'

export class FragmentActionList {
	#actions: FragmentActionInstance[] = []

	/**
	 * Get the contained actions as `ActionInstance`s
	 */
	asActionInstances(): ActionInstance[] {
		return this.#actions.map((action) => action.asActionInstance())
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

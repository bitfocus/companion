import LogController, { Logger } from '../../Log/Controller.js'
import type {
	ActionInstance,
	ActionSetId,
	ActionSetsModel,
	ActionStepOptions,
} from '@companion-app/shared/Model/ActionModel.js'
import type { ModuleHost } from '../../Instance/Host.js'
import type { InternalController } from '../../Internal/Controller.js'
import { FragmentActionList } from './FragmentActionList.js'
import type { FragmentActionInstance } from './FragmentActionInstance.js'
import type { InstanceDefinitions } from '../../Instance/Definitions.js'
import { validateActionSetId } from '@companion-app/shared/ControlId.js'

/**
 * Helper for ControlTypes with actions
 *
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 3.0.0
 * @copyright 2022 Bitfocus AS
 * @license
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for Companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 */
export class FragmentActions {
	/**
	 * The action-sets on this button
	 */
	#actions: Map<ActionSetId, FragmentActionList> = new Map()

	/**
	 */
	options!: ActionStepOptions

	/**
	 * Commit changes to the database and disk
	 */
	readonly #commitChange: (redraw?: boolean) => void

	/**
	 * The logger
	 */
	readonly #logger: Logger
	readonly #instanceDefinitions: InstanceDefinitions
	readonly #internalModule: InternalController
	readonly #moduleHost: ModuleHost
	readonly #controlId: string

	constructor(
		instanceDefinitions: InstanceDefinitions,
		internalModule: InternalController,
		moduleHost: ModuleHost,
		controlId: string,
		commitChange: (redraw?: boolean) => void
	) {
		this.#logger = LogController.createLogger(`Controls/Fragments/Actions/${controlId}`)

		this.#instanceDefinitions = instanceDefinitions
		this.#internalModule = internalModule
		this.#moduleHost = moduleHost

		this.#actions.set(0, new FragmentActionList(instanceDefinitions, internalModule, moduleHost, controlId))

		this.#controlId = controlId
		this.#commitChange = commitChange
	}

	/**
	 * Initialise from storage
	 * @param actions
	 * @param skipSubscribe Whether to skip calling subscribe for the new feedbacks
	 * @param isCloned Whether this is a cloned instance
	 */
	loadStorage(actions: ActionSetsModel, skipSubscribe?: boolean, isCloned?: boolean) {
		for (const list of this.#actions.values()) {
			list.cleanup()
		}

		this.#actions.clear()

		for (const [key, value] of Object.entries(actions)) {
			if (!value) continue

			const keySafe = validateActionSetId(key as any)
			if (keySafe === undefined) {
				this.#logger.error(`Invalid action set id ${key}`)
				continue
			}

			const newList = new FragmentActionList(
				this.#instanceDefinitions,
				this.#internalModule,
				this.#moduleHost,
				this.#controlId
			)
			newList.loadStorage(value, !!skipSubscribe, !!isCloned)
			this.#actions.set(keySafe, newList)
		}
	}

	getActionSet(setId: ActionSetId): FragmentActionList | undefined {
		return this.#actions.get(setId)
	}

	getActionSetIds(): Array<string | number> {
		return Array.from(this.#actions.keys())
	}

	setupRotaryActionSets(ensureCreated: boolean, skipCommit?: boolean): void {
		if (ensureCreated) {
			// ensure they exist
			if (!this.#actions.has('rotate_left'))
				this.#actions.set(
					'rotate_left',
					new FragmentActionList(this.#instanceDefinitions, this.#internalModule, this.#moduleHost, this.#controlId)
				)
			if (!this.#actions.has('rotate_right'))
				this.#actions.set(
					'rotate_right',
					new FragmentActionList(this.#instanceDefinitions, this.#internalModule, this.#moduleHost, this.#controlId)
				)
		} else {
			// remove the sets
			const rotateLeftSet = this.#actions.get('rotate_left')
			const rotateRightSet = this.#actions.get('rotate_right')

			if (rotateLeftSet) {
				rotateLeftSet.cleanup()
				this.#actions.delete('rotate_left')
			}
			if (rotateRightSet) {
				rotateRightSet.cleanup()
				this.#actions.delete('rotate_right')
			}
		}

		if (!skipCommit) this.#commitChange()
	}

	actionSetAdd(): number {
		const existingKeys = Array.from(this.#actions.keys())
			.map((k) => Number(k))
			.filter((k) => !isNaN(k))
		if (existingKeys.length === 0) {
			// add the default '1000' set
			this.#actions.set(
				1000,
				new FragmentActionList(this.#instanceDefinitions, this.#internalModule, this.#moduleHost, this.#controlId)
			)

			this.#commitChange(true)

			return 1000
		} else {
			// add one after the last
			const max = Math.max(...existingKeys)
			const newIndex = Math.floor(max / 1000) * 1000 + 1000

			this.#actions.set(
				newIndex,
				new FragmentActionList(this.#instanceDefinitions, this.#internalModule, this.#moduleHost, this.#controlId)
			)

			this.#commitChange(false)

			return newIndex
		}
	}

	actionSetRemove(setId: number): boolean {
		const setToRemove = this.#actions.get(setId)
		if (!setToRemove) return false

		// Inform modules of the change
		setToRemove.cleanup()

		// Forget the step from the options
		this.options.runWhileHeld = this.options.runWhileHeld.filter((id) => id !== Number(setId))

		// Assume it exists
		this.#actions.delete(setId)

		// Save the change, and perform a draw
		this.#commitChange(false)

		return true
	}

	actionSetRename(oldSetId: number, newSetId: number): boolean {
		// Ensure old set exists
		const oldSet = this.#actions.get(oldSetId)
		if (!oldSet) return false

		// Ensure new set doesnt already exist
		if (this.#actions.has(newSetId)) return false

		this.#actions.set(newSetId, oldSet)
		this.#actions.delete(oldSetId)

		const runWhileHeldIndex = this.options.runWhileHeld.indexOf(Number(oldSetId))
		if (runWhileHeldIndex !== -1) {
			this.options.runWhileHeld[runWhileHeldIndex] = Number(newSetId)
		}

		return true
	}

	/**
	 * Replace a action with an updated version
	 */
	actionReplace(newProps: Pick<ActionInstance, 'id' | 'action' | 'options'>, skipNotifyModule = false): boolean {
		for (const actionSet of this.#actions.values()) {
			const action = actionSet.findById(newProps.id)
			if (!action) return false

			action.replaceProps(newProps, skipNotifyModule)

			this.#commitChange(false)

			return true
		}

		return false
	}

	/**
	 * Replace all the actions in a set
	 * @param setId the action_set id to update
	 * @param newActions actions to populate
	 */
	actionReplaceAll(setId: ActionSetId, newActions: ActionInstance[]): boolean {
		const actionSet = this.#actions.get(setId)
		if (!actionSet) return false

		actionSet.loadStorage(newActions, false, false)

		this.#commitChange(false)

		return true
	}

	/**
	 * Prepare this control for deletion
	 */
	destroy(): void {
		// Inform modules of action cleanup
		for (const list of this.#actions.values()) {
			list.cleanup()
		}

		this.#actions.clear()
	}

	/**
	 * Get all the actions contained here
	 */
	getAllActions(): FragmentActionInstance[] {
		return Array.from(this.#actions.values()).flatMap((list) => list.getAllActions())
	}

	asActionStepModel(): ActionSetsModel {
		const actions: ActionSetsModel = {
			down: undefined,
			up: undefined,
			rotate_left: undefined,
			rotate_right: undefined,
		}

		for (const [key, list] of this.#actions) {
			actions[key] = list.asActionInstances()
		}

		return actions
	}

	/**
	 * Rename this control
	 * @param newName the new name
	 */
	rename(newName: string): void {
		this.options.name = newName
	}
}

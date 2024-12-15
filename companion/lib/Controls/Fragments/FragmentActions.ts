import LogController, { Logger } from '../../Log/Controller.js'
import type {
	ActionInstance,
	ActionOwner,
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

		this.#actions.set(0, new FragmentActionList(instanceDefinitions, internalModule, moduleHost, controlId, null))

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
				this.#controlId,
				null
			)
			newList.loadStorage(value, !!skipSubscribe, !!isCloned)
			this.#actions.set(keySafe, newList)
		}
	}

	/**
	 * Add an action to this control
	 */
	actionAdd(setId: ActionSetId, actionItem: ActionInstance, ownerId: ActionOwner | null): boolean {
		const actionSet = this.#actions.get(setId)
		if (!actionSet) {
			// cant implicitly create a set
			this.#logger.silly(`Missing set ${this.#controlId}:${setId}`)
			return false
		}

		let newAction: FragmentActionInstance
		if (ownerId) {
			const parent = actionSet.findById(ownerId.parentActionId)
			if (!parent) throw new Error(`Failed to find parent action ${ownerId.parentActionId} when adding child action`)

			newAction = parent.addChild(ownerId.childGroup, actionItem)
		} else {
			newAction = actionSet.addAction(actionItem)
		}

		// Inform relevant module
		newAction.subscribe(true)

		this.#commitChange(false)
		return true
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
					new FragmentActionList(
						this.#instanceDefinitions,
						this.#internalModule,
						this.#moduleHost,
						this.#controlId,
						null
					)
				)
			if (!this.#actions.has('rotate_right'))
				this.#actions.set(
					'rotate_right',
					new FragmentActionList(
						this.#instanceDefinitions,
						this.#internalModule,
						this.#moduleHost,
						this.#controlId,
						null
					)
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
				new FragmentActionList(this.#instanceDefinitions, this.#internalModule, this.#moduleHost, this.#controlId, null)
			)

			this.#commitChange(true)

			return 1000
		} else {
			// add one after the last
			const max = Math.max(...existingKeys)
			const newIndex = Math.floor(max / 1000) * 1000 + 1000

			this.#actions.set(
				newIndex,
				new FragmentActionList(this.#instanceDefinitions, this.#internalModule, this.#moduleHost, this.#controlId, null)
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
	 * Append some actions to this button
	 * @param setId the action_set id to update
	 * @param newActions actions to append
	 */
	actionAppend(setId: ActionSetId, newActions: ActionInstance[], ownerId: ActionOwner | null): boolean {
		const actionSet = this.#actions.get(setId)
		if (!actionSet) {
			// cant implicitly create a set
			this.#logger.silly(`Missing set ${this.#controlId}:${setId}`)
			return false
		}

		if (newActions.length === 0) return true

		let newActionInstances: FragmentActionInstance[]
		if (ownerId) {
			const parent = actionSet.findById(ownerId.parentActionId)
			if (!parent) throw new Error(`Failed to find parent action ${ownerId.parentActionId} when adding child action`)

			newActionInstances = newActions.map((actionItem) => parent.addChild(ownerId.childGroup, actionItem))
		} else {
			newActionInstances = newActions.map((actionItem) => actionSet.addAction(actionItem))
		}

		for (const action of newActionInstances) {
			// Inform relevant module
			action.subscribe(true)
		}

		this.#commitChange(false)

		return false
	}

	/**
	 * Duplicate an action on this control
	 */
	actionDuplicate(setId: ActionSetId, id: string): string | null {
		const actionSet = this.#actions.get(setId)
		if (!actionSet) return null

		const newAction = actionSet.duplicateAction(id)
		if (!newAction) return null

		this.#commitChange(false)

		return newAction.id
	}

	/**
	 * Enable or disable an action
	 */
	actionEnabled(setId: ActionSetId, id: string, enabled: boolean): boolean {
		const actionSet = this.#actions.get(setId)
		if (!actionSet) return false

		const action = actionSet.findById(id)
		if (!action) return false

		action.setEnabled(enabled)

		this.#commitChange(false)

		return true
	}

	/**
	 * Set action headline
	 */
	actionHeadline(setId: ActionSetId, id: string, headline: string): boolean {
		const actionSet = this.#actions.get(setId)
		if (!actionSet) return false

		const action = actionSet.findById(id)
		if (!action) return false

		action.setHeadline(headline)

		this.#commitChange(false)

		return true
	}

	/**
	 * Learn the options for an action, by asking the instance for the current values
	 * @param setId the id of the action set
	 * @param id the id of the action
	 */
	async actionLearn(setId: ActionSetId, id: string): Promise<boolean> {
		const actionSet = this.#actions.get(setId)
		if (!actionSet) return false

		const action = actionSet.findById(id)
		if (!action) return false

		const changed = await action.learnOptions()
		if (!changed) return false

		// Time has passed due to the `await`
		// So the action may not still exist, meaning we should find it again to be sure
		const actionAfter = actionSet.findById(id)
		if (!actionAfter) return false

		this.#commitChange(true)
		return true
	}

	/**
	 * Remove an action from this control
	 * @param setId the id of the action set
	 * @param id the id of the action
	 */
	actionRemove(setId: ActionSetId, id: string): boolean {
		const actionSet = this.#actions.get(setId)
		if (!actionSet) return false

		if (!actionSet.removeAction(id)) return false

		this.#commitChange(false)

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
	 * Find a child feedback by id
	 */
	findChildById(setId: ActionSetId, id: string): FragmentActionInstance | undefined {
		return this.#actions.get(setId)?.findById(id)
	}

	/**
	 * Find the index of a child feedback, and the parent list
	 */
	findParentAndIndex(
		setId: ActionSetId,
		id: string
	): { parent: FragmentActionList; index: number; item: FragmentActionInstance } | undefined {
		return this.#actions.get(setId)?.findParentAndIndex(id)
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
	 * Set the connection of an action
	 * @param setId the action_set id
	 * @param id the action id
	 * @param connectionId the id of the new connection
	 */
	actionSetConnection(setId: ActionSetId, id: string, connectionId: string): boolean {
		if (connectionId == '') return false

		const actionSet = this.#actions.get(setId)
		if (!actionSet) return false

		const action = actionSet.findById(id)
		if (!action) return false

		action.setInstance(connectionId)

		this.#commitChange()

		return true
	}

	/**
	 * Set an option of an action
	 * @param setId the action_set id
	 * @param id the action id
	 * @param key the desired option to set
	 * @param value the new value of the option
	 */
	actionSetOption(setId: ActionSetId, id: string, key: string, value: any): boolean {
		const actionSet = this.#actions.get(setId)
		if (!actionSet) return false

		const action = actionSet.findById(id)
		if (!action) return false

		action.setOption(key, value)

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
	 * Remove any actions referencing a specified connectionId
	 */
	forgetConnection(connectionId: string): boolean {
		let changed = false

		for (const list of this.#actions.values()) {
			if (list.forgetForConnection(connectionId)) {
				changed = true
			}
		}

		return changed
	}

	/**
	 * Get all the actions contained here
	 */
	getAllActionInstances(): ActionInstance[] {
		return Array.from(this.#actions.values()).flatMap((list) => list.asActionInstances())
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
	 * Get all the action instances
	 * @param onlyConnectionId Optionally, only for a specific connection
	 * @returns {}
	 */
	getFlattenedActionInstances(onlyConnectionId?: string): Omit<ActionInstance, 'children'>[] {
		const instances: ActionInstance[] = []

		const extractInstances = (actions: ActionInstance[]) => {
			for (const action of actions) {
				if (!onlyConnectionId || onlyConnectionId === action.instance) {
					instances.push({
						...action,
						children: undefined,
					})
				}

				if (action.children) {
					for (const actions of Object.values(action.children)) {
						if (!actions) continue

						extractInstances(actions)
					}
				}
			}
		}

		for (const list of this.#actions.values()) {
			extractInstances(list.asActionInstances())
		}

		return instances
	}

	/**
	 * If this control was imported to a running system, do some data cleanup/validation
	 */
	async postProcessImport(): Promise<void> {
		await Promise.all(Array.from(this.#actions.values()).flatMap((actionSet) => actionSet.postProcessImport())).catch(
			(e) => {
				this.#logger.silly(`postProcessImport for ${this.#controlId} failed: ${e.message}`)
			}
		)
	}

	/**
	 * Prune all actions/feedbacks referencing unknown connections
	 * Doesn't do any cleanup, as it is assumed that the connection has not been running
	 * @returns Whether any changes were made
	 */
	verifyConnectionIds(knownConnectionIds: Set<string>): boolean {
		let changed = false

		for (const list of this.#actions.values()) {
			if (list.verifyConnectionIds(knownConnectionIds)) {
				changed = true
			}
		}

		return changed
	}

	/**
	 * Rename this control
	 * @param newName the new name
	 */
	rename(newName: string): void {
		this.options.name = newName
	}
}

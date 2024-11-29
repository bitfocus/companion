import LogController, { Logger } from '../../Log/Controller.js'
import type { ActionInstance, ActionSetsModel, ActionStepOptions } from '@companion-app/shared/Model/ActionModel.js'
import type { ModuleHost } from '../../Instance/Host.js'
import type { InternalController } from '../../Internal/Controller.js'
import { FragmentActionList } from './FragmentActionList.js'
import type { FragmentActionInstance } from './FragmentActionInstance.js'
import type { InstanceDefinitions } from '../../Instance/Definitions.js'

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
	#actions: Map<string | number, FragmentActionList> = new Map()

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

			const newList = new FragmentActionList(
				this.#instanceDefinitions,
				this.#internalModule,
				this.#moduleHost,
				this.#controlId,
				null
			)
			newList.loadStorage(value, !!skipSubscribe, !!isCloned)
			this.#actions.set(key, newList)
		}
	}

	/**
	 * Add an action to this control
	 */
	actionAdd(setId: string, actionItem: ActionInstance, parentId: string | null): boolean {
		const actionSet = this.#actions.get(setId)
		if (!actionSet) {
			// cant implicitly create a set
			this.#logger.silly(`Missing set ${this.#controlId}:${setId}`)
			return false
		}

		let newAction: FragmentActionInstance
		if (parentId) {
			const parent = actionSet.findById(parentId)
			if (!parent) throw new Error(`Failed to find parent action ${parentId} when adding child action`)

			newAction = parent.addChild(actionItem)
		} else {
			newAction = actionSet.addAction(actionItem)
		}

		// Inform relevant module
		newAction.subscribe(true)

		this.#commitChange(false)
		return true
	}

	/**
	 * Append some actions to this button
	 * @param setId the action_set id to update
	 * @param newActions actions to append
	 */
	actionAppend(setId: string, newActions: ActionInstance[], parentId: string | null): boolean {
		const actionSet = this.#actions.get(setId)
		if (!actionSet) {
			// cant implicitly create a set
			this.#logger.silly(`Missing set ${this.#controlId}:${setId}`)
			return false
		}

		if (newActions.length === 0) return true

		let newActionInstances: FragmentActionInstance[]
		if (parentId) {
			const parent = actionSet.findById(parentId)
			if (!parent) throw new Error(`Failed to find parent action ${parentId} when adding child action`)

			newActionInstances = newActions.map((actionItem) => parent.addChild(actionItem))
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
	 * Clear/remove all the actions in a set on this control
	 */
	actionClearSet(setId: string, skipCommit = false): boolean {
		const actionSet = this.#actions.get(setId)
		if (!actionSet) return false

		actionSet.cleanup()

		if (!skipCommit) this.#commitChange()

		return false
	}

	/**
	 * Duplicate an action on this control
	 */
	actionDuplicate(setId: string, id: string): string | null {
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
	actionEnabled(setId: string, id: string, enabled: boolean): boolean {
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
	actionHeadline(setId: string, id: string, headline: string): boolean {
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
	async actionLearn(setId: string, id: string): Promise<boolean> {
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
	actionRemove(setId: string, id: string): boolean {
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
		const actionSet = this.#actions.get(setId)
		if (!actionSet) return false

		const action = actionSet.findById(newProps.id)
		if (!action) return false

		action.replaceProps(newProps, skipNotifyModule)

		this.#commitChange(false)

		return true
	}

	// 	/**
	// 	 * Move a feedback within the heirarchy
	// 	 * @param {string } moveFeedbackId the id of the feedback to move
	// 	 * @param {string | null} newParentId the target parentId of the feedback
	// 	 * @param {number} newIndex the target index of the feedback
	// 	 * @returns {boolean}
	// 	 * @access public
	// 	 */
	// 	feedbackMoveTo(moveFeedbackId, newParentId, newIndex) {
	// 		const oldItem = this.#feedbacks.findParentAndIndex(moveFeedbackId)
	// 		if (!oldItem) return false

	// 		if (oldItem.parent.id === newParentId) {
	// 			oldItem.parent.moveFeedback(oldItem.index, newIndex)
	// 		} else {
	// 			const newParent = newParentId ? this.#feedbacks.findById(newParentId) : null
	// 			if (newParentId && !newParent) return false

	// 			// Check if the new parent can hold the feedback being moved
	// 			if (newParent && !newParent.canAcceptChild(oldItem.item)) return false

	// 			const poppedFeedback = oldItem.parent.popFeedback(oldItem.index)
	// 			if (!poppedFeedback) return false

	// 			if (newParent) {
	// 				newParent.pushChild(poppedFeedback, newIndex)
	// 			} else {
	// 				this.#feedbacks.pushFeedback(poppedFeedback, newIndex)
	// 			}
	// 		}

	// 		this.#commitChange()

	// 		return true
	// }

	/**
	 * Replace all the actions in a set
	 * @param setId the action_set id to update
	 * @param newActions actions to populate
	 */
	actionReplaceAll(setId: string, newActions: ActionInstance[]): boolean {
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
	actionSetConnection(setId: string, id: string, connectionId: string): boolean {
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
	 * Set the delay of an action
	 * @param setId the action_set id
	 * @param id the action id
	 * @param delay the desired delay
	 */
	actionSetDelay(setId: string, id: string, delay: number): boolean {
		const actionSet = this.#actions.get(setId)
		if (!actionSet) return false

		const action = actionSet.findById(id)
		if (!action) return false

		action.setDelay(delay)

		this.#commitChange(false)

		return true
	}

	/**
	 * Set an option of an action
	 * @param setId the action_set id
	 * @param id the action id
	 * @param key the desired option to set
	 * @param value the new value of the option
	 */
	actionSetOption(setId: string, id: string, key: string, value: any): boolean {
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
		const actions: ActionSetsModel = {}

		for (const [key, list] of this.#actions) {
			actions[key] = list.asActionInstances()
		}

		return actions
	}

	// /**
	//  * Get all the feedback instances
	//  * @param {string=} onlyConnectionId Optionally, only for a specific connection
	//  * @returns {Omit<FeedbackInstance, 'children'>[]}
	//  */
	// getFlattenedFeedbackInstances(onlyConnectionId) {
	// 	/** @type {FeedbackInstance[]} */
	// 	const instances = []

	// 	const extractInstances = (/** @type {FeedbackInstance[]} */ feedbacks) => {
	// 		for (const feedback of feedbacks) {
	// 			if (!onlyConnectionId || onlyConnectionId === feedback.instance_id) {
	// 				instances.push({
	// 					...feedback,
	// 					children: undefined,
	// 				})
	// 			}

	// 			if (feedback.children) {
	// 				extractInstances(feedback.children)
	// 			}
	// 		}
	// 	}

	// 	extractInstances(this.#feedbacks.asFeedbackInstances())

	// 	return instances
	// }

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

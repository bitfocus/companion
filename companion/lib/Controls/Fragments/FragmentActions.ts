import { cloneDeep } from 'lodash-es'
import { nanoid } from 'nanoid'
import LogController, { Logger } from '../../Log/Controller.js'
import type { ActionInstance, ActionSetsModel, ActionStepOptions } from '@companion-app/shared/Model/ActionModel.js'
import type { ModuleHost } from '../../Instance/Host.js'
import type { InternalController } from '../../Internal/Controller.js'

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
	action_sets: ActionSetsModel = {}

	/**
	 */
	options: ActionStepOptions

	/**
	 * Commit changes to the database and disk
	 */
	readonly #commitChange: (redraw?: boolean) => void

	/**
	 * The logger
	 */
	readonly #logger: Logger
	readonly #internalModule: InternalController
	readonly #moduleHost: ModuleHost
	readonly #controlId: string

	constructor(
		internalModule: InternalController,
		moduleHost: ModuleHost,
		controlId: string,
		commitChange: (redraw?: boolean) => void
	) {
		this.#logger = LogController.createLogger(`Controls/Fragments/Actions/${controlId}`)

		this.#internalModule = internalModule
		this.#moduleHost = moduleHost

		this.#controlId = controlId
		this.#commitChange = commitChange
	}

	/**
	 * Add an action to this control
	 */
	actionAdd(setId: string, actionItem: ActionInstance): boolean {
		const action_set = this.action_sets[setId]
		if (!action_set) {
			// cant implicitly create a set
			this.#logger.silly(`Missing set ${this.#controlId}:${setId}`)
			return false
		}

		action_set.push(actionItem)

		this.#actionSubscribe(actionItem)

		this.#commitChange(false)
		return true
	}

	/**
	 * Append some actions to this button
	 * @param setId the action_set id to update
	 * @param newActions actions to append
	 */
	actionAppend(setId: string, newActions: ActionInstance[]): boolean {
		const action_set = this.action_sets[setId]
		if (action_set) {
			// Add new actions
			for (const action of newActions) {
				action_set.push(action)

				this.#actionSubscribe(action)
			}

			this.#commitChange(false)

			return true
		}

		return false
	}

	/**
	 * Clear/remove all the actions in a set on this control
	 */
	actionClearSet(setId: string, skipCommit = false): boolean {
		const action_set = this.action_sets[setId]
		if (action_set) {
			for (const action of action_set) {
				this.cleanupAction(action)
			}

			this.action_sets[setId] = []

			if (!skipCommit) this.#commitChange()

			return true
		}

		return false
	}

	/**
	 * Duplicate an action on this control
	 */
	actionDuplicate(setId: string, id: string): string | null {
		const action_set = this.action_sets[setId]
		if (action_set) {
			const index = action_set.findIndex((act) => act.id === id)
			if (index !== -1) {
				const actionItem = cloneDeep(action_set[index])
				actionItem.id = nanoid()

				action_set.splice(index + 1, 0, actionItem)

				this.#actionSubscribe(actionItem)

				this.#commitChange(false)

				return actionItem.id
			}
		}

		return null
	}

	/**
	 * Enable or disable an action
	 */
	actionEnabled(setId: string, id: string, enabled: boolean): boolean {
		const action_set = this.action_sets[setId]
		if (action_set) {
			for (const action of action_set) {
				if (action && action.id === id) {
					if (!action.options) action.options = {}

					action.disabled = !enabled

					// Inform relevant module
					if (!action.disabled) {
						this.#actionSubscribe(action)
					} else {
						this.cleanupAction(action)
					}

					this.#commitChange(false)

					return true
				}
			}
		}

		return false
	}

	/**
	 * Set action headline
	 */
	actionHeadline(setId: string, id: string, headline: string): boolean {
		const action_set = this.action_sets[setId]
		if (action_set) {
			for (const action of action_set) {
				if (action && action.id === id) {
					action.headline = headline

					this.#commitChange(false)

					return true
				}
			}
		}

		return false
	}

	/**
	 * Learn the options for an action, by asking the instance for the current values
	 * @param setId the id of the action set
	 * @param id the id of the action
	 */
	async actionLearn(setId: string, id: string): Promise<boolean> {
		const action_set = this.action_sets[setId]
		if (action_set) {
			const action = action_set.find((act) => act.id === id)
			if (action) {
				const instance = this.#moduleHost.getChild(action.instance)
				if (instance) {
					const newOptions = await instance.actionLearnValues(action, this.#controlId)
					if (newOptions) {
						const newAction: ActionInstance = {
							...action,
							options: newOptions,
						}

						// It may not still exist, so do a replace through the usual flow
						return this.actionReplace(newAction)
					}
				}
			}
		}

		return false
	}

	/**
	 * Remove an action from this control
	 * @param setId the id of the action set
	 * @param id the id of the action
	 */
	actionRemove(setId: string, id: string): boolean {
		const action_set = this.action_sets[setId]
		if (action_set) {
			const index = action_set.findIndex((act) => act.id === id)
			if (index !== -1) {
				const action = action_set[index]
				action_set.splice(index, 1)

				this.cleanupAction(action)

				this.#commitChange(false)

				return true
			}
		}

		return false
	}

	/**
	 * Replace a action with an updated version
	 */
	actionReplace(newProps: Pick<ActionInstance, 'id' | 'action' | 'options'>, skipNotifyModule = false): boolean {
		for (const action_set of Object.values(this.action_sets)) {
			if (!action_set) continue

			for (const action of action_set) {
				// Replace the new action in place
				if (action.id === newProps.id) {
					action.action = newProps.action // || newProps.actionId nocommit
					action.options = newProps.options

					delete action.upgradeIndex

					// Inform relevant module
					if (!skipNotifyModule) {
						this.#actionSubscribe(action)
					}

					this.#commitChange(false)

					return true
				}
			}
		}

		return false
	}

	/**
	 * Replace all the actions in a set
	 * @param setId the action_set id to update
	 * @param newActions actions to populate
	 */
	actionReplaceAll(setId: string, newActions: ActionInstance[]): boolean {
		const oldActionSet = this.action_sets[setId]
		if (oldActionSet) {
			// Remove the old actions
			for (const action of oldActionSet) {
				this.cleanupAction(action)
			}

			const newActionSet: ActionInstance[] = []
			this.action_sets[setId] = newActionSet

			// Add new actions
			for (const action of newActions) {
				newActionSet.push(action)

				this.#actionSubscribe(action)
			}

			this.#commitChange(false)

			return true
		}

		return false
	}

	/**
	 * Set the connection of an action
	 * @param setId the action_set id
	 * @param id the action id
	 * @param connectionId the id of the new connection
	 */
	actionSetConnection(setId: string, id: string, connectionId: string): boolean {
		if (connectionId == '') return false
		const action_set = this.action_sets[setId]
		if (action_set) {
			for (const action of action_set) {
				if (action && action.id === id) {
					// remove action from old instance
					this.cleanupAction(action)
					// change instance
					action.instance = connectionId
					// subscribe action at new instance
					this.#actionSubscribe(action)

					this.#commitChange(false)

					return true
				}
			}
		}

		return false
	}

	/**
	 * Set the delay of an action
	 * @param setId the action_set id
	 * @param id the action id
	 * @param delay the desired delay
	 */
	actionSetDelay(setId: string, id: string, delay: number): boolean {
		const action_set = this.action_sets[setId]
		if (action_set) {
			for (const action of action_set) {
				if (action && action.id === id) {
					delay = Number(delay)
					if (isNaN(delay)) delay = 0

					action.delay = delay

					this.#commitChange(false)

					return true
				}
			}
		}

		return false
	}

	/**
	 * Set an opton of an action
	 * @param setId the action_set id
	 * @param id the action id
	 * @param key the desired option to set
	 * @param value the new value of the option
	 */
	actionSetOption(setId: string, id: string, key: string, value: any): boolean {
		const action_set = this.action_sets[setId]
		if (action_set) {
			for (const action of action_set) {
				if (action && action.id === id) {
					if (!action.options) action.options = {}

					action.options[key] = value

					// Inform relevant module
					this.#actionSubscribe(action)

					this.#commitChange(false)

					return true
				}
			}
		}

		return false
	}

	/**
	 * Inform the instance of an updated action
	 */
	#actionSubscribe(action: ActionInstance): void {
		if (!action.disabled) {
			const instance = this.#moduleHost.getChild(action.instance, true)
			if (instance) {
				instance.actionUpdate(action, this.#controlId).catch((e) => {
					this.#logger.silly(`action_update to connection failed: ${e.message}`)
				})
			}
		}
	}

	/**
	 * Inform the instance of a removed action
	 */
	cleanupAction(action: ActionInstance): void {
		// Inform relevant module
		const instance = this.#moduleHost.getChild(action.instance, true)
		if (instance) {
			instance.actionDelete(action).catch((e) => {
				this.#logger.silly(`action_delete to connection failed: ${e.message}`)
			})
		}
	}

	/**
	 * Prepare this control for deletion
	 */
	destroy(): void {
		// Inform modules of action cleanup
		for (const action_set of Object.values(this.action_sets)) {
			if (!action_set) continue

			for (const action of action_set) {
				this.cleanupAction(action)
			}
		}
	}

	/**
	 * Remove any actions referencing a specified connectionId
	 */
	forgetConnection(connectionId: string): boolean {
		let changed = false

		// Cleanup any actions
		for (const [setId, action_set] of Object.entries(this.action_sets)) {
			if (!action_set) continue

			const newActions = []
			for (const action of action_set) {
				if (action.instance === connectionId) {
					this.cleanupAction(action)
					changed = true
				} else {
					newActions.push(action)
				}
			}

			this.action_sets[setId] = newActions
		}

		return changed
	}

	/**
	 * Get all the actions contained here
	 */
	getAllActions(): ActionInstance[] {
		const actions: ActionInstance[] = []

		for (const action_set of Object.values(this.action_sets)) {
			if (!action_set) continue
			actions.push(...action_set)
		}

		return actions
	}

	/**
	 * If this control was imported to a running system, do some data cleanup/validation
	 */
	async postProcessImport(): Promise<void> {
		const ps: Promise<any>[] = []

		for (const action_set of Object.values(this.action_sets)) {
			if (!action_set) continue
			for (let i = 0; i < action_set.length; i++) {
				const action = action_set[i]
				action.id = nanoid()

				if (action.instance === 'internal') {
					const newAction = this.#internalModule.actionUpgrade(action, this.#controlId)
					if (newAction) {
						action_set[i] = newAction
					}
				} else {
					const instance = this.#moduleHost.getChild(action.instance, true)
					if (instance) {
						ps.push(instance.actionUpdate(action, this.#controlId))
					}
				}
			}
		}

		await Promise.all(ps).catch((e) => {
			this.#logger.silly(`postProcessImport for ${this.#controlId} failed: ${e.message}`)
		})
	}

	/**
	 * Prune all actions/feedbacks referencing unknown connections
	 * Doesn't do any cleanup, as it is assumed that the connection has not been running
	 * @returns Whether any changes were made
	 */
	verifyConnectionIds(knownConnectionIds: Set<string>): boolean {
		let changed = false

		// Clean out actions
		for (const [setId, existing_set] of Object.entries(this.action_sets)) {
			if (!existing_set) continue

			const lengthBefore = existing_set.length
			const filtered_set = (this.action_sets[setId] = existing_set.filter(
				(action) => !!action && knownConnectionIds.has(action.instance)
			))
			changed = changed || filtered_set.length !== lengthBefore
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

import type { Registry } from '../Registry.js'
import type { RunActionExtras } from '../Instance/Connection/ChildHandlerApi.js'
import { nanoid } from 'nanoid'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import type { ControlEntityInstance } from './Entities/EntityInstance.js'
import LogController from '../Log/Controller.js'

/**
 * Class to handle execution of actions.
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
 */
export class ActionRunner {
	readonly #logger = LogController.createLogger('Control/ActionRunner')

	readonly #registry: Pick<Registry, 'internalModule' | 'instance'>

	constructor(registry: Pick<Registry, 'internalModule' | 'instance'>) {
		this.#registry = registry
	}

	/**
	 * Run a single action
	 */
	async #runAction(action: ControlEntityInstance, extras: RunActionExtras): Promise<void> {
		this.#logger.silly('Running action', action)

		if (action.connectionId === 'internal') {
			await this.#registry.internalModule.executeAction(action, extras)
		} else {
			const instance = this.#registry.instance.processManager.getConnectionChild(action.connectionId)
			if (instance) {
				const entityModel = action.asEntityModel(false)
				if (entityModel.type !== EntityModelType.Action)
					throw new Error(`Cannot execute entity of type "${entityModel.type}" as an action`)
				await instance.actionRun(entityModel, extras)
			} else {
				this.#logger.silly('trying to run action on a missing instance.', action)
			}
		}
	}

	/**
	 * Run multiple actions
	 */
	async runMultipleActions(
		actions0: ControlEntityInstance[],
		extras: RunActionExtras,
		executeSequential = false
	): Promise<void> {
		const actions = actions0.filter((act) => act.type === EntityModelType.Action && !act.disabled)
		if (actions.length === 0) return

		if (extras.abortDelayed.aborted) return

		if (executeSequential) {
			// Future: abort on error?

			for (const action of actions) {
				if (extras.abortDelayed.aborted) break
				await this.#runAction(action, extras).catch((e) => {
					this.#logger.silly(`Error executing action for ${action.connectionId}: ${e.message ?? e}`)
				})
			}
		} else {
			const groupedActions = this.#splitActionsAroundWaits(actions)

			const ps: Promise<void>[] = []

			for (const { waitAction, actions } of groupedActions) {
				if (extras.abortDelayed.aborted) break

				if (waitAction) {
					// Perform the wait action
					await this.#runAction(waitAction, extras).catch((e) => {
						this.#logger.silly(`Error executing action for ${waitAction.connectionId}: ${e.message ?? e}`)
					})
				}

				if (extras.abortDelayed.aborted) break

				// Spawn all the actions in parallel
				for (const action of actions) {
					ps.push(
						this.#runAction(action, extras).catch((e) => {
							this.#logger.silly(`Error executing action for ${action.connectionId}: ${e.message ?? e}`)
						})
					)
				}
			}

			// Await all the actions, so that the abort signal is respected and the promise is pending until all actions are done
			await Promise.all(ps)
		}
	}

	#splitActionsAroundWaits(actions: ControlEntityInstance[]): GroupedActionEntityModels[] {
		const groupedActions: GroupedActionEntityModels[] = [
			{
				waitAction: undefined,
				actions: [],
			},
		]

		for (const action of actions) {
			if (action.connectionId === 'internal' && action.definitionId === 'wait') {
				groupedActions.push({
					waitAction: action,
					actions: [],
				})
			} else {
				groupedActions[groupedActions.length - 1].actions.push(action)
			}
		}

		return groupedActions
	}
}

interface GroupedActionEntityModels {
	waitAction: ControlEntityInstance | undefined
	actions: ControlEntityInstance[]
}

export class ControlActionRunner {
	readonly #actionRunner: ActionRunner
	readonly #controlId: string
	readonly #triggerRedraw: () => void

	readonly #runningChains = new Map<string, AbortController>()

	get hasRunningChains(): boolean {
		return this.#runningChains.size > 0
	}

	constructor(actionRunner: ActionRunner, controlId: string, triggerRedraw: () => void) {
		this.#actionRunner = actionRunner
		this.#controlId = controlId
		this.#triggerRedraw = triggerRedraw
	}

	async runActions(
		actions: ControlEntityInstance[],
		extras: Omit<RunActionExtras, 'controlId' | 'abortDelayed' | 'executionMode'>
	): Promise<void> {
		const controller = new AbortController()

		const chainId = nanoid()
		this.#runningChains.set(chainId, controller)

		// If this is the first chain, trigger a redraw
		if (this.#runningChains.size === 1) {
			this.#triggerRedraw()
		}

		return this.#actionRunner
			.runMultipleActions(actions, {
				...extras,
				controlId: this.#controlId,
				abortDelayed: controller.signal,
				executionMode: 'concurrent',
			})
			.finally(() => {
				// If this removes the last chain, trigger a redraw
				if (this.#runningChains.delete(chainId) && this.#runningChains.size === 0) {
					this.#triggerRedraw()
				}
			})
	}

	abortAll(exceptSignal: AbortSignal | null): boolean {
		if (this.#runningChains.size === 0) {
			return false
		}

		for (const [chainId, controller] of this.#runningChains.entries()) {
			// Skip the chain if it's the one we're supposed to ignore
			if (exceptSignal && exceptSignal === controller.signal) continue

			controller.abort()
			this.#runningChains.delete(chainId)
			console.log('Aborted an action', chainId)
		}

		this.#triggerRedraw()

		return true
	}

	abortSingle(exceptSignal: AbortSignal): boolean {
		if (this.#runningChains.size === 0) {
			return false
		}

		console.log('Aborting single action', this.#runningChains.size, exceptSignal)
		for (const [chainId, controller] of this.#runningChains.entries()) {
			// Skip the chain if it's not the one we're supposed to abort
			if (exceptSignal !== controller.signal) continue

			controller.abort()
			this.#runningChains.delete(chainId)
			console.log('Aborted single action', chainId)
		}

		this.#triggerRedraw()

		return true
	}
}

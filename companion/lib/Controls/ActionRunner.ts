import { nanoid } from 'nanoid'
import { isCustomActionsConnectionId, isInternalConnectionId } from '@companion-app/shared/ConnectionId.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { assertNever, type JsonValue } from '@companion-module/host'
import type { RunActionExtras } from '../Instance/Connection/ChildHandlerApi.js'
import type { InstanceController } from '../Instance/Controller.js'
import type { InternalController } from '../Internal/Controller.js'
import LogController, { type Logger } from '../Log/Controller.js'
import type { VariablesController } from '../Variables/Controller.js'
import type { LocalVariablesController } from '../Variables/LocalVariablesController.js'
import type { CustomActionInstanceManager } from './CustomActions/CustomActionInstanceManager.js'
import type { ControlEntityInstance } from './Entities/EntityInstance.js'
import type { StoreResult } from './Entities/Types.js'
import type { IControlStore } from './IControlStore.js'

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

	readonly #instanceController: InstanceController
	readonly #controlStore: IControlStore
	readonly #internalModule: InternalController
	readonly #variablesController: VariablesController
	readonly #localVariablesController: LocalVariablesController
	readonly #customActionInstances: CustomActionInstanceManager

	constructor(
		instanceController: InstanceController,
		controlStore: IControlStore,
		internalModule: InternalController,
		variablesController: VariablesController,
		localVariablesController: LocalVariablesController,
		customActionInstances: CustomActionInstanceManager
	) {
		this.#instanceController = instanceController
		this.#controlStore = controlStore
		this.#internalModule = internalModule
		this.#variablesController = variablesController
		this.#localVariablesController = localVariablesController
		this.#customActionInstances = customActionInstances
	}

	/**
	 * Run a single action
	 */
	async #runAction(action: ControlEntityInstance, extras: RunActionExtras): Promise<void> {
		const entityModel = action.asEntityModel(false)

		this.#logger.silly('Running action', entityModel)

		if (entityModel.type !== EntityModelType.Action)
			throw new Error(`Cannot execute entity of type "${entityModel.type}" as an action`)

		let result: JsonValue | undefined
		if (isInternalConnectionId(action.connectionId)) {
			result = await this.#internalModule.executeAction(action, extras)
		} else if (isCustomActionsConnectionId(action.connectionId)) {
			result = await this.#runCustomAction(action, extras)
		} else {
			const instance = this.#instanceController.processManager.getConnectionChild(action.connectionId)
			if (!instance) {
				this.#logger.silly('trying to run action on a missing instance.', action)
				return
			}

			result = await instance.actionRun(entityModel, extras)
		}

		// Don't store the result if the chain was aborted while the action was running
		if (extras.abortDelayed.aborted) return

		// Store the result if necessary, then return.
		const storeResult = action.storeResult
		if (storeResult) this.storeValue(storeResult, result, extras)
	}

	/**
	 * Write a value to where it is to be stored, such as the result of an action
	 * @param target Where to store the value
	 * @param value The value
	 * @param extras The execution context of the action, which `this` in the target is relative to
	 */
	storeValue(target: StoreResult, value: JsonValue | undefined, extras: RunActionExtras): void {
		switch (target.type) {
			case 'local-variable': {
				const { location, variableName: name } = target
				const localVariable = this.#localVariablesController.localVariableFor(location, name, extras)
				if (!localVariable) {
					this.#logger.warn(`Local variable ${name} in location \`${location}\` is invalid`)
					break
				}

				this.#localVariablesController.setLocalVariable(localVariable, value)
				break
			}
			case 'page-variable': {
				const { page, variableName: name } = target
				const pageVariable = this.#localVariablesController.pageVariableFor(
					page,
					name,
					extras.location?.pageNumber ?? null
				)
				if (!pageVariable) {
					this.#logger.warn(`Page variable ${name} on page \`${page}\` is invalid`)
					break
				}

				this.#localVariablesController.setLocalVariable(pageVariable, value)
				break
			}
			case 'custom-variable': {
				const variableName = target.variableName
				if (variableName) {
					const customVars = this.#variablesController.custom
					if (customVars.hasCustomVariable(variableName)) {
						customVars.setValue(variableName, value)
					} else if (target.createIfNotExists) {
						customVars.createVariable(variableName, value)
					} else {
						this.#logger.warn(`Custom variable "${variableName}" not found`)
					}
				}
				break
			}
			default:
				assertNever(target)
				this.#logger.warn(`Invalid store target: ${JSON.stringify(target)}`)
				break
		}
	}

	/**
	 * Run a custom action, with the options of the action as its inputs
	 */
	async #runCustomAction(action: ControlEntityInstance, extras: RunActionExtras): Promise<JsonValue | undefined> {
		// The inputs are parsed in the execution context of the caller
		return this.#customActionInstances.runCall(
			action,
			this.#controlStore.createActionExecutionParser(extras),
			extras,
			// The outputs are stored relative to the caller
			(target, value) => this.storeValue(target, value, extras)
		)
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
			if (isInternalConnectionId(action.connectionId) && action.definitionId === 'wait') {
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
	readonly #logger: Logger
	readonly #actionRunner: ActionRunner
	readonly #controlId: string
	readonly #triggerRedraw: () => void

	readonly #runningChains = new Map<string, AbortController>()

	get hasRunningChains(): boolean {
		return this.#runningChains.size > 0
	}

	constructor(actionRunner: ActionRunner, controlId: string, triggerRedraw: () => void) {
		this.#logger = LogController.createLogger(`Control/ActionRunner/${controlId}`)
		this.#actionRunner = actionRunner
		this.#controlId = controlId
		this.#triggerRedraw = triggerRedraw
	}

	async runActions(
		actions: ControlEntityInstance[],
		extras: Omit<RunActionExtras, 'controlId' | 'abortDelayed' | 'executionMode'>
	): Promise<void> {
		return this.runChain(extras, async (chainExtras) => this.#actionRunner.runMultipleActions(actions, chainExtras))
	}

	/**
	 * Run something as a chain of actions of this control, so that it is tracked as running and can be aborted
	 * @param extras The execution context
	 * @param run The function to run, given the full execution context of the chain
	 */
	async runChain(
		extras: Omit<RunActionExtras, 'controlId' | 'abortDelayed' | 'executionMode'>,
		run: (extras: RunActionExtras) => Promise<void>
	): Promise<void> {
		const controller = new AbortController()

		const chainId = nanoid()
		this.#runningChains.set(chainId, controller)

		// If this is the first chain, trigger a redraw
		if (this.#runningChains.size === 1) {
			this.#triggerRedraw()
		}

		return run({
			...extras,
			controlId: this.#controlId,
			abortDelayed: controller.signal,
			executionMode: 'concurrent',
		}).finally(() => {
			// If this removes the last chain, trigger a redraw
			if (this.#runningChains.delete(chainId) && this.#runningChains.size === 0) {
				this.#triggerRedraw()
			}
		})
	}

	abortAll(exceptSignal: AbortSignal | null): boolean {
		let aborted = false

		for (const [chainId, controller] of this.#runningChains.entries()) {
			// Skip the chain if it's the one we're supposed to ignore
			if (exceptSignal && exceptSignal === controller.signal) continue

			controller.abort()
			this.#runningChains.delete(chainId)
			this.#logger.silly(`Aborted an action: ${chainId}`)
			aborted = true
		}

		if (aborted) this.#triggerRedraw()

		return aborted
	}

	abortSingle(onlySignal: AbortSignal): boolean {
		let aborted = false

		for (const [chainId, controller] of this.#runningChains.entries()) {
			// Skip the chain if it's not the one we're supposed to abort
			if (onlySignal !== controller.signal) continue

			controller.abort()
			this.#runningChains.delete(chainId)
			this.#logger.silly(`Aborted single action: ${chainId}`)
			aborted = true
		}

		if (aborted) this.#triggerRedraw()

		return aborted
	}
}

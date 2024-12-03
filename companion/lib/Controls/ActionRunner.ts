import { CoreBase } from '../Core/Base.js'
import type { Registry } from '../Registry.js'
import type { RunActionExtras } from '../Instance/Wrapper.js'
import { ActionInstance } from '@companion-app/shared/Model/ActionModel.js'
import { nanoid } from 'nanoid'

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
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 */
export class ActionRunner extends CoreBase {
	constructor(registry: Registry) {
		super(registry, 'Control/ActionRunner')
	}

	/**
	 * Run a single action
	 */
	async #runAction(action: ActionInstance, extras: RunActionExtras): Promise<void> {
		if (action.instance === 'internal') {
			await this.internalModule.executeAction(action, extras)
		} else {
			const instance = this.instance.moduleHost.getChild(action.instance)
			if (instance) {
				await instance.actionRun(action, extras)
			} else {
				this.logger.silly('trying to run action on a missing instance.', action)
			}
		}
	}

	/**
	 * Run multiple actions
	 */
	async runMultipleActions(
		actions0: ActionInstance[],
		controlId: string,
		_relative_delay: boolean,
		extras: Omit<RunActionExtras, 'controlId' | 'location'>
	): Promise<void> {
		const actions = actions0.filter((act) => !act.disabled)

		if (actions.length === 0) {
			return
		}

		// // Handle whether the delays are absolute or relative.
		// const effective_delays: Record<string, number> = {}
		// let tmp_delay = 0
		// for (const action of actions) {
		// 	if (relative_delay) {
		// 		// Relative delay: each action's delay adds to the next.
		// 		tmp_delay += action.delay
		// 	} else {
		// 		// Absolute delay: each delay is its own.
		// 		tmp_delay = action.delay
		// 	}

		// 	// Create the property .effective_delay. Don't change the user's .delay property.
		// 	effective_delays[action.id] = tmp_delay
		// }

		const location = this.page.getLocationOfControlId(controlId)
		const extra2: RunActionExtras = {
			...(extras || {}),
			location,
			controlId,
		}

		// Run all the actions in parallel
		await Promise.all(
			actions.map(async (action) => {
				this.logger.silly('Running action', action)

				await this.#runAction(action, extra2).catch((e) => {
					this.logger.silly(`Error executing action for ${action.instance}: ${e.message ?? e}`)
				})
			})
		)

		// let has_delayed = false
		// for (const action of actions) {
		// 	const delay_time = effective_delays[action.id] === undefined ? 0 : effective_delays[action.id]

		// 	this.logger.silly('Running action', action)

		// 	// is this a timedelayed action?
		// 	if (delay_time > 0) {
		// 		has_delayed = true
		// 		const timer = setTimeout(() => {
		// 			this.#runAction(action, extra2).catch((e) => {
		// 				this.logger.silly(`Error executing action for ${action.instance}: ${e.message ?? e}`)
		// 			})

		// 			this.#timers_running.delete(timer)

		// 			// Stop timer-indication
		// 			const hasAnotherTimer = Array.from(this.#timers_running.values()).find((v) => v === controlId)
		// 			if (hasAnotherTimer === undefined) {
		// 				this.#setControlIsRunning(controlId, false)
		// 			}
		// 		}, delay_time)

		// 		this.#timers_running.set(timer, controlId)
		// 	}

		// 	// or is it immediate
		// 	else {
		// 		this.#runAction(action, extra2).catch((e) => {
		// 			this.logger.silly(`Error executing action for ${action.instance}: ${e.message ?? e}`)
		// 		})
		// 	}
		// }

		// if (has_delayed) {
		// 	// Start timer-indication
		// 	this.#setControlIsRunning(controlId, true)
		// }
	}
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
		actions: ActionInstance[],
		relative_delay: boolean,
		extras: Omit<RunActionExtras, 'controlId' | 'location' | 'abortDelayed'>
	): Promise<void> {
		const controller = new AbortController()

		const chainId = nanoid()
		this.#runningChains.set(chainId, controller)

		// If this is the first chain, trigger a redraw
		if (this.#runningChains.size === 1) {
			this.#triggerRedraw()
		}

		return this.#actionRunner
			.runMultipleActions(actions, this.#controlId, relative_delay, {
				...extras,
				abortDelayed: controller.signal,
			})
			.finally(() => {
				// If this removes the last chain, trigger a redraw
				if (this.#runningChains.delete(chainId) && this.#runningChains.size === 0) {
					this.#triggerRedraw()
				}
			})
	}

	abortAll(): boolean {
		if (this.#runningChains.size === 0) {
			return false
		}

		for (const controller of this.#runningChains.values()) {
			controller.abort()
		}
		this.#runningChains.clear()

		this.#triggerRedraw()

		return true
	}
}

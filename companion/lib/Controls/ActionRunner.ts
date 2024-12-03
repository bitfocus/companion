import { CoreBase } from '../Core/Base.js'
import type { Registry } from '../Registry.js'
import type { RunActionExtras } from '../Instance/Wrapper.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { FragmentActionInstance } from './Fragments/FragmentActionInstance.js'

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
	/**
	 * Timers for all pending delayed actions
	 */
	readonly #timers_running = new Map<NodeJS.Timeout, string>()

	constructor(registry: Registry) {
		super(registry, 'Control/ActionRunner')
	}

	/**
	 * Abort all pending delayed actions
	 */
	abortAllDelayed(): void {
		this.logger.silly('Aborting delayed actions')

		const affectedControlIds = new Set<string>()

		// Clear the timers
		for (const [timer, controlId] of this.#timers_running.entries()) {
			clearTimeout(timer)
			affectedControlIds.add(controlId)
		}
		this.#timers_running.clear()

		// Redraw any controls
		for (const controlId of affectedControlIds.values()) {
			this.#setControlIsRunning(controlId, false)
		}
	}

	/**
	 * Abort pending delayed actions for a control
	 * @param controlId Id of the control
	 * @param skip_up Mark button as released
	 */
	abortControlDelayed(controlId: string, skip_up: boolean): void {
		// Clear any timers
		let cleared = false
		for (const [timer, timerControlId] of this.#timers_running.entries()) {
			if (timerControlId === controlId) {
				if (!cleared) {
					this.logger.silly(`Aborting delayed actions on ${controlId}`)
					cleared = true
				}

				this.#timers_running.delete(timer)
				clearTimeout(timer)
			}
		}

		// Update control
		this.#setControlIsRunning(controlId, false, skip_up)
	}

	/**
	 * Abort pending delayed actions for a page
	 * @param pageNumber Page to abort actions for
	 * @param skipLocations locations to skip
	 */
	abortPageDelayed(pageNumber: number, skipLocations?: ControlLocation[]) {
		const controlIds = new Set(this.page.getAllControlIdsOnPage(pageNumber))

		// Remove any skipped locations
		for (const location of skipLocations || []) {
			if (location.pageNumber == pageNumber) {
				const controlId = this.page.getControlIdAt(location)
				if (controlId) controlIds.delete(controlId)
			}
		}

		for (const controlId of controlIds) {
			// Abort the actions
			this.abortControlDelayed(controlId, false)
		}
	}

	/**
	 * Run a single action
	 */
	#runAction(action: FragmentActionInstance, extras: RunActionExtras): void {
		if (action.connectionId === 'internal') {
			this.internalModule.executeAction(action.asActionInstance(), extras)
		} else {
			const instance = this.instance.moduleHost.getChild(action.connectionId)
			if (instance) {
				instance.actionRun(action.asActionInstance(), extras).catch((e) => {
					this.logger.silly(`Error executing action for ${instance.connectionId}: ${e.message ?? e}`)
				})
			} else {
				this.logger.silly('trying to run action on a missing instance.', action)
			}
		}
	}

	/**
	 * Inform a control whether actions are running
	 */
	#setControlIsRunning(controlId: string, running: boolean, skip_up?: boolean) {
		const control = this.controls.getControl(controlId)
		if (control && control.supportsActions) {
			control.setActionsRunning(running, skip_up ?? false)
		}
	}

	/**
	 * Run multiple actions
	 */
	runMultipleActions(
		actions0: FragmentActionInstance[],
		controlId: string,
		relative_delay: boolean,
		extras: Omit<RunActionExtras, 'controlId' | 'location'>
	): void {
		const actions = actions0.filter((act) => !act.disabled)

		console.log('run', actions)

		if (actions.length === 0) {
			return
		}

		// Handle whether the delays are absolute or relative.
		const effective_delays: Record<string, number> = {}
		let tmp_delay = 0
		for (const action of actions) {
			if (relative_delay) {
				// Relative delay: each action's delay adds to the next.
				tmp_delay += action.delay
			} else {
				// Absolute delay: each delay is its own.
				tmp_delay = action.delay
			}

			// Create the property .effective_delay. Don't change the user's .delay property.
			effective_delays[action.id] = tmp_delay
		}

		const location = this.page.getLocationOfControlId(controlId)
		const extra2: RunActionExtras = {
			...(extras || {}),
			location,
			controlId,
		}

		let has_delayed = false
		for (const action of actions) {
			const delay_time = effective_delays[action.id] === undefined ? 0 : effective_delays[action.id]

			this.logger.silly('Running action', action)

			// is this a timedelayed action?
			if (delay_time > 0) {
				has_delayed = true
				const timer = setTimeout(() => {
					this.#runAction(action, extra2)

					this.#timers_running.delete(timer)

					// Stop timer-indication
					const hasAnotherTimer = Array.from(this.#timers_running.values()).find((v) => v === controlId)
					if (hasAnotherTimer === undefined) {
						this.#setControlIsRunning(controlId, false)
					}
				}, delay_time)

				this.#timers_running.set(timer, controlId)
			}

			// or is it immediate
			else {
				this.#runAction(action, extra2)
			}
		}

		if (has_delayed) {
			// Start timer-indication
			this.#setControlIsRunning(controlId, true)
		}
	}
}

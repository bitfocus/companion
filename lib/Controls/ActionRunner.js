import CoreBase from '../Core/Base.js'
import { ParseControlId } from '../Resources/Util.js'

/**
 * Class to handle execution of actions.
 *
 * @extends CoreBase
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
export default class ActionRunner extends CoreBase {
	/**
	 * Timers for all pending delayed actions
	 * @access private
	 */
	#timers_running = new Map()

	/**
	 * @param {Registry} registry - the application core
	 */
	constructor(registry) {
		super(registry, 'action-runner', 'Control/ActionRunner')
	}

	/**
	 * Abort all pending delayed actions
	 * @access public
	 */
	abortAllDelayed() {
		this.logger.silly('Aborting delayed actions')

		const affectedControlIds = new Set()

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
	 * @param {string} controlId Id of the control
	 * @param {boolean} skip_up Mark button as released
	 * @access public
	 */
	abortControlDelayed(controlId, skip_up) {
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
	 * Run a single action
	 * @param {*} action
	 * @param {*} extras
	 * @access private
	 */
	#runAction(action, extras) {
		if (action.instance === 'internal') {
			this.internalModule.executeAction(action, extras)
		} else {
			const instance = this.instance.moduleHost.getChild(action.instance)
			if (instance) {
				instance.actionRun(action, extras).catch((e) => {
					this.logger.silly(`Error executing action for ${instance.connectionId}: ${e.message ?? e}`)
				})
			} else {
				this.logger.silly('trying to run action on a missing instance.', action)
			}
		}
	}

	/**
	 * Inform a control whether actions are running
	 * @param {string} controlId
	 * @param {boolean} running
	 * @param {boolean} skip_up
	 */
	#setControlIsRunning(controlId, running, skip_up) {
		const control = this.controls.getControl(controlId)
		if (control && typeof control.setActionsRunning === 'function') {
			control.setActionsRunning(running, skip_up)
		}
	}

	/**
	 * Run multiple actions
	 * @param {Array<object>} actions
	 * @param {string} controlId
	 * @param {boolean} relative_delay
	 * @param {object} extras
	 * @access public
	 */
	runMultipleActions(actions, controlId, relative_delay, extra) {
		if (actions.length === 0) {
			return
		}

		// Handle whether the delays are absolute or relative.
		const effective_delays = {}
		let tmp_delay = 0
		for (const action of actions) {
			let this_delay = !action.delay ? 0 : parseInt(action.delay)
			if (isNaN(this_delay)) this_delay = 0

			if (relative_delay) {
				// Relative delay: each action's delay adds to the next.
				tmp_delay += this_delay
			} else {
				// Absolute delay: each delay is its own.
				tmp_delay = this_delay
			}

			// Create the property .effective_delay. Don't change the user's .delay property.
			effective_delays[action.id] = tmp_delay
		}

		const extra2 = {
			...(extra || {}),
			controlId,
		}
		const parsed = ParseControlId(controlId)
		if (parsed?.type === 'bank') {
			extra2.page = parsed.page
			extra2.bank = parsed.bank
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

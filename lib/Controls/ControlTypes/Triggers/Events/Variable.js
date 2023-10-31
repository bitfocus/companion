import LogController from '../../../../Log/Controller.js'

/** @typedef {{ id: string, variableId: string }} VariableChangeEvent */

/**
 * This is the runner for variables based trigger events
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
export default class TriggersEventVariables {
	/**
	 * Whether the trigger is currently enabled
	 * @type {boolean}
	 * @access private
	 */
	#enabled = false

	/**
	 * Shared event bus, across all triggers
	 * @type {import('../../../TriggerEvents.js').default}
	 * @access private
	 */
	#eventBus

	/**
	 * Execute the actions of the parent trigger
	 * @type {(nowTime: number) => void}
	 * @access private
	 */
	#executeActions

	/**
	 * The logger for this class
	 * @type {import('winston').Logger}
	 * @access protected
	 */
	#logger

	/**
	 * Enabled time of day events
	 * @type {VariableChangeEvent[]}
	 * @access private
	 */
	#variableChangeEvents = []

	/**
	 * @param {import('../../../TriggerEvents.js').default} eventBus
	 * @param {string} controlId
	 * @param {(nowTime: number) => void} executeActions
	 */
	constructor(eventBus, controlId, executeActions) {
		this.#logger = LogController.createLogger(`Controls/Triggers/Events/Timer/${controlId}`)

		this.#eventBus = eventBus
		this.#executeActions = executeActions

		this.#eventBus.on('variables_changed', this.#onVariablesChanged)
	}

	/**
	 * Destroy this event handler
	 * @access public
	 */
	destroy() {
		this.#eventBus.off('variables_changed', this.#onVariablesChanged)
	}

	/**
	 * Get a description for a variable_changed event
	 * @param {import('../Trigger.js').EventInstance} event Event to describe
	 * @returns
	 */
	getVariablesChangedDescription(event) {
		return `When <strong>$(${event.options.variableId})</strong> changes`
	}

	/**
	 * Handler for the variable_changed event
	 * @param {Set<string>} allChangedVariables Set of all the variables that have changed
	 * @access private
	 */
	#onVariablesChanged = (allChangedVariables) => {
		if (this.#enabled) {
			let execute = false

			for (const event of this.#variableChangeEvents) {
				if (allChangedVariables.has(event.variableId)) {
					execute = true
				}
			}

			if (execute) {
				const nowTime = Date.now()

				setImmediate(() => {
					try {
						this.#executeActions(nowTime)
					} catch (/** @type {any} */ e) {
						this.#logger.warn(`Execute actions failed: ${e?.toString?.() ?? e?.message ?? e}`)
					}
				})
			}
		}
	}

	/**
	 * Set whether the events are enabled
	 * @param {boolean} enabled
	 */
	setEnabled(enabled) {
		this.#enabled = enabled
	}

	/**
	 * Add a variable_changed event listener
	 * @param {string} id Id of the event
	 * @param {string} variableId Id of the variable to watch
	 */
	setVariableChanged(id, variableId) {
		this.clearVariableChanged(id)

		this.#variableChangeEvents.push({
			id,
			variableId,
		})
	}

	/**
	 * Remove a variable_changed event listener
	 * @param {string} id Id of the event
	 */
	clearVariableChanged(id) {
		this.#variableChangeEvents = this.#variableChangeEvents.filter((int) => int.id !== id)
	}
}

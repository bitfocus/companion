import LogController, { Logger } from '../../../../Log/Controller.js'
import type { TriggerEvents } from '../../../../Controls/TriggerEvents.js'
import type { EventInstance } from '@companion-app/shared/Model/EventModel.js'
import { TriggerExecutionSource } from '../TriggerExecutionSource.js'

interface VariableChangeEvent {
	id: string
	variableId: string
}

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
export class TriggersEventVariables {
	/**
	 * Whether the trigger is currently enabled
	 */
	#enabled: boolean = false

	/**
	 * Shared event bus, across all triggers
	 */
	readonly #eventBus: TriggerEvents

	/**
	 * Execute the actions of the parent trigger
	 */
	readonly #executeActions: (nowTime: number, source: TriggerExecutionSource) => void

	/**
	 * The logger for this class
	 */
	readonly #logger: Logger

	/**
	 * Enabled time of day events
	 */
	#variableChangeEvents: VariableChangeEvent[] = []

	constructor(
		eventBus: TriggerEvents,
		controlId: string,
		executeActions: (nowTime: number, source: TriggerExecutionSource) => void
	) {
		this.#logger = LogController.createLogger(`Controls/Triggers/Events/Timer/${controlId}`)

		this.#eventBus = eventBus
		this.#executeActions = executeActions

		this.#eventBus.on('variables_changed', this.#onVariablesChanged)
	}

	/**
	 * Destroy this event handler
	 */
	destroy(): void {
		this.#eventBus.off('variables_changed', this.#onVariablesChanged)
	}

	/**
	 * Get a description for a variable_changed event
	 */
	getVariablesChangedDescription(event: EventInstance): string {
		return `When <strong>$(${event.options.variableId})</strong> changes`
	}

	/**
	 * Handler for the variable_changed event
	 * @param allChangedVariables Set of all the variables that have changed
	 */
	#onVariablesChanged = (allChangedVariables: Set<string>): void => {
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
						this.#executeActions(nowTime, TriggerExecutionSource.Other)
					} catch (e: any) {
						this.#logger.warn(`Execute actions failed: ${e?.toString?.() ?? e?.message ?? e}`)
					}
				})
			}
		}
	}

	/**
	 * Set whether the events are enabled
	 */
	setEnabled(enabled: boolean): void {
		this.#enabled = enabled
	}

	/**
	 * Add a variable_changed event listener
	 * @param id Id of the event
	 * @param variableId Id of the variable to watch
	 */
	setVariableChanged(id: string, variableId: string): void {
		this.clearVariableChanged(id)

		this.#variableChangeEvents.push({
			id,
			variableId,
		})
	}

	/**
	 * Remove a variable_changed event listener
	 * @param id Id of the event
	 */
	clearVariableChanged(id: string): void {
		this.#variableChangeEvents = this.#variableChangeEvents.filter((int) => int.id !== id)
	}
}

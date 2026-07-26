import type { EventInstance } from '@companion-app/shared/Model/EventModel.js'
import { stringifyVariableValue } from '@companion-app/shared/Model/Variables.js'
import type { TriggerEvents } from '../../../../Controls/TriggerEvents.js'
import LogController, { type Logger } from '../../../../Log/Controller.js'
import { TriggerExecutionSource } from '../TriggerExecutionSource.js'

interface VariableChangeEvent {
	id: string
	variableId: string
}

/**
 * Minimum interval between variable-change-driven executions of a single trigger.
 * The first change in an idle period fires immediately (leading edge); rapid bursts
 * or feedback loops are capped to roughly one execution per this interval, keeping
 * Companion responsive. See issue #3312.
 */
const VARIABLE_TRIGGER_THROTTLE_MS = 50

/**
 * How long after the last throttled execution the "rate limited" flag is cleared.
 * The flag stays set for the duration of a loop (each throttled execution resets this
 * timer) and clears shortly after the loop stops.
 */
const RATE_LIMIT_CLEAR_MS = 1000

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
	 * The control id of the parent trigger
	 */
	readonly #controlId: string

	/**
	 * Execute the actions of the parent trigger
	 */
	readonly #executeActions: (nowTime: number, source: TriggerExecutionSource) => void

	/**
	 * Report whether this trigger is currently being rate-limited
	 */
	readonly #setRateLimited: (limited: boolean) => void

	/**
	 * The logger for this class
	 */
	readonly #logger: Logger

	/**
	 * Enabled time of day events
	 */
	#variableChangeEvents: VariableChangeEvent[] = []

	/**
	 * Time of the last execution, used to throttle the rate of variable-driven executions
	 */
	#lastExecutedAt = 0

	/**
	 * Timer for a pending coalesced (trailing) execution, when one is scheduled
	 */
	#trailingTimer: NodeJS.Timeout | null = null

	/**
	 * Whether the trigger is currently flagged as being rate-limited
	 */
	#isRateLimited = false

	/**
	 * Timer to clear the rate-limited flag once the rapid firing stops
	 */
	#rateLimitClearTimer: NodeJS.Timeout | null = null

	constructor(
		eventBus: TriggerEvents,
		controlId: string,
		executeActions: (nowTime: number, source: TriggerExecutionSource) => void,
		setRateLimited: (limited: boolean) => void
	) {
		this.#logger = LogController.createLogger(`Controls/Triggers/Events/Variables/${controlId}`)

		this.#eventBus = eventBus
		this.#controlId = controlId
		this.#executeActions = executeActions
		this.#setRateLimited = setRateLimited

		this.#eventBus.on('variables_changed', this.#onVariablesChanged)
	}

	/**
	 * Destroy this event handler
	 */
	destroy(): void {
		this.#eventBus.off('variables_changed', this.#onVariablesChanged)

		if (this.#trailingTimer) {
			clearTimeout(this.#trailingTimer)
			this.#trailingTimer = null
		}
		if (this.#rateLimitClearTimer) {
			clearTimeout(this.#rateLimitClearTimer)
			this.#rateLimitClearTimer = null
		}
		if (this.#isRateLimited) {
			this.#isRateLimited = false
			this.#setRateLimited(false)
		}
	}

	/**
	 * Get a description for a variable_changed event
	 */
	getVariablesChangedDescription(event: EventInstance): string {
		return `When <strong>$(${stringifyVariableValue(event.options.variableId) ?? 'Unknown'})</strong> changes`
	}

	/**
	 * Handler for the variable_changed event
	 * @param allChangedVariables Set of all the variables that have changed
	 */
	#onVariablesChanged = (
		allChangedVariables: ReadonlySet<string>,
		controlIdFilter: ReadonlySet<string> | null
	): void => {
		// If the change is scoped to specific control(s) and this trigger isn't one of them, ignore it
		if (controlIdFilter && !controlIdFilter.has(this.#controlId)) return

		if (this.#enabled) {
			let execute = false

			for (const event of this.#variableChangeEvents) {
				if (allChangedVariables.has(event.variableId)) {
					execute = true
				}
			}

			if (execute) {
				this.#scheduleExecution()
			}
		}
	}

	/**
	 * Schedule an execution of the trigger actions, throttled to avoid runaway feedback loops.
	 * A single change in an idle period fires immediately (leading edge); changes arriving within
	 * the throttle window are coalesced into a single trailing execution at the end of the window.
	 */
	#scheduleExecution(): void {
		const now = Date.now()
		const sinceLast = now - this.#lastExecutedAt

		if (sinceLast >= VARIABLE_TRIGGER_THROTTLE_MS && !this.#trailingTimer) {
			// Leading edge - enough time has passed, so fire immediately
			this.#runExecute(now)
		} else {
			// Within the throttle window - we are rate-limiting this trigger
			this.#markRateLimited()

			if (!this.#trailingTimer) {
				// Schedule a single coalesced execution at the end of the window
				this.#trailingTimer = setTimeout(
					() => {
						this.#trailingTimer = null
						this.#runExecute(Date.now())
					},
					Math.max(0, VARIABLE_TRIGGER_THROTTLE_MS - sinceLast)
				)
			}
			// else: a trailing execution is already pending, so coalesce into it (do nothing)
		}
	}

	/**
	 * Run the trigger actions now, recording the time for throttling purposes
	 */
	#runExecute(now: number): void {
		this.#lastExecutedAt = now

		if (!this.#enabled) return // Re-check, as this may run after a delay

		try {
			this.#executeActions(now, TriggerExecutionSource.Other)
		} catch (e: any) {
			this.#logger.warn(`Execute actions failed: ${e?.toString?.() ?? e?.message ?? e}`)
		}
	}

	/**
	 * Flag the trigger as being rate-limited, and (re)start the timer to clear the flag once
	 * the rapid firing stops
	 */
	#markRateLimited(): void {
		if (!this.#isRateLimited) {
			this.#isRateLimited = true
			this.#setRateLimited(true)
		}

		if (this.#rateLimitClearTimer) clearTimeout(this.#rateLimitClearTimer)
		this.#rateLimitClearTimer = setTimeout(() => {
			this.#rateLimitClearTimer = null
			this.#isRateLimited = false
			this.#setRateLimited(false)
		}, RATE_LIMIT_CLEAR_MS)
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

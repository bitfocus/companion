/**
 * This is a special event runner, it operates for
 */
export default class TriggersEventInterval {
	/**
	 * The logger for this class
	 * @type {winston.Logger}
	 * @access protected
	 */
	logger

	#executeActions

	#intervals = []

	#eventBus

	#enabled = false
	#lastTick

	constructor(registry, eventBus, controlId, executeActions) {
		this.logger = registry.log.createLogger(`Controls/Triggers/Events/Interval/${controlId}`)

		this.#eventBus = eventBus
		this.#executeActions = executeActions

		this.#lastTick = eventBus.getLastTickTime()
		this.#eventBus.on('tick', this.#onTick)
	}

	destroy() {
		this.#eventBus.off('tick', this.#onTick)
	}

	#onTick = (tickSeconds, nowTime) => {
		if (this.#enabled) {
			let execute = false

			for (const interval of this.#intervals) {
				// Check if this interval should cause an execution
				if (interval.lastExecute + interval.period <= tickSeconds) {
					execute = true
					interval.lastExecute = tickSeconds
				}
			}

			if (execute) {
				setImmediate(() => {
					try {
						this.#executeActions(nowTime)
					} catch (e) {
						this.logger.warn(`Execute actions failed: ${e?.toString?.() ?? e?.message ?? e}`)
					}
				})
			}
		}
		this.#lastTick = tickSeconds
	}

	setEnabled(enabled) {
		if (!this.#enabled && enabled) {
			// Reset all the intervals, to be based from the next tick
			for (const interval of this.#intervals) {
				interval.lastExecute = this.#lastTick + 1
			}
		}

		this.#enabled = enabled
	}

	setInterval(id, period) {
		this.clearInterval(id)

		if (period && period > 0) {
			this.#intervals.push({
				id,
				period,
				lastExecute: this.#lastTick + 1,
			})
		}
	}
	clearInterval(id) {
		this.#intervals = this.#intervals.filter((int) => int.id !== id)
	}
}

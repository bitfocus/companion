/**
 * This is a special event runner, it operates for
 */
export default class TriggersEventTimer {
	/**
	 * The logger for this class
	 * @type {winston.Logger}
	 * @access protected
	 */
	logger

	#executeActions

	#intervals = []
	#timeofday = []

	#eventBus

	#enabled = false
	#lastTick

	constructor(registry, eventBus, controlId, executeActions) {
		this.logger = registry.log.createLogger(`Controls/Triggers/Events/Timer/${controlId}`)

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

			for (const tod of this.#timeofday) {
				// check if this timeofday should cause an execution
				if (tod.nextExecute && tod.nextExecute <= nowTime) {
					execute = true
					tod.nextExecute = this.#getNextExecuteTime(tod.time)
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

	setTimeOfDay(id, time) {
		this.clearTimeOfDay(id)

		this.#timeofday.push({
			id,
			time,
			nextExecute: this.#getNextExecuteTime(time),
		})
	}
	clearTimeOfDay(id) {
		this.#timeofday = this.#timeofday.filter((tod) => tod.id !== id)
	}

	#getNextExecuteTime(time) {
		if (typeof time.time !== 'string' || !Array.isArray(time.days) || !time.days.length) return null

		const timeMatch = time.time.match(/^(0[0-9]|1[0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])$/i)
		if (!timeMatch) return null
		const parsedDays = time.days.map(Number)

		const res = new Date()
		const now = res.getTime()

		// set the time to that specified
		res.setHours(Number(timeMatch[1]), Number(timeMatch[2]), Number(timeMatch[3]), 0)

		// if time is in the past, shift it forwards to the next possible day
		if (res.getTime() < now) {
			res.setDate(res.getDate() + 1)
		}

		// ensure the time is for the correct day
		const currentDay = res.getDay()
		if (!parsedDays.includes(currentDay)) {
			let nextDay = null

			const futureDays = time.days.filter((d) => d > currentDay)
			if (futureDays.length > 0) {
				// find the first day in the remainder of the week
				nextDay = futureDays.reduce((first, cand) => Math.min(first, cand), futureDays[0])
			} else {
				// find the first day next week
				const firstDay = parsedDays.reduce((first, cand) => Math.min(first, cand), 7)
				nextDay = 7 + firstDay
			}

			if (nextDay === null) return null // No day was found somehow...

			// Adjust the date, this will wrap the month by itself
			res.setDate(res.getDate() + nextDay - currentDay)
		}

		return res.getTime()
	}
}

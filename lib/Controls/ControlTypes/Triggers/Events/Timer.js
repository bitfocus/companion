import moment from 'moment'

/**
 * This is a special event runner, it operates for
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
export default class TriggersEventTimer {
	/**
	 * Whether the trigger is currently enabled
	 * @type {boolean}
	 * @access private
	 */
	#enabled = false
	/**
	 * Shared event bus, across all triggers
	 * @type {EventEmitter}
	 * @access private
	 */
	#eventBus

	/**
	 * Execute the actions of the parent trigger
	 * @type {Function}
	 * @access private
	 */
	#executeActions

	/**
	 * Enabled time interval events
	 * @type {Array}
	 * @access private
	 */
	#intervalEvents = []

	/**
	 * The last tick received from the clock
	 * @type {number}
	 * @access private
	 */
	#lastTick

	/**
	 * The logger for this class
	 * @type {winston.Logger}
	 * @access protected
	 */
	logger

	/**
	 * Enabled time of day events
	 * @type {Array}
	 * @access private
	 */
	#timeOfDayEvents = []

	constructor(registry, eventBus, controlId, executeActions) {
		this.logger = registry.log.createLogger(`Controls/Triggers/Events/Timer/${controlId}`)

		this.#eventBus = eventBus
		this.#executeActions = executeActions

		this.#lastTick = eventBus.getLastTickTime()
		this.#eventBus.on('tick', this.#onTick)
	}

	/**
	 * Destroy this event handler
	 * @access public
	 */
	destroy() {
		this.#eventBus.off('tick', this.#onTick)
	}

	/**
	 * Get a description for an interval event
	 * @param {Object} event Event to describe
	 * @returns
	 */
	getIntervalDescription(event) {
		let time = `${event.options.seconds} seconds`
		if (event.options.seconds >= 3600) {
			time = `${Math.floor(event.options.seconds / 3600)} hours`
		} else if (event.options.seconds >= 60) {
			time = `${Math.floor(event.options.seconds / 60)} minutes`
		}

		return `Every <strong>${time}</strong>.`
	}

	/**
	 * Calculate the next unix time that an timeofday event should execute at
	 * @param {Object} time - time details for timeofday event
	 * @returns
	 */
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

	/**
	 * Get a description for a time of day event
	 * @param {Object} event Event to describe
	 * @returns
	 */
	getTimeOfDayDescription(event) {
		let day_str = 'Unknown'
		if (event.options.days) {
			const days = [...event.options.days].sort()
			const days_tmp = days.toString()

			if (days.length === 7) {
				day_str = 'Daily'
			} else if (days_tmp === '1,2,3,4,5') {
				day_str = 'Weekdays'
			} else if (days_tmp === '0,6') {
				day_str = 'Weekends'
			} else {
				try {
					day_str = days.map((d) => moment().weekday(d).format('ddd')).join(', ')
				} catch (e) {
					day_str = 'Error'
				}
			}
		}

		return `<strong>${day_str}</strong>, ${event.options.time}`
	}

	/**
	 * Handler for the timer tick event
	 * @param {number} tickSeconds Number of ticks since application startup
	 * @param {number} nowTime Current wall time of the event
	 * @access private
	 */
	#onTick = (tickSeconds, nowTime) => {
		if (this.#enabled) {
			let execute = false

			for (const interval of this.#intervalEvents) {
				// Check if this interval should cause an execution
				if (interval.lastExecute + interval.period <= tickSeconds) {
					execute = true
					interval.lastExecute = tickSeconds
				}
			}

			for (const tod of this.#timeOfDayEvents) {
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

	/**
	 * Set whether the events are enabled
	 * @param {boolean} enabled
	 */
	setEnabled(enabled) {
		if (!this.#enabled && enabled) {
			// Reset all the intervals, to be based from the next tick
			for (const interval of this.#intervalEvents) {
				interval.lastExecute = this.#lastTick + 1
			}
		}

		this.#enabled = enabled
	}

	/**
	 * Add an interval event listener
	 * @param {string} id Id of the event
	 * @param {boolean} period Time interval of the trigger (in seconds)
	 */
	setInterval(id, period) {
		this.clearInterval(id)

		if (period && period > 0) {
			this.#intervalEvents.push({
				id,
				period,
				lastExecute: this.#lastTick + 1,
			})
		}
	}

	/**
	 * Remove an interval event listener
	 * @param {string} id Id of the event
	 */
	clearInterval(id) {
		this.#intervalEvents = this.#intervalEvents.filter((int) => int.id !== id)
	}

	/**
	 * Add a timeofday event listener
	 * @param {string} id Id of the event
	 * @param {boolean} time time details
	 */
	setTimeOfDay(id, time) {
		this.clearTimeOfDay(id)

		this.#timeOfDayEvents.push({
			id,
			time,
			nextExecute: this.#getNextExecuteTime(time),
		})
	}

	/**
	 * Remove a timeofday event listener
	 * @param {string} id Id of the event
	 */
	clearTimeOfDay(id) {
		this.#timeOfDayEvents = this.#timeOfDayEvents.filter((tod) => tod.id !== id)
	}
}

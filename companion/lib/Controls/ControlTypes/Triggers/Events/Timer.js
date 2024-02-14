import dayjs from 'dayjs'
import LogController from '../../../../Log/Controller.js'

/** @typedef {{ id: string, period: number, lastExecute: number }} IntervalEvent */
/** @typedef {{ id: string, time: Record<string, any>, nextExecute: number | null }} TimeOfDayEvent */
/** @typedef {{ id: string, params: Record<string, any>, nextExecute: number }} SunEvent */

/** @typedef {{ type: 'sunset' | 'sunrise', latitude: number, longitude: number, offset: number}} SunEventParams */
/** @typedef {{ time: string, days: number[] }} TimeOfDayEventParams */

/**
 * This is the runner for time based trigger events
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
	 * Enabled time interval events
	 * @type {IntervalEvent[]}
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
	 * @type {import('winston').Logger}
	 * @access protected
	 */
	#logger

	/**
	 * Enabled time of day events
	 * @type {TimeOfDayEvent[]}
	 * @access private
	 */
	#timeOfDayEvents = []

	/**
	 * Enable sun based events
	 * @type {SunEvent[]}
	 * @access private
	 */
	#sunEvents = []

	/**
	 * @param {import('../../../TriggerEvents.js').default} eventBus
	 * @param {string} controlId
	 * @param {(nowTime: number) => void} executeActions
	 */
	constructor(eventBus, controlId, executeActions) {
		this.#logger = LogController.createLogger(`Controls/Triggers/Events/Timer/${controlId}`)

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
	 * @param {import('../Trigger.js').EventInstance} event Event to describe
	 * @returns
	 */
	getIntervalDescription(event) {
		const seconds = Number(event.options.seconds)

		let time = `${seconds} seconds`
		if (seconds >= 3600) {
			time = `${Math.floor(seconds / 3600)} hours`
		} else if (seconds >= 60) {
			time = `${Math.floor(seconds / 60)} minutes`
		}

		return `Every <strong>${time}</strong>`
	}

	/**
	 * Calculate the next unix time that an timeofday event should execute at
	 * @param {Record<string, any>} time - time details for timeofday event
	 * @returns {number | null}
	 */
	#getNextTODExecuteTime(time) {
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
	 * @param {import('../Trigger.js').EventInstance} event Event to describe
	 * @returns
	 */
	getTimeOfDayDescription(event) {
		let day_str = 'Unknown'
		if (event.options.days) {
			// @ts-ignore
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
					day_str = days.map((d) => dayjs().day(d).format('ddd')).join(', ')
				} catch (e) {
					day_str = 'Error'
				}
			}
		}

		return `<strong>${day_str}</strong>, ${event.options.time}`
	}

	/**
	 * Calculate the next unix time that an sunrise or set event should execute at
	 * @param {Record<string, any>} input
	 * @returns
	 */

	#getNextSunExecuteTime(input) {
		let latitude = input.latitude
		let longitude = input.longitude
		let offset = input.offset

		// convert 0 or 1 to sunrise or sunset
		let sunset = input.type == 'sunset'

		// get sunrise/set time for today (nextDay is set to 0)
		let time = getSunEvent(sunset, latitude, longitude, offset, 0)

		// if time is in the past, get the sun event for the next day
		const now = new Date()
		if (time < now) {
			// call the function for tomorrow (nextDay is set to 1)
			time = getSunEvent(sunset, latitude, longitude, offset, 1)
		}

		return time.getTime()

		// Modified function to calculate the sunrise/set time by adam-carter-fms
		// https://gist.github.com/adam-carter-fms/a44a14c0a8cdacbbc38276f6d553e024#file-sunriseset-js-L12
		/**
		 * @param {boolean} sunset
		 * @param {number} latitude
		 * @param {number} longitude
		 * @param {number} offset
		 * @param {number} nextDay
		 */
		function getSunEvent(sunset, latitude, longitude, offset, nextDay) {
			const res = new Date()
			res.setDate(res.getDate() + nextDay)
			const now = res

			let start = new Date(now.getFullYear(), 0, 0)
			// @ts-ignore
			let diff = now - start + (start.getTimezoneOffset() - now.getTimezoneOffset()) * 60 * 1000
			let oneDay = 1000 * 60 * 60 * 24
			let day = Math.floor(diff / oneDay)

			const zenith = 90.83333333333333
			const D2R = Math.PI / 180
			const R2D = 180 / Math.PI

			// convert the longitude to hour value and calculate an approximate time
			let lnHour = longitude / 15
			let t
			if (!sunset) {
				t = day + (6 - lnHour) / 24
			} else {
				t = day + (18 - lnHour) / 24
			}

			// calculate the sun's mean anomaly
			const M = 0.9856 * t - 3.289

			// calculate the sun's true longitude
			let L = M + 1.916 * Math.sin(M * D2R) + 0.02 * Math.sin(2 * M * D2R) + 282.634
			if (L > 360) {
				L = L - 360
			} else if (L < 0) {
				L = L + 360
			}

			// calculate the sun's right ascension
			let RA = R2D * Math.atan(0.91764 * Math.tan(L * D2R))
			if (RA > 360) {
				RA = RA - 360
			} else if (RA < 0) {
				RA = RA + 360
			}

			// right ascension value needs to be in the same quadrant
			const Lquadrant = Math.floor(L / 90) * 90
			const RAquadrant = Math.floor(RA / 90) * 90
			RA = RA + (Lquadrant - RAquadrant)

			// right ascension value needs to be converted into hours
			RA = RA / 15

			const sinDec = 0.39782 * Math.sin(L * D2R)
			const cosDec = Math.cos(Math.asin(sinDec))

			// calculate the sun's local hour angle
			const cosH = (Math.cos(zenith * D2R) - sinDec * Math.sin(latitude * D2R)) / (cosDec * Math.cos(latitude * D2R))
			let H
			if (!sunset) {
				H = 360 - R2D * Math.acos(cosH)
			} else {
				H = R2D * Math.acos(cosH)
			}
			H = H / 15

			// calculate local mean time of rising/setting
			const T = H + RA - 0.06571 * t - 6.622

			// adjust back to UTC
			let UT = T - lnHour
			if (UT > 24) {
				UT = UT - 24
			} else if (UT < 0) {
				UT = UT + 24
			}

			const ms = UT * 60 * 60 * 1000

			const sunEventTime = new Date(ms)
			sunEventTime.setFullYear(now.getFullYear())
			sunEventTime.setMonth(now.getMonth())
			sunEventTime.setDate(now.getDate())

			const temp_minutes = sunEventTime.getMinutes()

			// add offset to time
			sunEventTime.setMinutes(temp_minutes + 60 + offset)
			return sunEventTime
		}
	}

	/**
	 * Get a description for a sun event
	 * @param {import('../Trigger.js').EventInstance} event Event to describe
	 * @returns
	 */
	getSunDescription(event) {
		let type_str = 'Undefined'
		if (event.options.type == 'sunrise') {
			type_str = 'Sunrise'
		} else if (event.options.type == 'sunset') {
			type_str = 'Sunset'
		} else {
			type_str = 'Error'
		}
		return `At <strong>${type_str}</strong>, ${event.options.offset} min offset`
	}

	/**
	 * Handler for the timer tick event
	 * @param {number} tickSeconds Number of ticks since application startup
	 * @param {number} nowTime Current wall time of the event
	 * @access private
	 */
	#onTick = (tickSeconds, nowTime) => {
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
				tod.nextExecute = this.#getNextTODExecuteTime(tod.time)
			}
		}

		for (const sun of this.#sunEvents) {
			// check if this sun event should cause an execution
			if (sun.nextExecute && sun.nextExecute <= nowTime) {
				execute = true
				sun.nextExecute = this.#getNextSunExecuteTime(sun.params)
			}
		}

		if (this.#enabled && execute) {
			setImmediate(() => {
				try {
					this.#executeActions(nowTime)
				} catch (/** @type {any} */ e) {
					this.#logger.warn(`Execute actions failed: ${e?.toString?.() ?? e?.message ?? e}`)
				}
			})
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
	 * @param {number} period Time interval of the trigger (in seconds)
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
	 * @param {Record<string, any>} time time details
	 */
	setTimeOfDay(id, time) {
		this.clearTimeOfDay(id)

		this.#timeOfDayEvents.push({
			id,
			time,
			nextExecute: this.#getNextTODExecuteTime(time),
		})
	}

	/**
	 * Remove a timeofday event listener
	 * @param {string} id Id of the event
	 */
	clearTimeOfDay(id) {
		this.#timeOfDayEvents = this.#timeOfDayEvents.filter((tod) => tod.id !== id)
	}

	/**
	 * Add a sun event listener
	 * @param {string} id Id of the event
	 * @param {Record<string, any>} params parameters: latitude, longitude and offset
	 */
	setSun(id, params) {
		this.clearSun(id)

		this.#sunEvents.push({
			id,
			params,
			nextExecute: this.#getNextSunExecuteTime(params),
		})
	}

	/**
	 * Remove a timeofday event listener
	 * @param {string} id Id of the event
	 */
	clearSun(id) {
		this.#sunEvents = this.#sunEvents.filter((sun) => sun.id !== id)
	}
}

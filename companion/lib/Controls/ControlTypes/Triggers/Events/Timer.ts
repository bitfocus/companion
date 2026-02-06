import dayjs from 'dayjs'
import LogController, { type Logger } from '../../../../Log/Controller.js'
import type { TriggerEvents } from '../../../../Controls/TriggerEvents.js'
import type { EventInstance } from '@companion-app/shared/Model/EventModel.js'
import { TriggerExecutionSource } from '../TriggerExecutionSource.js'
import type { CompanionOptionValues } from '@companion-module/host'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import { stringifyVariableValue } from '@companion-app/shared/Model/Variables.js'

interface IntervalEvent {
	id: string
	period: number
	minperiod?: number
	maxperiod?: number
	lastExecute: number
}
interface TimeOfDayEvent {
	id: string
	time: CompanionOptionValues
	nextExecute: number | null
}
interface SpecificDateEvent {
	id: string
	date: CompanionOptionValues
	nextExecute: number | null
}
interface SunEvent {
	id: string
	params: CompanionOptionValues
	nextExecute: number
}

// interface SunEventParams {
// 	type: 'sunset' | 'sunrise'
// 	latitude: number
// 	longitude: number
// 	offset: number
// }
// interface TimeOfDayEventParams {
// 	time: string
// 	days: number[]
// }

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
 */
export class TriggersEventTimer {
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
	 * Enabled time interval events
	 */
	#intervalEvents: IntervalEvent[] = []

	/**
	 * The last tick received from the clock
	 */
	#lastTick: number

	/**
	 * The logger for this class
	 */
	readonly #logger: Logger

	/**
	 * Enabled time of day events
	 */
	#timeOfDayEvents: TimeOfDayEvent[] = []

	/**
	 * Enabled time of day events
	 */
	#specificDateEvents: SpecificDateEvent[] = []

	/**
	 * Enable sun based events
	 */
	#sunEvents: SunEvent[] = []

	constructor(
		eventBus: TriggerEvents,
		controlId: string,
		executeActions: (nowTime: number, source: TriggerExecutionSource) => void
	) {
		this.#logger = LogController.createLogger(`Controls/Triggers/Events/Timer/${controlId}`)

		this.#eventBus = eventBus
		this.#executeActions = executeActions

		this.#lastTick = eventBus.getLastTickTime()
		this.#eventBus.on('tick', this.#onTick)
	}

	/**
	 * Destroy this event handler
	 */
	destroy(): void {
		this.#eventBus.off('tick', this.#onTick)
	}

	/**
	 * Format a duration in seconds to a human-readable string
	 * @param seconds Duration in seconds
	 * @returns Formatted string like "1:30:00 hours" or "45 seconds"
	 */
	formatSeconds(seconds: number): string {
		// this is somewhat simplified and modified from Utils.ts `msToStamp``
		// (note that dayjs isn't a great option for simple durations, so we hand code it)
		const hours = Math.floor(seconds / 3600)
		const minutes = Math.floor(seconds / 60) % 60
		seconds = Math.ceil(seconds) % 60 // note: ceil is correct only for the current 1-sec time-resolution

		const pad2 = (val: number) => String(val).padStart(2, '0')
		if (hours > 0) {
			return `${hours}:${pad2(minutes)}:${pad2(seconds)} hour${hours + minutes + seconds === 1 ? 's' : ''}`
		} else if (minutes > 0) {
			return `${minutes}:${pad2(seconds)} minute${minutes + seconds === 1 ? 's' : ''}`
		} else {
			return `${seconds} second${seconds === 1 ? '' : 's'}`
		}
	}

	/**
	 * Get a description for an interval event
	 */
	getIntervalDescription(event: EventInstance): string {
		const seconds = Number(event.options.seconds)
		const time = this.formatSeconds(seconds)

		if (seconds <= 0) {
			// setInterval() requires period > 0
			return 'Never: interval must be greater than 0'
		} else {
			return `Every <strong>${time}</strong>`
		}
	}

	/**
	 * Get a description for an interval event
	 */
	getRandomIntervalDescription(event: EventInstance): string {
		// show the actual interval, not what the user typed.
		const iMin = Math.ceil(Number(event.options.minimum))
		const iMax = Math.floor(Number(event.options.maximum))

		if (iMax < iMin) {
			// If illegal range, never trigger
			return 'Never (maximum is less than minimum interval)'
		} else if (iMin <= 0) {
			return 'Never (minimum interval is zero or less)'
		} else {
			return `Every <strong>${this.formatSeconds(iMin)} - ${this.formatSeconds(iMax)}</strong>`
		}
	}

	/**
	 * Calculate the next unix time that an timeofday event should execute at
	 * @param time - time details for timeofday event
	 */
	#getNextTODExecuteTime(time: CompanionOptionValues): number | null {
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

			const futureDays = time.days.filter((d): d is number => {
				const n = Number(d)
				return !isNaN(n) && n > currentDay
			})

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
	 */
	getTimeOfDayDescription(event: EventInstance): string {
		let day_str = 'Unknown'
		if (event.options.days && Array.isArray(event.options.days)) {
			const days = [...event.options.days].map(Number).filter(isNaN).sort()
			const days_tmp = days.toString()

			if (days.length === 7) {
				day_str = 'Daily'
			} else if (days_tmp === '1,2,3,4,5') {
				day_str = 'Weekdays'
			} else if (days_tmp === '0,6') {
				day_str = 'Weekends'
			} else {
				try {
					day_str = days.map((d) => dayjs().day(Number(d)).format('ddd')).join(', ')
				} catch (_e) {
					day_str = 'Error'
				}
			}
		}

		return `<strong>${day_str}</strong>, ${stringifyVariableValue(event.options.time) ?? 'Unknown'}`
	}

	/**
	 * Get a description for a time of day event
	 */
	getSpecificDateDescription(event: EventInstance): string {
		const date_str = event.options.date ? dayjs(event.options.date as string | number).format('YYYY-MM-DD') : 'Unknown'
		const time_str = event.options.time ? stringifyVariableValue(event.options.time) : 'Unknown'

		return `<strong>Once</strong>, on ${date_str} at ${time_str}`
	}

	/**
	 * Calculate the next unix time that an specificDate event should execute at
	 * @param date - date details for specificDate event
	 */
	#getSpecificDateExecuteTime(date: CompanionOptionValues): number | null {
		if (typeof date !== 'object' || !date.date || !date.time) return null

		const res = new Date(
			dayjs(date.date as string | number).format('YYYY-MM-DD') + 'T' + (date.time as string | number)
		)

		// if specific date is in the past, ignore
		const now = new Date()
		if (res < now) return null
		return res.getTime()
	}

	/**
	 * Calculate the next unix time that an sunrise or set event should execute at
	 */

	#getNextSunExecuteTime(input: CompanionOptionValues): number {
		const latitude = Number(input.latitude)
		const longitude = Number(input.longitude)
		const offset = Number(input.offset)

		// convert 0 or 1 to sunrise or sunset
		const sunset = input.type == 'sunset'

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
		function getSunEvent(sunset: boolean, latitude: number, longitude: number, offset: number, nextDay: number): Date {
			const res = new Date()
			res.setDate(res.getDate() + nextDay)
			const now = res

			const start = new Date(now.getFullYear(), 0, 0)
			// @ts-expect-error TS claims dates can't be subtracted, this should be revisited but I don't want to touch what works
			const diff = now - start + (start.getTimezoneOffset() - now.getTimezoneOffset()) * 60 * 1000
			const oneDay = 1000 * 60 * 60 * 24
			const day = Math.floor(diff / oneDay)

			const zenith = 90.83333333333333
			const D2R = Math.PI / 180
			const R2D = 180 / Math.PI

			// convert the longitude to hour value and calculate an approximate time
			const lnHour = longitude / 15
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
	 */
	getSunDescription(event: EventInstance): string {
		let type_str = 'Undefined'
		if (event.options.type == 'sunrise') {
			type_str = 'Sunrise'
		} else if (event.options.type == 'sunset') {
			type_str = 'Sunset'
		} else {
			type_str = 'Error'
		}
		return `At <strong>${type_str}</strong>, ${Number(event.options.offset)} min offset`
	}

	/**
	 * Calculate a new random interval if both min & max period were specified.
	 * Otherwise, do nothing.
	 * For now, limit intervals to integers. Note that the endpoints are inclusive, but strict (if not integers)
	 * @param interval The interval object to update
	 */
	#calcRandomPeriod(interval: IntervalEvent) {
		if (interval.maxperiod !== undefined && interval.minperiod !== undefined) {
			const iMin = Math.ceil(interval.minperiod)
			const iMax = Math.floor(interval.maxperiod)
			if (iMax < iMin || iMin <= 0 || isNaN(iMin) || isNaN(iMax)) {
				// If illegal range, never trigger (and don't make period NaN, although the text-input fields may prevent it from happening)
				interval.period = Infinity
				return
			}
			const newPeriod = iMin + Math.floor(Math.random() * (iMax - iMin + 1))
			interval.period = newPeriod
		}
	}

	/**
	 * Handler for the timer tick event
	 * @param tickSeconds Number of ticks since application startup
	 * @param nowTime Current wall time of the event
	 */
	#onTick = (tickSeconds: number, nowTime: number): void => {
		let execute = false

		for (const interval of this.#intervalEvents) {
			// Check if this interval should cause an execution
			if (interval.lastExecute + interval.period <= tickSeconds) {
				execute = true
				interval.lastExecute = tickSeconds
				// calculate next period if this is a random interval
				this.#calcRandomPeriod(interval)
			}
		}

		for (const tod of this.#timeOfDayEvents) {
			// check if this timeofday should cause an execution
			if (tod.nextExecute && tod.nextExecute <= nowTime) {
				execute = true
				tod.nextExecute = this.#getNextTODExecuteTime(tod.time)
			}
		}

		for (const date of this.#specificDateEvents) {
			// check if this date should cause an execution
			if (date.nextExecute && date.nextExecute <= nowTime) {
				execute = true
				date.nextExecute = this.#getSpecificDateExecuteTime(date.date)
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
					this.#executeActions(nowTime, TriggerExecutionSource.Other)
				} catch (e) {
					this.#logger.warn(`Execute actions failed: ${stringifyError(e)}`)
				}
			})
		}

		this.#lastTick = tickSeconds
	}

	/**
	 * Set whether the events are enabled
	 */
	setEnabled(enabled: boolean): void {
		if (!this.#enabled && enabled) {
			// Reset all the intervals, to be based from the next tick
			for (const interval of this.#intervalEvents) {
				interval.lastExecute = this.#lastTick + 1
				// calculate next period if this is a random interval
				this.#calcRandomPeriod(interval)
			}
		}

		this.#enabled = enabled
	}

	/**
	 * Add an interval event listener
	 * @param id Id of the event
	 * @param period Time interval of the trigger (in seconds). This is the minimum period.
	 * @param maxperiod for the time interval, if using random intervals (in seconds)
	 */
	setInterval(id: string, period: number, maxperiod?: number): void {
		this.clearInterval(id)

		if (period && period > 0) {
			const idx = this.#intervalEvents.push({
				id,
				period,
				minperiod: period,
				maxperiod,
				lastExecute: this.#lastTick + 1,
			})
			// update the period if this is a random interval:
			this.#calcRandomPeriod(this.#intervalEvents[idx - 1])
		}
	}

	/**
	 * Remove an interval event listener
	 */
	clearInterval(id: string): void {
		this.#intervalEvents = this.#intervalEvents.filter((int) => int.id !== id)
	}

	/**
	 * Add a timeofday event listener
	 */
	setTimeOfDay(id: string, time: CompanionOptionValues): void {
		this.clearTimeOfDay(id)

		this.#timeOfDayEvents.push({
			id,
			time,
			nextExecute: this.#getNextTODExecuteTime(time),
		})
	}

	/**
	 * Remove a timeofday event listener
	 * @param id Id of the event
	 */
	clearTimeOfDay(id: string): void {
		this.#timeOfDayEvents = this.#timeOfDayEvents.filter((tod) => tod.id !== id)
	}

	/**
	 * Add a specificDate event listener
	 */
	setSpecificDate(id: string, date: CompanionOptionValues): void {
		this.clearSpecificDate(id)

		this.#specificDateEvents.push({
			id,
			date,
			nextExecute: this.#getSpecificDateExecuteTime(date),
		})
	}

	/**
	 * Remove a specificDate event listener
	 * @param id Id of the event
	 */
	clearSpecificDate(id: string): void {
		this.#specificDateEvents = this.#specificDateEvents.filter((date) => date.id !== id)
	}

	/**
	 * Add a sun event listener
	 */
	setSun(id: string, params: CompanionOptionValues): void {
		this.clearSun(id)

		this.#sunEvents.push({
			id,
			params,
			nextExecute: this.#getNextSunExecuteTime(params),
		})
	}

	/**
	 * Remove a timeofday event listener
	 */
	clearSun(id: string): void {
		this.#sunEvents = this.#sunEvents.filter((sun) => sun.id !== id)
	}
}

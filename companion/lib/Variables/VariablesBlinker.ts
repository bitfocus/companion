import type { GetVariableValueProps } from '@companion-app/shared/Expression/ExpressionResolve.js'
import type { VariableValueEntry } from './Values.js'
import LogController from '../Log/Controller.js'

const CLEANUP_INTERVAL = 30_000 // 30 seconds
const CLEANUP_EXPIRY = 10 // 10 iterations

const MIN_INTERVAL = 50 // 50 ms

type IntervalId = `${number}:${number}`

export class VariablesBlinker {
	readonly #logger = LogController.createLogger('Variables/Blinker')

	readonly #emitChange: (values: VariableValueEntry[]) => void

	readonly #intervals = new Map<IntervalId, BlinkingInterval>()

	constructor(emitChange: (values: VariableValueEntry[]) => void) {
		this.#emitChange = emitChange

		// Start a cleanup routine, to stop any unused intervals
		setInterval(() => {
			for (const [key, entry] of this.#intervals) {
				if (Date.now() - entry.lastProbed > entry.interval * CLEANUP_EXPIRY) {
					this.#logger.debug(`Cleaning up unused blinker interval: ${entry.onPeriod}ms/${entry.offPeriod}ms`)

					if (entry.handle) clearInterval(entry.handle)
					entry.aborted = true
					this.#intervals.delete(key)
				}
			}
		}, CLEANUP_INTERVAL)
	}

	trackDependencyOnInterval(interval: number, dutyCycle: number): GetVariableValueProps | null {
		if (isNaN(interval) || interval <= 0 || isNaN(dutyCycle)) return null
		if (interval < MIN_INTERVAL) interval = MIN_INTERVAL

		dutyCycle = Math.min(Math.max(dutyCycle, 0), 1)

		const onPeriod = Math.ceil(interval * dutyCycle)
		const offPeriod = Math.floor(interval * (1 - dutyCycle))
		const intervalId = `${onPeriod}:${offPeriod}` as const

		// Check if already running
		const entry = this.#intervals.get(intervalId)
		if (entry) {
			// Update last probed time
			entry.lastProbed = Date.now()

			// Return the variable name
			return entry.name
		}

		this.#logger.debug(`Starting new blinker interval: ${onPeriod}ms/${offPeriod}ms`)

		const newEntry: BlinkingInterval = {
			interval: interval,
			onPeriod: onPeriod,
			offPeriod: offPeriod,
			lastProbed: Date.now(),
			name: {
				variableId: `internal:__interval_${onPeriod}_${offPeriod}`,
				label: 'internal',
				name: `__interval_${onPeriod}_${offPeriod}`,
			},
			aborted: false,
			handle: null,
			value: false,
		}
		this.#intervals.set(intervalId, newEntry)

		// Calculate the time until the next aligned tick. Do this relative to unix epoch to keep all intervals aligned amongst each other and across restarts
		const timeToNextTick = interval - (Date.now() % interval)

		// Start the interval after the calculated delay
		setTimeout(() => {
			if (newEntry.aborted) return

			// First tick
			newEntry.value = true
			this.#emitChange([
				{
					id: newEntry.name.name,
					value: newEntry.value,
				},
			])

			// Subsequent ticks
			const scheduleNextTick = () => {
				if (newEntry.aborted) return

				// If currently true, wait onPeriod before turning off
				// If currently false, wait offPeriod before turning on
				const delay = newEntry.value ? newEntry.onPeriod : newEntry.offPeriod

				newEntry.handle = setTimeout(() => {
					if (newEntry.aborted) return

					newEntry.value = !newEntry.value

					// TODO - could/should these be batched? to make it cheaper when timers align
					this.#emitChange([
						{
							id: newEntry.name.name,
							value: newEntry.value,
						},
					])

					scheduleNextTick()
				}, delay)
			}

			scheduleNextTick()
		}, timeToNextTick)

		return newEntry.name
	}
}

interface BlinkingInterval {
	readonly interval: number
	readonly onPeriod: number
	readonly offPeriod: number
	lastProbed: number

	readonly name: GetVariableValueProps

	aborted: boolean
	handle: NodeJS.Timeout | null
	value: boolean
}

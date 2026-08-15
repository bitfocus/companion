import type { GetVariableValueProps } from '@companion-app/shared/Expressions.js'
import LogController from '../Log/Controller.js'
import type { VariableValueEntry } from './Values.js'

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

					if (entry.handle) clearTimeout(entry.handle)
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

		const now = Date.now()
		const phase = now % interval
		const isCurrentlyOn = onPeriod > 0 && phase < onPeriod

		const newEntry: BlinkingInterval = {
			interval: interval,
			onPeriod: onPeriod,
			offPeriod: offPeriod,
			lastProbed: now,
			name: {
				variableId: `internal:__interval_${onPeriod}_${offPeriod}`,
				label: 'internal',
				name: `__interval_${onPeriod}_${offPeriod}`,
			},
			aborted: false,
			handle: null,
			value: isCurrentlyOn,
		}
		this.#intervals.set(intervalId, newEntry)

		// Calculate time until next phase transition
		const timeToNextTick =
			onPeriod === 0 || offPeriod === 0
				? interval - phase
				: isCurrentlyOn
					? onPeriod - phase
					: interval - phase

		// Schedule ticks
		const scheduleNextTick = () => {
			if (newEntry.aborted) return

			// Perform bounded notification loop to catch up with current epoch phase
			let iterations = 0
			while (iterations < 3) {
				iterations++
				const currentNow = Date.now()
				const currentPhase = currentNow % newEntry.interval
				const targetValue = newEntry.onPeriod > 0 && currentPhase < newEntry.onPeriod

				if (newEntry.value === targetValue) break

				newEntry.value = targetValue
				this.#emitChange([
					{
						id: newEntry.name.name,
						value: newEntry.value,
					},
				])

				if (newEntry.aborted) return
			}

			// If dutyCycle is 0 or 1, keep a constant state (no toggling)
			if (newEntry.onPeriod === 0 || newEntry.offPeriod === 0) return

			const finalNow = Date.now()
			const finalPhase = finalNow % newEntry.interval
			const finalIsOn = newEntry.onPeriod > 0 && finalPhase < newEntry.onPeriod

			// If still out of phase after exhausting iterations, yield event loop with a positive deferred tick
			// so subscribers are reliably notified of the phase change without blocking the process
			if (newEntry.value !== finalIsOn) {
				newEntry.handle = setTimeout(scheduleNextTick, 1)
				return
			}

			// Otherwise, schedule for the next future phase boundary
			const delay = finalIsOn
				? newEntry.onPeriod - finalPhase
				: newEntry.interval - finalPhase

			newEntry.handle = setTimeout(
				scheduleNextTick,
				delay > 0 ? delay : newEntry.interval
			)
		}

		newEntry.handle = setTimeout(scheduleNextTick, timeToNextTick)

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

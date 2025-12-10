import type { GetVariableValueProps } from '@companion-app/shared/Expression/ExpressionResolve.js'
import type { VariableValueEntry } from './Values.js'
import LogController from '../Log/Controller.js'

const CLEANUP_INTERVAL = 30_000 // 30 seconds
const CLEANUP_EXPIRY = 10 // 10 iterations

const MIN_INTERVAL = 50 // 50 ms

export class VariablesBlinker {
	readonly #logger = LogController.createLogger('Variables/Blinker')

	readonly #emitChange: (values: VariableValueEntry[]) => void

	readonly #intervals = new Map<number, BlinkingInterval>()

	/**
	 * The zero time when starting new intervals. This ensures they are predictable relative to each other (ie, a 200ms will be perfectly in sync with a 100ms)
	 */
	readonly #zeroTime = Date.now()

	constructor(emitChange: (values: VariableValueEntry[]) => void) {
		this.#emitChange = emitChange

		// Start a cleanup routine, to stop any unused intervals
		setInterval(() => {
			for (const [key, entry] of this.#intervals) {
				if (Date.now() - entry.lastProbed > entry.interval * CLEANUP_EXPIRY) {
					this.#logger.debug(`Cleaning up unused blinker interval: ${entry.interval}ms`)

					if (entry.handle) clearInterval(entry.handle)
					entry.aborted = true
					this.#intervals.delete(key)
				}
			}
		}, CLEANUP_INTERVAL)
	}

	trackDependencyOnInterval(interval: number): GetVariableValueProps | null {
		if (isNaN(interval) || interval <= 0) return null
		if (interval < MIN_INTERVAL) interval = MIN_INTERVAL

		// Check if already running
		const entry = this.#intervals.get(interval)
		if (entry) {
			// Update last probed time
			entry.lastProbed = Date.now()

			// Return the variable name
			return entry.name
		}

		this.#logger.debug(`Starting new blinker interval: ${interval}ms`)

		const newEntry: BlinkingInterval = {
			interval: interval,
			lastProbed: Date.now(),
			name: {
				variableId: `internal:__interval_${interval}`,
				label: 'internal',
				name: `__interval_${interval}`,
			},
			aborted: false,
			handle: null,
			value: false,
		}
		this.#intervals.set(interval, newEntry)

		// Calculate the time until the next aligned tick
		const timeSinceZero = Date.now() - this.#zeroTime
		const timeToNextTick = interval * 2 - (timeSinceZero % (interval * 2))

		// Start the interval after the calculated delay
		setTimeout(() => {
			if (newEntry.aborted) return

			// First tick
			newEntry.value = !newEntry.value
			this.#emitChange([
				{
					id: newEntry.name.name,
					value: newEntry.value,
				},
			])

			// Subsequent ticks
			newEntry.handle = setInterval(() => {
				if (newEntry.aborted) return
				newEntry.value = !newEntry.value

				// TODO - could/should these be batched? to make it cheaper when timers align
				this.#emitChange([
					{
						id: newEntry.name.name,
						value: newEntry.value,
					},
				])
			}, interval)
		}, timeToNextTick)

		return newEntry.name
	}
}

interface BlinkingInterval {
	readonly interval: number
	lastProbed: number

	readonly name: GetVariableValueProps

	aborted: boolean
	handle: NodeJS.Timeout | null
	value: boolean
}

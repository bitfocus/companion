import EventEmitter from 'events'
import { performance } from 'perf_hooks'
import LogController from '../Log/Controller.js'

interface TriggerEventsEvents {
	tick: [nowSeconds: number, nowMilliseconds: number]
	startup: []
	client_connect: []
	locked: [locked: boolean]

	trigger_enabled: [controlId: string, enabled: boolean]
	trigger_collections_enabled: []
	control_press: [controlId: string, pressed: boolean, surfaceId: string | undefined]
	variables_changed: [changed: Set<string>, fromControlId: string | null]
}

/**
 * Main bus for trigger events
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
export class TriggerEvents extends EventEmitter<TriggerEventsEvents> {
	readonly #logger = LogController.createLogger('Controls/TriggerEvents')

	/**
	 * The last tick time emitted
	 */
	#lastTick: number = Math.round(performance.now() / 1000)

	constructor() {
		super()

		this.setMaxListeners(0)

		setInterval(() => {
			try {
				// Future: Would this benefit from ticking more than once a second?
				const nowSeconds = Math.round(performance.now() / 1000)
				this.#lastTick = nowSeconds
				this.emit('tick', nowSeconds, Date.now())
			} catch (e) {
				this.#logger.error(`Unhandled error: ${e}`)
			}
		}, 1000)
	}

	/**
	 * Get the last tick time emitted
	 */
	getLastTickTime(): number {
		return this.#lastTick
	}
}

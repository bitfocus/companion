import EventEmitter from 'events'
import { performance } from 'perf_hooks'
import LogController from '../Log/Controller.js'
import type { VariableUpdateReason } from '../Variables/Values.js'

interface TriggerEventsEvents {
	tick: [nowSeconds: number, nowMilliseconds: number]
	startup: []
	client_connect: []
	locked: [locked: boolean]

	trigger_enabled: [controlId: string, enabled: boolean]
	control_press: [controlId: string, pressed: boolean, surfaceId: string | undefined]
	variables_changed: [changed: Map<string, VariableUpdateReason>, fromControlId: string | null]
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
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
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

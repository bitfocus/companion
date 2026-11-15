import type { SurfaceControlEvent } from '@companion-surface/base'
import LogController from '../Log/Controller.js'

const logger = LogController.createLogger('Controls/ButtonPressEvents')

/**
 * Where a press came from
 */
export interface ControlPressSource {
	/** The surface that initiated the press */
	surfaceId: string
	/** Control events for a physical press, or null for any other press */
	pressEvents: ButtonPressEvents | null
}

/**
 * Control events for one physical press, shared by transparent button references.
 * The surface decides how to show them, such as a haptic click or a flash of the key.
 */
export class ButtonPressEvents {
	readonly #send: (event: SurfaceControlEvent) => void
	#active = true
	#hasSentEvent = false

	constructor(send: (event: SurfaceControlEvent) => void) {
		this.#send = send
	}

	/**
	 * Report that an action group ran for this press.
	 * A release group after an earlier event for the same press is not reported again.
	 */
	request(phase: 'down' | 'held' | 'up'): void {
		if (!this.#active || (phase === 'up' && this.#hasSentEvent)) return

		// Record the attempt before sending, without depending on the surface acknowledging it.
		this.#hasSentEvent = true
		try {
			this.#send(phase === 'held' ? 'hold' : 'press')
		} catch (e) {
			logger.debug(`Control event failed: ${e}`)
		}
	}

	/**
	 * Stop sending events for this press.
	 * The surface handler that created it calls this once the release has been handled, and when the surface locks or
	 * unloads. A button calls it early when another press from the same surface replaces this one, when its delayed
	 * actions are aborted, or when it is destroyed, so a pending hold cannot cue.
	 */
	finish(): void {
		this.#active = false
	}
}

/**
 * Delays after a usb hotplug event at which to look for surfaces again.
 *
 * The usb connect event arrives before some devices are usable. A serial device such as a Loupedeck
 * only gets its serial port a few hundred milliseconds later, so a single scan made immediately
 * after the event misses it and the surface is not opened until the user triggers a rescan.
 */
export const HOTPLUG_RESCAN_DELAYS_MS: readonly number[] = [1000, 3000]

/**
 * Runs a scan when a usb device is connected, and again a little later.
 * A further connect event restarts the delayed scans rather than adding to them.
 */
export class HotplugRescan {
	readonly #scan: () => void
	readonly #delays: readonly number[]
	#timers: NodeJS.Timeout[] = []

	constructor(scan: () => void, delays: readonly number[] = HOTPLUG_RESCAN_DELAYS_MS) {
		this.#scan = scan
		this.#delays = delays
	}

	/** A usb device was connected */
	trigger(): void {
		this.cancel()

		this.#scan()
		this.#timers = this.#delays.map((delay) => setTimeout(this.#scan, delay))
	}

	/** Drop any delayed scans, such as when hotplug is disabled or the application is quitting */
	cancel(): void {
		for (const timer of this.#timers) clearTimeout(timer)
		this.#timers = []
	}
}

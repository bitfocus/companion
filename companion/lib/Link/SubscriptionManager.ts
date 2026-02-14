import EventEmitter from 'node:events'
import LogController from '../Log/Controller.js'

/** A resolution requested by a subscriber */
export interface SubscriptionResolution {
	width: number
	height: number
}

/** Key for a button location */
export type LocationKey = `${number}:${number}:${number}`

/** Key for a (location, resolution) pair */
export type LocationResolutionKey = `${number}:${number}:${number}:${number}x${number}`

/** Events emitted by SubscriptionManager */
export type SubscriptionManagerEvents = {
	/** A new (location, resolution) pair was subscribed for the first time */
	subscriptionAdded: [page: number, row: number, col: number, width: number, height: number]
	/** The last subscriber for a (location, resolution) pair unsubscribed */
	subscriptionRemoved: [page: number, row: number, col: number, width: number, height: number]
}

/**
 * Tracks which button locations are subscribed at which resolutions by remote peers.
 *
 * Handles deduplication: if multiple remote clients subscribe to the same button
 * at the same resolution, we only render once and fan out.
 *
 * This is the "inbound" subscription manager - it tracks what OTHER instances
 * are asking US to publish.
 */
export class SubscriptionManager extends EventEmitter<SubscriptionManagerEvents> {
	readonly #logger = LogController.createLogger('Link/SubscriptionManager')

	/**
	 * Map of (location:resolution) → Set of subscriber IDs.
	 * Subscriber IDs are typically peer UUIDs or transport-specific identifiers.
	 */
	readonly #subscriptions = new Map<LocationResolutionKey, Set<string>>()

	/** Eviction timeout handles per (location, resolution) */
	readonly #evictionTimers = new Map<LocationResolutionKey, ReturnType<typeof setTimeout>>()

	/** Cache eviction timeout (5 minutes) */
	readonly #evictionTimeoutMs: number

	constructor(evictionTimeoutMs = 5 * 60 * 1000) {
		super()
		this.setMaxListeners(0)
		this.#evictionTimeoutMs = evictionTimeoutMs
	}

	/**
	 * Add a subscription for a button at a specific resolution.
	 *
	 * @param subscriberId - Identifier for the subscriber (e.g. peer UUID)
	 * @param page - Page number
	 * @param row - Row number
	 * @param col - Column number
	 * @param width - Desired bitmap width
	 * @param height - Desired bitmap height
	 * @returns true if this is a new (location, resolution) subscription (first subscriber)
	 */
	subscribe(
		subscriberId: string,
		page: number,
		row: number,
		col: number,
		width: number,
		height: number
	): boolean {
		const key = this.#makeKey(page, row, col, width, height)

		// Cancel any pending eviction
		this.#cancelEviction(key)

		let subscribers = this.#subscriptions.get(key)
		const isNew = !subscribers || subscribers.size === 0

		if (!subscribers) {
			subscribers = new Set()
			this.#subscriptions.set(key, subscribers)
		}

		subscribers.add(subscriberId)

		if (isNew) {
			this.#logger.debug(
				`New subscription: page=${page} row=${row} col=${col} ${width}x${height} by ${subscriberId}`
			)
			this.emit('subscriptionAdded', page, row, col, width, height)
		}

		return isNew
	}

	/**
	 * Remove a subscription for a button at a specific resolution.
	 *
	 * @returns true if this was the last subscriber (subscription fully removed)
	 */
	unsubscribe(
		subscriberId: string,
		page: number,
		row: number,
		col: number,
		width: number,
		height: number
	): boolean {
		const key = this.#makeKey(page, row, col, width, height)
		const subscribers = this.#subscriptions.get(key)
		if (!subscribers) return false

		subscribers.delete(subscriberId)

		if (subscribers.size === 0) {
			this.#subscriptions.delete(key)
			this.#logger.debug(
				`Last subscriber removed: page=${page} row=${row} col=${col} ${width}x${height}`
			)
			this.emit('subscriptionRemoved', page, row, col, width, height)
			return true
		}

		return false
	}

	/**
	 * Remove all subscriptions for a specific subscriber.
	 * Used when a peer disconnects.
	 */
	unsubscribeAll(subscriberId: string): void {
		for (const [key, subscribers] of this.#subscriptions) {
			subscribers.delete(subscriberId)
			if (subscribers.size === 0) {
				this.#subscriptions.delete(key)
				const parsed = this.#parseKey(key)
				if (parsed) {
					this.emit('subscriptionRemoved', parsed.page, parsed.row, parsed.col, parsed.width, parsed.height)
				}
			}
		}
	}

	/**
	 * Get all active resolutions for a specific button location.
	 * Used when a button changes and we need to know which resolutions to render.
	 */
	getResolutionsForLocation(page: number, row: number, col: number): SubscriptionResolution[] {
		const locationPrefix = `${page}:${row}:${col}:`
		const resolutions: SubscriptionResolution[] = []

		for (const key of this.#subscriptions.keys()) {
			if (key.startsWith(locationPrefix)) {
				const parsed = this.#parseKey(key)
				if (parsed) {
					resolutions.push({ width: parsed.width, height: parsed.height })
				}
			}
		}

		return resolutions
	}

	/**
	 * Check whether a specific (location, resolution) pair has active subscribers.
	 */
	hasSubscribers(page: number, row: number, col: number, width: number, height: number): boolean {
		const key = this.#makeKey(page, row, col, width, height)
		const subscribers = this.#subscriptions.get(key)
		return !!subscribers && subscribers.size > 0
	}

	/**
	 * Get all subscribed locations (unique page/row/col combinations).
	 */
	getSubscribedLocations(): Array<{ page: number; row: number; col: number }> {
		const seen = new Set<LocationKey>()
		const locations: Array<{ page: number; row: number; col: number }> = []

		for (const key of this.#subscriptions.keys()) {
			const parsed = this.#parseKey(key)
			if (parsed) {
				const locKey: LocationKey = `${parsed.page}:${parsed.row}:${parsed.col}`
				if (!seen.has(locKey)) {
					seen.add(locKey)
					locations.push({ page: parsed.page, row: parsed.row, col: parsed.col })
				}
			}
		}

		return locations
	}

	/**
	 * Reset the eviction timer for a (location, resolution) pair.
	 * Called when a bitmap request is received, extending the subscription lifetime.
	 */
	touchSubscription(page: number, row: number, col: number, width: number, height: number): void {
		const key = this.#makeKey(page, row, col, width, height)
		if (!this.#subscriptions.has(key)) return

		this.#cancelEviction(key)
		this.#startEviction(key, page, row, col, width, height)
	}

	/**
	 * Clear all subscriptions and eviction timers.
	 */
	clear(): void {
		for (const timer of this.#evictionTimers.values()) {
			clearTimeout(timer)
		}
		this.#evictionTimers.clear()
		this.#subscriptions.clear()
	}

	#makeKey(page: number, row: number, col: number, width: number, height: number): LocationResolutionKey {
		return `${page}:${row}:${col}:${width}x${height}`
	}

	#parseKey(key: LocationResolutionKey): { page: number; row: number; col: number; width: number; height: number } | null {
		const match = key.match(/^(\d+):(\d+):(\d+):(\d+)x(\d+)$/)
		if (!match) return null
		return {
			page: Number(match[1]),
			row: Number(match[2]),
			col: Number(match[3]),
			width: Number(match[4]),
			height: Number(match[5]),
		}
	}

	#cancelEviction(key: LocationResolutionKey): void {
		const timer = this.#evictionTimers.get(key)
		if (timer) {
			clearTimeout(timer)
			this.#evictionTimers.delete(key)
		}
	}

	#startEviction(
		key: LocationResolutionKey,
		page: number,
		row: number,
		col: number,
		width: number,
		height: number
	): void {
		const timer = setTimeout(() => {
			this.#evictionTimers.delete(key)
			// Force-unsubscribe all subscribers for this key
			const subscribers = this.#subscriptions.get(key)
			if (subscribers && subscribers.size > 0) {
				this.#logger.debug(`Evicting stale subscription: page=${page} row=${row} col=${col} ${width}x${height}`)
				this.#subscriptions.delete(key)
				this.emit('subscriptionRemoved', page, row, col, width, height)
			}
		}, this.#evictionTimeoutMs)
		this.#evictionTimers.set(key, timer)
	}
}

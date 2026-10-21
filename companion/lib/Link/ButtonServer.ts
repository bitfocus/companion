import { nanoid } from 'nanoid'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { ImageResult } from '../Graphics/ImageResult.js'
import LogController from '../Log/Controller.js'
import { ImageWriteQueue } from '../Resources/ImageWriteQueue.js'
import { MAX_REFERENCE_DEPTH, referenceSurfaceIdDepth } from '../Surface/ReferenceSurfaceId.js'
import {
	encodeLinkMessage,
	linkButtonSubscriptionKey,
	type LinkButtonRef,
	type LinkButtonRevision,
	type LinkButtonSubscription,
	type LinkPayloadOfType,
	type LinkSubscribeRefusedReason,
} from './Protocol/v1/Schemas.js'
import { LINK_SUBSCRIPTION_LEASE_MS } from './Protocol/v1/Timing.js'

/** What the button server needs from the rest of Companion */
export interface LinkButtonServerHost {
	getCachedRenderOrGeneratePlaceholder(location: ControlLocation): ImageResult
	getControlIdAt(location: ControlLocation): string | null
	pressControl(controlId: string, pressed: boolean, surfaceId: string): boolean
	rotateControl(controlId: string, delta: number, surfaceId: string): boolean
	/**
	 * Abort the running actions of a control
	 * @param hops - how many installations the abort has come through, to pass on if the control forwards it
	 */
	abortControl(controlId: string, unlatch: boolean, hops: number): void
	/**
	 * The installations the image at a location has come through, when the button there is itself linked to a
	 * peer. Empty for a local button
	 */
	getSourceChain(location: ControlLocation): string[]
	/** Send a message to a peer over a transport */
	send(transportId: string, peerId: string, payload: string): void
	/** How far ahead of ours a peer's clock is, or null if that hasn't been measured */
	getClockOffset(peerId: string): number | null
}

interface Lease {
	expires: number
	/** The transport the subscriber reaches us through, which is where its updates are sent */
	transportId: string
}

interface ServedButton {
	readonly sub: LinkButtonSubscription
	/** The lease of each subscriber */
	readonly leases: Map<string, Lease>
	/** Identifies this serving of the button, for the revisions of its updates */
	readonly stream: string
	/** The last update sent, to send to a subscriber that doesn't have it. Null until it has been rendered */
	last: { revision: LinkButtonRevision; payload: string } | null
}

/**
 * How long to remember the id of a press or rotation from a peer whose clock hasn't been measured yet, so whose
 * presses can't be dropped for being late
 */
const UNMEASURED_CLOCK_REMEMBER_MS = 60_000

/** Bound on the ids remembered per peer, so a misbehaving peer can't exhaust memory */
const MAX_SEEN_IDS = 1000

/** Bound on the number of distinct (button, size) pairs served, so a misbehaving peer can't exhaust memory */
const MAX_SERVED_BUTTONS = 5000

/**
 * Serves the buttons of this installation to peers: tracks what peers have subscribed to (as leases that must be
 * renewed), sends renders of those buttons to them when they change, and performs the presses peers send.
 */
export class LinkButtonServer {
	readonly #logger = LogController.createLogger('Link/ButtonServer')

	readonly #host: LinkButtonServerHost
	readonly #selfId: () => string

	/** Subscribed buttons, by button and size (see linkButtonSubscriptionKey) */
	readonly #served = new Map<string, ServedButton>()

	readonly #renderQueue: ImageWriteQueue<string, [ImageResult]>

	/** Buttons held by each peer, keyed by control and surface */
	readonly #held = new Map<string, Map<string, { controlId: string; surfaceId: string }>>()

	/**
	 * The ids of the presses and rotations acted on, by peer, with when to forget them (once a copy would be dropped
	 * for being late anyway), oldest first
	 */
	readonly #seenIds = new Map<string, Map<string, number>>()

	constructor(host: LinkButtonServerHost, selfId: () => string) {
		this.#host = host
		this.#selfId = selfId

		this.#renderQueue = new ImageWriteQueue(this.#logger, async (key, render) => this.#sendRender(key, render))
	}

	get servedCount(): number {
		return this.#served.size
	}

	/** How many of our buttons (at each size) a peer is subscribed to */
	countSubscribedBy(peerId: string): number {
		let count = 0
		for (const served of this.#served.values()) if (served.leases.has(peerId)) count++
		return count
	}

	/**
	 * @param transportId - the transport the subscription arrived on, which its updates are then sent over
	 */
	handleSubscribe(peerId: string, transportId: string, payload: LinkPayloadOfType<'subscribe'>, now: number): void {
		const refused: LinkButtonSubscription[] = []
		for (const { have, ...sub } of payload.buttons) {
			const key = linkButtonSubscriptionKey(sub)

			let served = this.#served.get(key)
			if (!served) {
				if (this.#served.size >= MAX_SERVED_BUTTONS) {
					this.#logger.warn(`Refusing a subscription from ${peerId}, too many buttons subscribed`)
					refused.push(sub)
					continue
				}
				served = { sub, leases: new Map(), stream: nanoid(), last: null }
				this.#served.set(key, served)
				// Rendered for the first time, which sends it to every subscriber
				this.#renderQueue.queue(key, this.#host.getCachedRenderOrGeneratePlaceholder(toControlLocation(sub.button)))
			}

			served.leases.set(peerId, { expires: now + LINK_SUBSCRIPTION_LEASE_MS, transportId })

			// Send the latest update to a subscriber that doesn't have it, eg it is new, or an update was lost
			if (served.last && !isSameRevision(have, served.last.revision)) {
				this.#host.send(transportId, peerId, served.last.payload)
			}
		}

		this.#sendRefused(peerId, transportId, refused, 'limit')
	}

	/** Refuse all the buttons of a subscribe, eg because the peer isn't allowed buttons */
	refuseSubscribe(
		peerId: string,
		transportId: string,
		payload: LinkPayloadOfType<'subscribe'>,
		reason: LinkSubscribeRefusedReason
	): void {
		this.#sendRefused(
			peerId,
			transportId,
			payload.buttons.map(({ have: _have, ...sub }) => sub),
			reason
		)
	}

	/** Tell a subscriber which buttons it isn't served, so that it can say why rather than wait for them */
	#sendRefused(
		peerId: string,
		transportId: string,
		buttons: LinkButtonSubscription[],
		reason: LinkSubscribeRefusedReason
	): void {
		if (buttons.length === 0) return
		const payload = encodeLinkMessage('subscribe.refused', { buttons: buttons.map((sub) => ({ ...sub, reason })) })
		this.#host.send(transportId, peerId, payload)
	}

	handleUnsubscribe(peerId: string, payload: LinkPayloadOfType<'unsubscribe'>): void {
		for (const sub of payload.buttons) {
			const key = linkButtonSubscriptionKey(sub)
			const served = this.#served.get(key)
			if (!served) continue

			served.leases.delete(peerId)
			if (served.leases.size === 0) this.#served.delete(key)
		}
	}

	handlePress(peerId: string, payload: LinkPayloadOfType<'button.press'>, now: number): void {
		if (!this.#isFirstInTime(peerId, payload.id, payload.expiresAt, now)) return

		const surfaceId = this.#prepareSurfaceId(peerId, payload.surfaceId)
		if (!surfaceId) return

		const controlId = this.#host.getControlIdAt(toControlLocation(payload.button))
		if (!controlId) return

		// Track what is held, so it can be released if the peer goes away before releasing it
		let held = this.#held.get(peerId)
		if (payload.pressed) {
			if (!held) {
				held = new Map()
				this.#held.set(peerId, held)
			}
			held.set(`${controlId}\n${surfaceId}`, { controlId, surfaceId })
		} else if (held) {
			held.delete(`${controlId}\n${surfaceId}`)
			if (held.size === 0) this.#held.delete(peerId)
		}

		this.#host.pressControl(controlId, payload.pressed, surfaceId)
	}

	/** A peer is no longer allowed to use our buttons: stop serving it, and release anything it was holding */
	revoke(peerId: string): void {
		for (const [key, served] of this.#served) {
			served.leases.delete(peerId)
			if (served.leases.size === 0) this.#served.delete(key)
		}
		this.#releaseHeldBy(peerId)
	}

	/**
	 * Release the buttons a peer is holding, as it may no longer use them. Not when it becomes unreachable: like a
	 * surface unplugged mid-press, what it holds stays held
	 */
	#releaseHeldBy(sourceId: string): void {
		const held = this.#held.get(sourceId)
		if (!held) return
		this.#held.delete(sourceId)

		for (const { controlId, surfaceId } of held.values()) {
			this.#logger.debug(`Releasing ${controlId}, held by ${sourceId} which may no longer use it`)
			this.#host.pressControl(controlId, false, surfaceId)
		}
	}

	handleRotate(peerId: string, payload: LinkPayloadOfType<'button.rotate'>, now: number): void {
		if (!this.#isFirstInTime(peerId, payload.id, payload.expiresAt, now)) return

		const surfaceId = this.#prepareSurfaceId(peerId, payload.surfaceId)
		if (!surfaceId) return

		const controlId = this.#host.getControlIdAt(toControlLocation(payload.button))
		if (controlId) this.#host.rotateControl(controlId, payload.delta, surfaceId)
	}

	handleAbort(peerId: string, payload: LinkPayloadOfType<'button.abort'>, now: number): void {
		if (!this.#isFirstInTime(peerId, payload.id, payload.expiresAt, now)) return

		const hops = payload.hops + 1
		if (hops >= MAX_REFERENCE_DEPTH) {
			this.#logger.debug(`Dropping abort from ${peerId}, it has been forwarded too many times`)
			return
		}

		const controlId = this.#host.getControlIdAt(toControlLocation(payload.button))
		if (controlId) this.#host.abortControl(controlId, payload.unlatch, hops)
	}

	/**
	 * Whether to act on a press, rotation or abort: not when it has been acted on already, as a copy of it may arrive over
	 * each transport, nor when it has expired, as acting on it late is worse than not at all
	 * @param expiresAt - when it expires, in the peer's clock
	 */
	#isFirstInTime(peerId: string, id: string, expiresAt: number, now: number): boolean {
		const offset = this.#host.getClockOffset(peerId)
		const localExpiresAt = offset === null ? null : expiresAt - offset
		if (localExpiresAt !== null && now > localExpiresAt) {
			this.#logger.debug(`Dropping a press from ${peerId} that arrived ${now - localExpiresAt}ms too late`)
			return false
		}

		let seen = this.#seenIds.get(peerId)
		if (!seen) {
			seen = new Map()
			this.#seenIds.set(peerId, seen)
		}
		for (const [seenId, forgetAt] of seen) {
			// Oldest first, so stop at the first that is still needed
			if (forgetAt > now) break
			seen.delete(seenId)
		}
		if (seen.has(id)) return false

		seen.set(id, localExpiresAt ?? now + UNMEASURED_CLOCK_REMEMBER_MS)
		if (seen.size > MAX_SEEN_IDS) seen.delete(seen.keys().next().value!)
		return true
	}

	/**
	 * Namespace the remote surface id by its installation, so that held buttons are tracked separately from local
	 * surfaces. Returns null when the press has bounced between linked buttons too many times
	 */
	#prepareSurfaceId(sourceId: string, surfaceId: string): string | null {
		if (referenceSurfaceIdDepth(surfaceId) >= MAX_REFERENCE_DEPTH) {
			this.#logger.debug(`Dropping press from ${sourceId}, it has been forwarded too many times`)
			return null
		}
		return `link:${sourceId}:${surfaceId}`
	}

	/** A button has been redrawn, send it to anyone subscribed */
	onButtonDrawn(location: ControlLocation, render: ImageResult): void {
		for (const [key, served] of this.#served) {
			const target = toControlLocation(served.sub.button)
			if (
				target.pageNumber === location.pageNumber &&
				target.row === location.row &&
				target.column === location.column
			) {
				this.#renderQueue.queue(key, render)
			}
		}
	}

	/** Drop subscriptions whose leases have run out, eg because the subscriber went away without unsubscribing */
	expireLeases(now: number): void {
		for (const [key, served] of this.#served) {
			for (const [requestorId, { expires }] of served.leases) {
				if (expires <= now) served.leases.delete(requestorId)
			}
			if (served.leases.size === 0) this.#served.delete(key)
		}
	}

	clear(): void {
		this.#served.clear()
		this.#seenIds.clear()
		for (const sourceId of Array.from(this.#held.keys())) this.#releaseHeldBy(sourceId)
	}

	async #sendRender(key: string, render: ImageResult): Promise<void> {
		const served = this.#served.get(key)
		if (!served) return

		const { sub } = served
		const location = toControlLocation(sub.button)
		const dataUrl = await render.drawNativeEncoded(sub.width, sub.height, null, 'png')
		// It may have been dropped while rendering, and replaced by a new serving of the button
		if (this.#served.get(key) !== served) return

		const revision: LinkButtonRevision = { stream: served.stream, seq: (served.last?.revision.seq ?? -1) + 1 }
		const payload = encodeLinkMessage('button.update', {
			button: sub.button,
			width: sub.width,
			height: sub.height,
			revision,
			dataUrl: dataUrl || null,
			pressed: !!render.style?.state?.pushed,
			// The schema bounds the chain, a longer one is a loop anyway
			sourceChain: [...this.#host.getSourceChain(location).slice(-15), this.#selfId()],
		})
		served.last = { revision, payload }

		// Rendered once, and sent to each subscriber over the transport its lease came on
		for (const [peerId, lease] of served.leases) this.#host.send(lease.transportId, peerId, payload)
	}
}

function isSameRevision(a: LinkButtonRevision | null, b: LinkButtonRevision): boolean {
	return a !== null && a.stream === b.stream && a.seq === b.seq
}

function toControlLocation(ref: LinkButtonRef): ControlLocation {
	switch (ref.type) {
		case 'location':
			return { pageNumber: ref.page, row: ref.row, column: ref.column }
	}
}

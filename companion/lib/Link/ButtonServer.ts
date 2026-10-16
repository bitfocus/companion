import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { ImageResult } from '../Graphics/ImageResult.js'
import LogController from '../Log/Controller.js'
import { ImageWriteQueue } from '../Resources/ImageWriteQueue.js'
import { MAX_REFERENCE_DEPTH, referenceSurfaceIdDepth } from '../Surface/ReferenceSurfaceId.js'
import { encodeLinkMessage, type LinkButtonSubscription, type LinkPayloadOfType } from './Protocol/Schemas.js'
import { LINK_SUBSCRIPTION_LEASE_MS, linkButtonUpdateTopic } from './Protocol/Topics.js'

/** What the button server needs from the rest of Companion */
export interface LinkButtonServerHost {
	getCachedRenderOrGeneratePlaceholder(location: ControlLocation): ImageResult
	getControlIdAt(location: ControlLocation): string | null
	pressControl(controlId: string, pressed: boolean, surfaceId: string): boolean
	rotateControl(controlId: string, delta: number, surfaceId: string): boolean
	/**
	 * The installations the image at a location has come through, when the button there is itself linked to a
	 * peer. Empty for a local button
	 */
	getSourceChain(location: ControlLocation): string[]
	/** Publish a message to every transport */
	publish(topic: string, payload: string): void
}

interface ServedButton {
	readonly sub: LinkButtonSubscription
	/** When each subscriber's lease expires */
	readonly leases: Map<string, number>
}

/** Bound on the number of distinct (button, size) pairs served, so a misbehaving peer can't exhaust memory */
const MAX_SERVED_BUTTONS = 5000

/**
 * Serves the buttons of this installation to peers: tracks what peers have subscribed to (as leases that must be
 * renewed), publishes renders of those buttons when they change, and performs the presses peers send.
 */
export class LinkButtonServer {
	readonly #logger = LogController.createLogger('Link/ButtonServer')

	readonly #host: LinkButtonServerHost
	readonly #selfId: () => string

	/** Subscribed buttons, keyed by their update topic, which is unique per location and size */
	readonly #served = new Map<string, ServedButton>()

	readonly #renderQueue: ImageWriteQueue<string, [ImageResult]>

	/** Buttons held by each peer, keyed by control and surface */
	readonly #held = new Map<string, Map<string, { controlId: string; surfaceId: string }>>()

	constructor(host: LinkButtonServerHost, selfId: () => string) {
		this.#host = host
		this.#selfId = selfId

		this.#renderQueue = new ImageWriteQueue(this.#logger, async (topic, render) => this.#publishRender(topic, render))
	}

	get servedCount(): number {
		return this.#served.size
	}

	handleSubscribe(payload: LinkPayloadOfType<'subscribe'>, now: number): void {
		for (const sub of payload.buttons) {
			const topic = linkButtonUpdateTopic(this.#selfId(), sub)

			let served = this.#served.get(topic)
			if (!served) {
				if (this.#served.size >= MAX_SERVED_BUTTONS) {
					this.#logger.warn(`Ignoring subscription from ${payload.requestorId}, too many buttons subscribed`)
					continue
				}
				served = { sub, leases: new Map() }
				this.#served.set(topic, served)
			}

			const isNewSubscriber = !served.leases.has(payload.requestorId)
			served.leases.set(payload.requestorId, now + LINK_SUBSCRIPTION_LEASE_MS)

			// A new subscriber needs the current state. Renewals don't, they will get the next change
			if (isNewSubscriber || payload.sendCurrent) {
				this.#renderQueue.queue(topic, this.#host.getCachedRenderOrGeneratePlaceholder(toControlLocation(sub)))
			}
		}
	}

	handleUnsubscribe(payload: LinkPayloadOfType<'unsubscribe'>): void {
		for (const sub of payload.buttons) {
			const topic = linkButtonUpdateTopic(this.#selfId(), sub)
			const served = this.#served.get(topic)
			if (!served) continue

			served.leases.delete(payload.requestorId)
			if (served.leases.size === 0) this.#served.delete(topic)
		}
	}

	handlePress(payload: LinkPayloadOfType<'button.press'>): void {
		const surfaceId = this.#prepareSurfaceId(payload.sourceId, payload.surfaceId)
		if (!surfaceId) return

		const controlId = this.#host.getControlIdAt(toControlLocation(payload))
		if (!controlId) return

		// Track what is held, so it can be released if the peer goes away before releasing it
		let held = this.#held.get(payload.sourceId)
		if (payload.pressed) {
			if (!held) {
				held = new Map()
				this.#held.set(payload.sourceId, held)
			}
			held.set(`${controlId}\n${surfaceId}`, { controlId, surfaceId })
		} else if (held) {
			held.delete(`${controlId}\n${surfaceId}`)
			if (held.size === 0) this.#held.delete(payload.sourceId)
		}

		this.#host.pressControl(controlId, payload.pressed, surfaceId)
	}

	/**
	 * A peer has become unreachable: release the buttons it was holding, as the release may never arrive (eg the
	 * connection dropped while the button was held)
	 */
	releaseHeldBy(sourceId: string): void {
		const held = this.#held.get(sourceId)
		if (!held) return
		this.#held.delete(sourceId)

		for (const { controlId, surfaceId } of held.values()) {
			this.#logger.debug(`Releasing ${controlId}, held by ${sourceId} which is no longer reachable`)
			this.#host.pressControl(controlId, false, surfaceId)
		}
	}

	handleRotate(payload: LinkPayloadOfType<'button.rotate'>): void {
		const surfaceId = this.#prepareSurfaceId(payload.sourceId, payload.surfaceId)
		if (!surfaceId) return

		const controlId = this.#host.getControlIdAt(toControlLocation(payload))
		if (controlId) this.#host.rotateControl(controlId, payload.delta, surfaceId)
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

	/** A button has been redrawn, publish it to anyone subscribed */
	onButtonDrawn(location: ControlLocation, render: ImageResult): void {
		for (const [topic, served] of this.#served) {
			const { sub } = served
			if (sub.page === location.pageNumber && sub.row === location.row && sub.column === location.column) {
				this.#renderQueue.queue(topic, render)
			}
		}
	}

	/** Drop subscriptions whose leases have run out, eg because the subscriber went away without unsubscribing */
	expireLeases(now: number): void {
		for (const [topic, served] of this.#served) {
			for (const [requestorId, expires] of served.leases) {
				if (expires <= now) served.leases.delete(requestorId)
			}
			if (served.leases.size === 0) this.#served.delete(topic)
		}
	}

	clear(): void {
		this.#served.clear()
		for (const sourceId of Array.from(this.#held.keys())) this.releaseHeldBy(sourceId)
	}

	async #publishRender(topic: string, render: ImageResult): Promise<void> {
		const served = this.#served.get(topic)
		if (!served) return

		const { sub } = served
		const location = toControlLocation(sub)
		const dataUrl = await render.drawNativeEncoded(sub.width, sub.height, null, 'png')

		this.#host.publish(
			topic,
			encodeLinkMessage('button.update', {
				page: sub.page,
				row: sub.row,
				column: sub.column,
				width: sub.width,
				height: sub.height,
				dataUrl: dataUrl || null,
				pressed: !!render.style?.state?.pushed,
				// The schema bounds the chain, a longer one is a loop anyway
				sourceChain: [...this.#host.getSourceChain(location).slice(-15), this.#selfId()],
			})
		)
	}
}

function toControlLocation(loc: { page: number; row: number; column: number }): ControlLocation {
	return { pageNumber: loc.page, row: loc.row, column: loc.column }
}

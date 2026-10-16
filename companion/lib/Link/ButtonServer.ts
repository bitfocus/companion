import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { ImageResult } from '../Graphics/ImageResult.js'
import LogController from '../Log/Controller.js'
import { ImageWriteQueue } from '../Resources/ImageWriteQueue.js'
import { MAX_REFERENCE_DEPTH, referenceSurfaceIdDepth } from '../Surface/ReferenceSurfaceId.js'
import {
	encodeLinkMessage,
	type LinkButtonRef,
	type LinkButtonSubscription,
	type LinkPayloadOfType,
} from './Protocol/v1/Schemas.js'
import { LINK_SUBSCRIPTION_LEASE_MS, linkButtonUpdateTopic } from './Protocol/v1/Topics.js'

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
	/** Publish a message on a transport */
	publish(transportId: string, topic: string, payload: string): void
}

interface Lease {
	expires: number
	/** The transport the subscriber reaches us through, which is where its updates are published */
	transportId: string
}

interface ServedButton {
	readonly sub: LinkButtonSubscription
	/** The lease of each subscriber */
	readonly leases: Map<string, Lease>
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

	/**
	 * @param transportId - the transport the subscription arrived on, which its updates are then published on
	 */
	handleSubscribe(peerId: string, transportId: string, payload: LinkPayloadOfType<'subscribe'>, now: number): void {
		for (const sub of payload.buttons) {
			const topic = linkButtonUpdateTopic(this.#selfId(), sub)

			let served = this.#served.get(topic)
			if (!served) {
				if (this.#served.size >= MAX_SERVED_BUTTONS) {
					this.#logger.warn(`Ignoring subscription from ${peerId}, too many buttons subscribed`)
					continue
				}
				served = { sub, leases: new Map() }
				this.#served.set(topic, served)
			}

			// A new subscriber needs the current state, as does one that now reaches us another way. Renewals don't,
			// they will get the next change
			const previous = served.leases.get(peerId)
			served.leases.set(peerId, { expires: now + LINK_SUBSCRIPTION_LEASE_MS, transportId })
			if (!previous || previous.transportId !== transportId || payload.sendCurrent) {
				this.#renderQueue.queue(topic, this.#host.getCachedRenderOrGeneratePlaceholder(toControlLocation(sub.button)))
			}
		}
	}

	handleUnsubscribe(peerId: string, payload: LinkPayloadOfType<'unsubscribe'>): void {
		for (const sub of payload.buttons) {
			const topic = linkButtonUpdateTopic(this.#selfId(), sub)
			const served = this.#served.get(topic)
			if (!served) continue

			served.leases.delete(peerId)
			if (served.leases.size === 0) this.#served.delete(topic)
		}
	}

	handlePress(peerId: string, payload: LinkPayloadOfType<'button.press'>): void {
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
		for (const [topic, served] of this.#served) {
			served.leases.delete(peerId)
			if (served.leases.size === 0) this.#served.delete(topic)
		}
		this.releaseHeldBy(peerId)
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

	handleRotate(peerId: string, payload: LinkPayloadOfType<'button.rotate'>): void {
		const surfaceId = this.#prepareSurfaceId(peerId, payload.surfaceId)
		if (!surfaceId) return

		const controlId = this.#host.getControlIdAt(toControlLocation(payload.button))
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
			const target = toControlLocation(served.sub.button)
			if (
				target.pageNumber === location.pageNumber &&
				target.row === location.row &&
				target.column === location.column
			) {
				this.#renderQueue.queue(topic, render)
			}
		}
	}

	/** Drop subscriptions whose leases have run out, eg because the subscriber went away without unsubscribing */
	expireLeases(now: number): void {
		for (const [topic, served] of this.#served) {
			for (const [requestorId, { expires }] of served.leases) {
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
		const location = toControlLocation(sub.button)
		const dataUrl = await render.drawNativeEncoded(sub.width, sub.height, null, 'png')

		const payload = encodeLinkMessage('button.update', {
			button: sub.button,
			width: sub.width,
			height: sub.height,
			dataUrl: dataUrl || null,
			pressed: !!render.style?.state?.pushed,
			// The schema bounds the chain, a longer one is a loop anyway
			sourceChain: [...this.#host.getSourceChain(location).slice(-15), this.#selfId()],
		})
		// Once per transport the subscribers reach us through, rather than on all of them
		const transportIds = new Set(Array.from(served.leases.values(), (lease) => lease.transportId))
		for (const transportId of transportIds) this.#host.publish(transportId, topic, payload)
	}
}

function toControlLocation(ref: LinkButtonRef): ControlLocation {
	switch (ref.type) {
		case 'location':
			return { pageNumber: ref.page, row: ref.row, column: ref.column }
	}
}

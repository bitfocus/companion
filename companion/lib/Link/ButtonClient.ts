import isEqual from 'fast-deep-equal'
import { nanoid } from 'nanoid'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { LinkButtonStatus, LinkPeerInfo } from '@companion-app/shared/Model/Link.js'
import { ButtonGraphicsDecorationType } from '@companion-app/shared/Model/StyleModel.js'
import type { DisplayedSize } from '../Graphics/DisplayedLocations.js'
import LogController from '../Log/Controller.js'
import { linkBitmapSizesFor } from './ButtonSizes.js'
import type { LinkPeerRegistry } from './PeerRegistry.js'
import {
	encodeLinkMessage,
	LINK_BUTTONS_PER_MESSAGE,
	linkButtonSubscriptionKey,
	type LinkButtonRef,
	type LinkButtonRevision,
	type LinkButtonSubscription,
	type LinkMessageType,
	type LinkPayloadOfType,
	type LinkSubscribeRefusedReason,
} from './Protocol/v1/Schemas.js'
import { LINK_PRESS_EXPIRY_MS, LINK_SUBSCRIPTION_RENEW_MS } from './Protocol/v1/Timing.js'
import type { LinkButtonImage, LinkRemoteImageStore } from './RemoteImageStore.js'

/**
 * How long buttons keep showing the last image of a peer that has become unreachable, before showing it as
 * offline. Covers brief drops (eg a proxy closing the connection), so that they don't flicker
 */
export const LINK_UNREACHABLE_GRACE_MS = 10_000

/**
 * How long a size stays subscribed to once nothing shows it any more, so that paging back and forth doesn't
 * subscribe and unsubscribe each time
 */
export const LINK_SIZE_RELEASE_GRACE_MS = 2_000

/** How long a draw waits for the bitmap of its shape before drawing another, given the latency to the peer */
export function linkImageWaitMs(latencyMs: number | null): number {
	// Allowing for the peer to draw it too
	return latencyMs === null ? 300 : Math.min(300, Math.max(30, latencyMs + 30))
}

/**
 * How long a new render of a button is held back for its other sizes to arrive, so that they are all shown together,
 * given the latency to the peer
 */
export function linkCoalesceWaitMs(latencyMs: number | null): number {
	return latencyMs === null ? 100 : Math.min(100, Math.max(20, latencyMs + 20))
}

export interface LinkButtonTarget {
	peerId: string
	location: ControlLocation
}

export interface LinkButtonState {
	status: LinkButtonStatus
	peerName: string | null
	/** Identifies the remote button, for fetching its images from the remote image store */
	remoteKey: string | null
	/** The latest images of the remote button, when status is `ok` */
	images: LinkButtonImage[]
	pressed: boolean
	/** Whether the installation has dropped out, and the image is the last it sent */
	unreachable: boolean
	/** The state of the remote button, for drawing its decoration */
	stepCurrent: number
	stepCount: number
	buttonStatus: 'good' | 'warning' | 'error' | undefined
	actionRunning: boolean
	/** The installations the image came through, for loop detection when we serve this button onwards */
	sourceChain: string[]
}

/** Send a message to a peer over a transport */
export type LinkButtonClientSend = (transportId: string, peerId: string, payload: string) => void

/** The size of the content of a button of a size, which is what remote buttons are drawn at, under their decoration */
export type LinkButtonContentSize = (size: DisplayedSize, decoration: ButtonGraphicsDecorationType) => DisplayedSize

interface LinkedButton {
	target: LinkButtonTarget | null
	/** The key of the remote button this button shows (see remoteKey) */
	key: string | null
	/** The sizes this button is being shown at */
	displayedSizes: DisplayedSize[]
	/** How this button is decorated, which leaves the rest of it for the remote button */
	decoration: ButtonGraphicsDecorationType
	onChange: () => void
	state: LinkButtonState
	/**
	 * The surfaces holding this button down, and the target each pressed, so that it is released there. Null once that
	 * target has been released because the button was given another, so that the release is dropped
	 */
	held: Map<string, LinkButtonTarget | null>
}

/** A subscription to a remote button at one size */
interface Variant {
	readonly sub: LinkButtonSubscription
	lastUpdate: LinkPayloadOfType<'button.update'> | null
	/**
	 * The image held, and the revision it was sent with. Updates that only change the state (eg pressed) say it is
	 * unchanged since then, rather than sending it again
	 */
	image: { dataUrl: string | null; revision: LinkButtonRevision } | null
	/** Why the peer said it doesn't serve the button at this size, until an update says it does */
	refused: LinkSubscribeRefusedReason | null
	/** Set once nothing shows this size, to unsubscribe from it when the grace period is over */
	releaseTimer: NodeJS.Timeout | null
	/** Whether a subscribe for it has been sent */
	subscribed: boolean
}

/** What the link buttons showing a remote button are given */
interface PublishedRender {
	/** The newest update, for what goes with every image */
	readonly update: LinkPayloadOfType<'button.update'>
	readonly images: LinkButtonImage[]
}

/** A remote button shown by one or more link buttons, at the sizes they are shown at */
interface RemoteButton {
	/** See remoteKey */
	readonly key: string
	readonly peerId: string
	readonly button: LinkButtonRef
	readonly controlIds: Set<string>
	/** By size (see sizeKey) */
	readonly variants: Map<string, Variant>
	/** The newest update received, at any size */
	latestUpdate: LinkPayloadOfType<'button.update'> | null
	published: PublishedRender | null
	/** Set while a new render is held back for its other sizes to arrive */
	publishTimer: NodeJS.Timeout | null
}

/**
 * The client side of the button protocol: subscribes to the remote buttons that link buttons on this
 * installation show, at the sizes they are being shown at, keeps the subscriptions alive, and forwards presses. Link
 * buttons that show the same remote button share its subscriptions.
 *
 * Each shape the remote button is shown at is subscribed to separately, for the peer to draw it at that size. A new
 * render is held back briefly until it has arrived at every size, so that the sizes change together.
 *
 * Everything about a peer goes over its route (see LinkPeerRegistry.getRoute), so that it is sent once. When the
 * route changes, the subscriptions are renewed over the new one. Every subscribe says which revision is held of each
 * button, so the peer sends anything that was missed.
 */
export class LinkButtonClient {
	readonly #logger = LogController.createLogger('Link/ButtonClient')

	readonly #selfId: () => string
	readonly #peers: LinkPeerRegistry
	readonly #send: LinkButtonClientSend
	readonly #contentSize: LinkButtonContentSize
	readonly #images: LinkRemoteImageStore

	readonly #buttons = new Map<string, LinkedButton>()
	/** By peer and button (see remoteKey) */
	readonly #remotes = new Map<string, RemoteButton>()

	/** New subscriptions, sent together once the current burst of changes (eg a page of buttons) is done */
	readonly #pendingSubscribes = new Set<RemoteButton>()
	#pendingSubscribesImmediate: NodeJS.Immediate | null = null

	#renewTimer: NodeJS.Timeout | null = null

	/** When each peer became unreachable, and the timer to show it as offline once the grace period is over */
	readonly #unreachable = new Map<string, { since: number; timer: NodeJS.Timeout }>()
	/** Peers last seen reachable, so that only a peer that drops out gets the grace period */
	readonly #reachable = new Set<string>()

	constructor(
		selfId: () => string,
		peers: LinkPeerRegistry,
		send: LinkButtonClientSend,
		contentSize: LinkButtonContentSize,
		images: LinkRemoteImageStore
	) {
		this.#selfId = selfId
		this.#peers = peers
		this.#send = send
		this.#contentSize = contentSize
		this.#images = images

		peers.on('changed', () => this.#refreshAllStates())
		// It is reachable (again), or a different way: we may have missed updates, which the peer sends when it is told
		// what we have
		peers.on('routeChanged', (peerId) => this.#subscribeAllForPeer(peerId))
		// It may have just started sharing its buttons with us
		peers.on('sharedWithUsChanged', (peerId) => this.#subscribeAllForPeer(peerId))
	}

	/** How many buttons of a peer are subscribed to, for the link buttons showing them */
	countSubscribedTo(peerId: string): number {
		let count = 0
		for (const remote of this.#remotes.values()) if (remote.peerId === peerId && remote.variants.size > 0) count++
		return count
	}

	start(): void {
		this.#renewTimer ??= setInterval(() => this.renewAll(), LINK_SUBSCRIPTION_RENEW_MS)
	}

	stop(): void {
		if (this.#renewTimer) clearInterval(this.#renewTimer)
		this.#renewTimer = null

		for (const { timer } of this.#unreachable.values()) clearTimeout(timer)
		this.#unreachable.clear()

		if (this.#pendingSubscribesImmediate) clearImmediate(this.#pendingSubscribesImmediate)
		this.#pendingSubscribesImmediate = null
		this.#pendingSubscribes.clear()

		for (const remote of this.#remotes.values()) {
			if (remote.publishTimer) clearTimeout(remote.publishTimer)
			remote.publishTimer = null
			for (const variant of remote.variants.values()) {
				if (variant.releaseTimer) clearTimeout(variant.releaseTimer)
				variant.releaseTimer = null
			}
		}
		this.#images.clear()
	}

	/**
	 * Set (or change) what a link button shows. `onChange` is called whenever its state changes
	 */
	setTarget(controlId: string, target: LinkButtonTarget | null, onChange: () => void): void {
		const button = this.#getOrCreateButton(controlId, onChange)
		button.onChange = onChange

		if (!isEqual(button.target, target)) {
			// What it was holding down is released there, not wherever it now points
			this.#releaseHeld(button)

			button.target = target
			this.#detach(controlId, button)

			if (target) {
				const ref = toLinkButtonRef(target.location)
				button.key = remoteKey(target.peerId, ref)

				let remote = this.#remotes.get(button.key)
				if (!remote) {
					remote = {
						key: button.key,
						peerId: target.peerId,
						button: ref,
						controlIds: new Set(),
						variants: new Map(),
						latestUpdate: null,
						published: null,
						publishTimer: null,
					}
					this.#remotes.set(button.key, remote)
				}
				remote.controlIds.add(controlId)
				this.#updateDemand(remote)
			}
		}

		this.#refreshState(button)
	}

	/** Set how a link button is decorated, as the remote button is drawn in what is left of it */
	setDecoration(controlId: string, decoration: ButtonGraphicsDecorationType): void {
		const button = this.#buttons.get(controlId)
		if (!button || button.decoration === decoration) return

		button.decoration = decoration
		const remote = button.key ? this.#remotes.get(button.key) : undefined
		if (remote) this.#updateDemand(remote)
	}

	/** Subscribe again to the sizes everything is shown at, as the content of a button of a size has changed size */
	refreshDisplayedSizes(): void {
		for (const remote of this.#remotes.values()) this.#updateDemand(remote)
	}

	/**
	 * Set the sizes a link button is being shown at, which are the sizes its remote button is subscribed to. A button
	 * that isn't shown anywhere isn't subscribed to at all
	 */
	setDisplayedSizes(controlId: string, sizes: readonly DisplayedSize[]): void {
		const button = this.#buttons.get(controlId)
		if (!button || isEqual(button.displayedSizes, sizes)) return

		button.displayedSizes = sizes.map((size) => ({ ...size }))
		const remote = button.key ? this.#remotes.get(button.key) : undefined
		if (remote) this.#updateDemand(remote)
	}

	#getOrCreateButton(controlId: string, onChange: () => void): LinkedButton {
		let button = this.#buttons.get(controlId)
		if (!button) {
			button = {
				target: null,
				key: null,
				displayedSizes: [],
				decoration: ButtonGraphicsDecorationType.FollowDefault,
				onChange,
				state: computeState(null, null, null, '', null, false, null),
				held: new Map(),
			}
			this.#buttons.set(controlId, button)
		}
		return button
	}

	/** A link button has been deleted */
	removeTarget(controlId: string): void {
		const button = this.#buttons.get(controlId)
		if (!button) return

		this.#releaseHeld(button)
		this.#detach(controlId, button)
		this.#buttons.delete(controlId)
	}

	/** Release the remote button for each surface holding it down, as the button is changing what it shows */
	#releaseHeld(button: LinkedButton): void {
		for (const [surfaceId, target] of button.held) {
			if (target) this.#sendPress(target, false, surfaceId)
			button.held.set(surfaceId, null)
		}
	}

	getState(controlId: string): LinkButtonState | undefined {
		return this.#buttons.get(controlId)?.state
	}

	press(controlId: string, pressed: boolean, surfaceId: string): void {
		const button = this.#buttons.get(controlId)
		if (!button) return

		let target = button.target
		if (pressed) {
			if (target) button.held.set(surfaceId, target)
		} else if (button.held.has(surfaceId)) {
			// Released where it was pressed. Null when that was released already, as the button was given another target
			target = button.held.get(surfaceId) ?? null
			button.held.delete(surfaceId)
		}

		if (target) this.#sendPress(target, pressed, surfaceId)
	}

	#sendPress(target: LinkButtonTarget, pressed: boolean, surfaceId: string): void {
		this.#sendToPeer(target.peerId, 'button.press', {
			id: nanoid(),
			expiresAt: Date.now() + LINK_PRESS_EXPIRY_MS,
			button: toLinkButtonRef(target.location),
			pressed,
			surfaceId,
		})
	}

	/** @returns whether the rotation was sent */
	rotate(controlId: string, delta: number, surfaceId: string): boolean {
		const target = this.#buttons.get(controlId)?.target
		if (!target) return false

		return this.#sendToPeer(target.peerId, 'button.rotate', {
			id: nanoid(),
			expiresAt: Date.now() + LINK_PRESS_EXPIRY_MS,
			button: toLinkButtonRef(target.location),
			delta,
			surfaceId,
		})
	}

	/**
	 * Abort the running actions of the remote button
	 * @param hops - how many installations this abort has already been forwarded through
	 */
	abort(controlId: string, unlatch: boolean, hops: number): void {
		const target = this.#buttons.get(controlId)?.target
		if (!target) return

		this.#sendToPeer(target.peerId, 'button.abort', {
			id: nanoid(),
			expiresAt: Date.now() + LINK_PRESS_EXPIRY_MS,
			button: toLinkButtonRef(target.location),
			unlatch,
			hops,
		})
	}

	/** An update arrived from a peer. Ignored unless we are subscribed to that button of that peer, at that size */
	handleUpdate(peerId: string, payload: LinkPayloadOfType<'button.update'>): void {
		const remote = this.#remotes.get(remoteKey(peerId, payload.button))
		const variant = remote?.variants.get(sizeKey(payload))
		if (!remote || !variant) return

		// Updates may arrive out of order, eg over different transports. Keep the newest
		const held = variant.lastUpdate?.revision
		if (held && held.stream === payload.revision.stream && held.seq >= payload.revision.seq) return

		if (payload.image.type === 'image') {
			variant.image = { dataUrl: payload.image.dataUrl, revision: payload.revision }
		} else if (!variant.image || !isSameRevision(payload.image.since, variant.image.revision)) {
			// The image it is the same as was missed, so ask for it again, saying nothing is held
			this.#sendToPeer(remote.peerId, 'subscribe', { buttons: [{ ...variant.sub, have: null }] })
			return
		}

		variant.lastUpdate = payload
		variant.refused = null
		if (isNewer(payload.revision, remote.latestUpdate?.revision ?? null)) remote.latestUpdate = payload

		// A draw waiting for the first image of this size has it straight away, without waiting for the other sizes. Or
		// stops waiting, if there is no image to show
		this.#images.shapeArrived(remote.key, variant.sub, currentImageOf(remote, variant))

		this.#schedulePublish(remote)
	}

	/** A peer said it doesn't serve some of the buttons we subscribed to, and why */
	handleRefused(peerId: string, payload: LinkPayloadOfType<'subscribe.refused'>): void {
		for (const { reason, ...sub } of payload.buttons) {
			const remote = this.#remotes.get(remoteKey(peerId, sub.button))
			const variant = remote?.variants.get(sizeKey(sub))
			if (!remote || !variant || variant.refused === reason) continue

			variant.refused = reason
			this.#images.shapeArrived(remote.key, variant.sub, null)

			// A size that won't arrive mustn't hold back the others
			if (remote.publishTimer) this.#schedulePublish(remote)
			this.#refreshRemote(remote)
		}
	}

	/**
	 * Show the newest render to the link buttons: straight away once every size has it, or after a short wait for the
	 * sizes still to arrive
	 */
	#schedulePublish(remote: RemoteButton): void {
		if (this.#isCaughtUp(remote)) {
			if (remote.publishTimer) clearTimeout(remote.publishTimer)
			remote.publishTimer = null
			this.#publish(remote)
		} else {
			remote.publishTimer ??= setTimeout(
				() => {
					remote.publishTimer = null
					this.#publish(remote)
				},
				linkCoalesceWaitMs(this.#getLatency(remote.peerId))
			)
		}
	}

	/** Whether every size still wanted, and served, has the newest render */
	#isCaughtUp(remote: RemoteButton): boolean {
		const latest = remote.latestUpdate?.revision ?? null
		for (const variant of remote.variants.values()) {
			if (variant.releaseTimer || variant.refused) continue
			if (!variant.lastUpdate || !isSameRevision(variant.lastUpdate.revision, latest)) return false
		}
		return true
	}

	#publish(remote: RemoteButton): void {
		const update = remote.latestUpdate
		if (update) {
			const images: LinkButtonImage[] = []
			for (const variant of remote.variants.values()) {
				const { lastUpdate, image } = variant
				if (!lastUpdate || !image?.dataUrl) continue

				images.push({
					width: lastUpdate.width,
					height: lastUpdate.height,
					dataUrl: image.dataUrl,
					// The revision it was sent with, so that it isn't taken for a new image when only the state changed
					revision: image.revision,
					current: isSameRevision(lastUpdate.revision, update.revision),
				})
			}
			remote.published = { update, images }
		} else {
			remote.published = null
		}
		this.#images.setImages(remote.key, remote.published?.images ?? [])

		this.#refreshRemote(remote)
	}

	#refreshRemote(remote: RemoteButton): void {
		for (const controlId of remote.controlIds) {
			const button = this.#buttons.get(controlId)
			if (button) this.#refreshState(button)
		}
	}

	/** Subscribe to the sizes the remote button is shown at, and let go of those it no longer is */
	#updateDemand(remote: RemoteButton): void {
		// The remote button is drawn as the content of the button, under its decoration
		const shownSizes: DisplayedSize[] = []
		for (const controlId of remote.controlIds) {
			const button = this.#buttons.get(controlId)
			if (!button) continue
			for (const size of button.displayedSizes) {
				// Its content alone when it is served onwards, for the subscriber to decorate
				shownSizes.push(size.contentOnly ? size : this.#contentSize(size, button.decoration))
			}
		}

		const wanted = new Set<string>()
		for (const size of linkBitmapSizesFor(shownSizes)) {
			const key = sizeKey(size)
			wanted.add(key)

			const variant = remote.variants.get(key)
			if (variant) {
				// Shown again before it was let go
				if (variant.releaseTimer) clearTimeout(variant.releaseTimer)
				variant.releaseTimer = null
			} else {
				remote.variants.set(key, {
					sub: { button: remote.button, width: size.width, height: size.height },
					lastUpdate: null,
					image: null,
					refused: null,
					releaseTimer: null,
					subscribed: false,
				})
				// A draw at this shape waits briefly for its first image, from now rather than from each draw, so that a page
				// of buttons from a peer that doesn't answer holds up the surface showing it once, not once per button
				this.#images.expectShape(remote.key, size, Date.now() + linkImageWaitMs(this.#getLatency(remote.peerId)))
				this.#queueSubscribe(remote)
			}
		}

		for (const [key, variant] of remote.variants) {
			if (wanted.has(key) || variant.releaseTimer) continue
			variant.releaseTimer = setTimeout(() => this.#dropVariant(remote, key, variant), LINK_SIZE_RELEASE_GRACE_MS)
		}

		// A size let go of mustn't hold back the others
		if (remote.publishTimer) this.#schedulePublish(remote)
	}

	#dropVariant(remote: RemoteButton, key: string, variant: Variant): void {
		if (remote.variants.get(key) !== variant) return

		remote.variants.delete(key)
		this.#sendToPeer(remote.peerId, 'unsubscribe', { buttons: [variant.sub] })
		this.#images.shapeArrived(remote.key, variant.sub, null)

		// Its image is no longer shown
		this.#publish(remote)
	}

	/** Send the new subscriptions of a remote button with the others made at the same time */
	#queueSubscribe(remote: RemoteButton): void {
		this.#pendingSubscribes.add(remote)
		this.#pendingSubscribesImmediate ??= setImmediate(() => {
			this.#pendingSubscribesImmediate = null

			const byPeer = new Map<string, Variant[]>()
			for (const pending of this.#pendingSubscribes) {
				// It may have been let go of since
				if (this.#remotes.get(remoteKey(pending.peerId, pending.button)) !== pending) continue

				let variants = byPeer.get(pending.peerId)
				if (!variants) {
					variants = []
					byPeer.set(pending.peerId, variants)
				}
				// Not those sent since, eg by a renewal
				for (const variant of pending.variants.values()) if (!variant.subscribed) variants.push(variant)
			}
			this.#pendingSubscribes.clear()

			for (const [peerId, variants] of byPeer) this.#sendSubscribe(peerId, variants)
		})
	}

	/** Renew the leases of all our subscriptions */
	renewAll(): void {
		const peerIds = new Set(Array.from(this.#remotes.values(), (s) => s.peerId))
		for (const peerId of peerIds) this.#subscribeAllForPeer(peerId)
	}

	/** Subscribe to (or renew) all our subscriptions to a peer, saying what we have so that it sends what we miss */
	#subscribeAllForPeer(peerId: string): void {
		const variants: Variant[] = []
		for (const remote of this.#remotes.values()) {
			if (remote.peerId === peerId) variants.push(...remote.variants.values())
		}
		this.#sendSubscribe(peerId, variants)
	}

	/** Subscribe to (or renew) some subscriptions to a peer, saying what we have so that it sends what we miss */
	#sendSubscribe(peerId: string, variants: readonly Variant[]): void {
		for (const chunk of chunked(variants, LINK_BUTTONS_PER_MESSAGE)) {
			const buttons = chunk.map((variant) => ({ ...variant.sub, have: variant.lastUpdate?.revision ?? null }))
			if (this.#sendToPeer(peerId, 'subscribe', { buttons })) {
				for (const variant of chunk) variant.subscribed = true
			}
		}
	}

	/** Stop a link button showing its remote button, unsubscribing from it if no other does */
	#detach(controlId: string, button: LinkedButton): void {
		if (!button.key) return

		const key = button.key
		const remote = this.#remotes.get(key)
		button.key = null
		if (!remote) return

		remote.controlIds.delete(controlId)
		if (remote.controlIds.size > 0) {
			this.#updateDemand(remote)
			return
		}

		this.#remotes.delete(key)
		if (remote.publishTimer) clearTimeout(remote.publishTimer)
		for (const variant of remote.variants.values()) {
			if (variant.releaseTimer) clearTimeout(variant.releaseTimer)
		}
		this.#images.delete(remote.key)

		const subs = Array.from(remote.variants.values(), (v) => v.sub)
		for (const chunk of chunked(subs, LINK_BUTTONS_PER_MESSAGE)) {
			this.#sendToPeer(remote.peerId, 'unsubscribe', { buttons: chunk })
		}
	}

	/** The latency to a peer over its route, if it has been measured */
	#getLatency(peerId: string): number | null {
		const route = this.#peers.getRoute(peerId)
		return this.#peers.getPeer(peerId)?.routes.find((r) => r.transportId === route)?.latencyMs ?? null
	}

	/**
	 * Send a message to a peer, over its route
	 * @returns whether it was sent
	 */
	#sendToPeer<T extends LinkMessageType>(peerId: string, type: T, payload: LinkPayloadOfType<T>): boolean {
		const peer = this.#peers.getPeer(peerId)
		const route = this.#peers.getRoute(peerId)
		// Everything sent here is about buttons, so not to a peer that has said we may not use them
		if (!peer?.compatible || !route || peer.sharedWithUs?.buttons === false) {
			this.#logger.silly(`Not sending ${type} to ${peerId}, it is not reachable or doesn't share its buttons`)
			return false
		}

		this.#send(route, peerId, encodeLinkMessage(type, payload))
		return true
	}

	#refreshAllStates(): void {
		this.#trackUnreachable()
		for (const button of this.#buttons.values()) this.#refreshState(button)
	}

	/** Note when peers become unreachable or reachable again, for the grace period */
	#trackUnreachable(): void {
		const now = Date.now()
		const peers = this.#peers.getPeers()

		// Forget about peers that have been forgotten
		const knownIds = new Set(peers.map((p) => p.id))
		for (const peerId of this.#reachable) if (!knownIds.has(peerId)) this.#reachable.delete(peerId)

		for (const { id: peerId, online } of peers) {
			const entry = this.#unreachable.get(peerId)
			if (online) {
				this.#reachable.add(peerId)
				if (entry) {
					clearTimeout(entry.timer)
					this.#unreachable.delete(peerId)
				}
			} else if (this.#reachable.delete(peerId)) {
				const timer = setTimeout(() => {
					for (const button of this.#buttons.values()) this.#refreshState(button)
				}, LINK_UNREACHABLE_GRACE_MS)
				this.#unreachable.set(peerId, { since: now, timer })
			}
		}
	}

	/** Whether a peer is unreachable, but recently enough that it may come back without anyone noticing */
	#isInGracePeriod(peerId: string): boolean {
		const entry = this.#unreachable.get(peerId)
		return !!entry && Date.now() - entry.since < LINK_UNREACHABLE_GRACE_MS
	}

	#refreshState(button: LinkedButton): void {
		const remote = button.key ? this.#remotes.get(button.key) : undefined
		const peer = button.target ? (this.#peers.getPeer(button.target.peerId) ?? null) : null

		const inGracePeriod = !!button.target && this.#isInGracePeriod(button.target.peerId)
		const newState = computeState(
			button.target,
			peer && inGracePeriod ? { ...peer, online: true } : peer,
			remote?.published ?? null,
			this.#selfId(),
			remote ? getRefused(remote) : null,
			!!peer && inGracePeriod,
			button.key
		)
		if (isEqual(newState, button.state)) return

		button.state = newState
		button.onChange()
	}
}

function computeState(
	target: LinkButtonTarget | null,
	peer: Pick<LinkPeerInfo, 'name' | 'compatible' | 'online' | 'sharedWithUs'> | null,
	published: PublishedRender | null,
	selfId: string,
	refused: LinkSubscribeRefusedReason | null,
	unreachable: boolean,
	remoteKey: string | null
): LinkButtonState {
	const state: LinkButtonState = {
		status: 'unconfigured',
		peerName: peer?.name ?? null,
		remoteKey,
		images: [],
		unreachable: false,
		pressed: false,
		stepCurrent: 1,
		stepCount: 1,
		buttonStatus: undefined,
		actionRunning: false,
		sourceChain: [],
	}

	if (!target) return state
	if (!peer) return { ...state, status: 'unknown_peer' }
	if (!peer.compatible) return { ...state, status: 'incompatible' }
	if (!peer.online) return { ...state, status: 'offline' }
	if (peer.sharedWithUs?.buttons === false || refused === 'denied') return { ...state, status: 'denied' }
	if (refused === 'limit') return { ...state, status: 'over_limit' }
	if (!published) return { ...state, status: 'loading' }
	if (published.update.sourceChain.includes(selfId)) return { ...state, status: 'loop' }

	return {
		...state,
		status: 'ok',
		images: published.images,
		unreachable,
		pressed: published.update.pressed,
		stepCurrent: published.update.stepCurrent,
		stepCount: published.update.stepCount,
		buttonStatus: published.update.status ?? undefined,
		actionRunning: published.update.actionRunning,
		sourceChain: published.update.sourceChain,
	}
}

/** Why a remote button isn't shown, when the peer has refused it and sent nothing to show */
function getRefused(remote: RemoteButton): LinkSubscribeRefusedReason | null {
	if (remote.published) return null

	let refused: LinkSubscribeRefusedReason | null = null
	for (const variant of remote.variants.values()) {
		if (variant.refused === 'denied') return 'denied'
		refused ??= variant.refused
	}
	return refused
}

/** The image of a size of a remote button, if it has the newest render */
function currentImageOf(remote: RemoteButton, variant: Variant): LinkButtonImage | null {
	const { lastUpdate, image } = variant
	if (!lastUpdate || !image?.dataUrl) return null
	if (!isSameRevision(lastUpdate.revision, remote.latestUpdate?.revision ?? null)) return null

	return {
		width: lastUpdate.width,
		height: lastUpdate.height,
		dataUrl: image.dataUrl,
		revision: image.revision,
		current: true,
	}
}

function isSameRevision(a: LinkButtonRevision, b: LinkButtonRevision | null): boolean {
	return !!b && a.stream === b.stream && a.seq === b.seq
}

/** Whether a revision is newer than another. One of a different stream is, as the peer has started serving it again */
function isNewer(revision: LinkButtonRevision, than: LinkButtonRevision | null): boolean {
	return !than || revision.stream !== than.stream || revision.seq > than.seq
}

/** A key identifying a button of a peer */
function remoteKey(peerId: string, button: LinkButtonRef): string {
	return `${peerId}/${linkButtonSubscriptionKey({ button, width: 0, height: 0 })}`
}

/** A key identifying a size */
function sizeKey(size: Pick<LinkButtonSubscription, 'width' | 'height'>): string {
	return `${size.width}x${size.height}`
}

function toLinkButtonRef(location: ControlLocation): LinkButtonRef {
	return { type: 'location', page: location.pageNumber, row: location.row, column: location.column }
}

/** Split a list into chunks of at most a size */
function chunked<T>(items: readonly T[], size: number): T[][] {
	const chunks: T[][] = []
	for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
	return chunks
}

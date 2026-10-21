import isEqual from 'fast-deep-equal'
import { nanoid } from 'nanoid'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { LinkButtonStatus, LinkPeerInfo } from '@companion-app/shared/Model/Link.js'
import LogController from '../Log/Controller.js'
import type { LinkPeerRegistry } from './PeerRegistry.js'
import {
	encodeLinkMessage,
	linkButtonSubscriptionKey,
	type LinkButtonRef,
	type LinkButtonSubscription,
	type LinkMessageType,
	type LinkPayloadOfType,
	type LinkSubscribeRefusedReason,
} from './Protocol/v1/Schemas.js'
import { LINK_PRESS_EXPIRY_MS, LINK_SUBSCRIPTION_RENEW_MS } from './Protocol/v1/Timing.js'

/**
 * The size remote buttons are requested at. Larger than the 72px buttons are designed at, so that they still look
 * sharp on surfaces with larger buttons.
 * TODO: request the sizes the surfaces showing the button actually need
 */
export const LINK_BUTTON_BITMAP_SIZE = 144

/**
 * How long buttons keep showing the last image of a peer that has become unreachable, before showing it as
 * offline. Covers brief drops (eg a proxy closing the connection), so that they don't flicker
 */
export const LINK_UNREACHABLE_GRACE_MS = 10_000

export interface LinkButtonTarget {
	peerId: string
	location: ControlLocation
}

export interface LinkButtonState {
	status: LinkButtonStatus
	peerName: string | null
	/** The latest image of the remote button, when status is `ok` */
	dataUrl: string | null
	pressed: boolean
	/** The installations the image came through, for loop detection when we serve this button onwards */
	sourceChain: string[]
}

/** Send a message to a peer over a transport */
export type LinkButtonClientSend = (transportId: string, peerId: string, payload: string) => void

interface LinkedButton {
	target: LinkButtonTarget | null
	/** The key of the subscription this button uses (see subscriptionKey) */
	key: string | null
	onChange: () => void
	state: LinkButtonState
}

interface RemoteSubscription {
	readonly peerId: string
	readonly sub: LinkButtonSubscription
	readonly controlIds: Set<string>
	lastUpdate: LinkPayloadOfType<'button.update'> | null
	/** Why the peer said it doesn't serve the button, until an update says it does */
	refused: LinkSubscribeRefusedReason | null
}

/**
 * The client side of the button protocol: subscribes to the remote buttons that link buttons on this
 * installation show, keeps the subscriptions alive, and forwards presses. Link buttons that show the same remote
 * button share one subscription.
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

	readonly #buttons = new Map<string, LinkedButton>()
	/** Subscriptions by peer, button and size (see subscriptionKey) */
	readonly #subscriptions = new Map<string, RemoteSubscription>()

	#renewTimer: NodeJS.Timeout | null = null

	/** When each peer became unreachable, and the timer to show it as offline once the grace period is over */
	readonly #unreachable = new Map<string, { since: number; timer: NodeJS.Timeout }>()
	/** Peers last seen reachable, so that only a peer that drops out gets the grace period */
	readonly #reachable = new Set<string>()

	constructor(selfId: () => string, peers: LinkPeerRegistry, send: LinkButtonClientSend) {
		this.#selfId = selfId
		this.#peers = peers
		this.#send = send

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
		for (const subscription of this.#subscriptions.values()) if (subscription.peerId === peerId) count++
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
	}

	/**
	 * Set (or change) what a link button shows. `onChange` is called whenever its state changes
	 */
	setTarget(controlId: string, target: LinkButtonTarget | null, onChange: () => void): void {
		let button = this.#buttons.get(controlId)
		if (!button) {
			button = { target: null, key: null, onChange, state: computeState(null, null, null, null, '') }
			this.#buttons.set(controlId, button)
		}
		button.onChange = onChange

		if (!isEqual(button.target, target)) {
			button.target = target
			this.#releaseSubscription(controlId, button)

			if (target) {
				const sub: LinkButtonSubscription = {
					button: toLinkButtonRef(target.location),
					width: LINK_BUTTON_BITMAP_SIZE,
					height: LINK_BUTTON_BITMAP_SIZE,
				}
				button.key = subscriptionKey(target.peerId, sub)

				let subscription = this.#subscriptions.get(button.key)
				if (!subscription) {
					subscription = { peerId: target.peerId, sub, controlIds: new Set(), lastUpdate: null, refused: null }
					this.#subscriptions.set(button.key, subscription)
					this.#sendToPeer(target.peerId, 'subscribe', { buttons: [{ ...sub, have: null }] })
				}
				subscription.controlIds.add(controlId)
			}
		}

		this.#refreshState(button)
	}

	/** A link button has been deleted */
	removeTarget(controlId: string): void {
		const button = this.#buttons.get(controlId)
		if (!button) return

		this.#releaseSubscription(controlId, button)
		this.#buttons.delete(controlId)
	}

	getState(controlId: string): LinkButtonState | undefined {
		return this.#buttons.get(controlId)?.state
	}

	press(controlId: string, pressed: boolean, surfaceId: string): void {
		const target = this.#buttons.get(controlId)?.target
		if (!target) return

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

	/** An update arrived from a peer. Ignored unless we are subscribed to that button of that peer */
	handleUpdate(peerId: string, payload: LinkPayloadOfType<'button.update'>): void {
		const subscription = this.#subscriptions.get(subscriptionKey(peerId, payload))
		if (!subscription) return

		// Updates may arrive out of order, eg over different transports. Keep the newest
		const held = subscription.lastUpdate?.revision
		if (held && held.stream === payload.revision.stream && held.seq >= payload.revision.seq) return

		subscription.lastUpdate = payload
		subscription.refused = null
		this.#refreshSubscription(subscription)
	}

	/** A peer said it doesn't serve some of the buttons we subscribed to, and why */
	handleRefused(peerId: string, payload: LinkPayloadOfType<'subscribe.refused'>): void {
		for (const { reason, ...sub } of payload.buttons) {
			const subscription = this.#subscriptions.get(subscriptionKey(peerId, sub))
			if (!subscription || subscription.refused === reason) continue

			subscription.refused = reason
			this.#refreshSubscription(subscription)
		}
	}

	#refreshSubscription(subscription: RemoteSubscription): void {
		for (const controlId of subscription.controlIds) {
			const button = this.#buttons.get(controlId)
			if (button) this.#refreshState(button)
		}
	}

	/** Renew the leases of all our subscriptions */
	renewAll(): void {
		const peerIds = new Set(Array.from(this.#subscriptions.values(), (s) => s.peerId))
		for (const peerId of peerIds) this.#subscribeAllForPeer(peerId)
	}

	/** Subscribe to (or renew) all our subscriptions to a peer, saying what we have so that it sends what we miss */
	#subscribeAllForPeer(peerId: string): void {
		const buttons = Array.from(this.#subscriptions.values())
			.filter((s) => s.peerId === peerId)
			.map((s) => ({ ...s.sub, have: s.lastUpdate?.revision ?? null }))
		if (buttons.length === 0) return

		this.#sendToPeer(peerId, 'subscribe', { buttons })
	}

	#releaseSubscription(controlId: string, button: LinkedButton): void {
		if (!button.key) return

		const key = button.key
		const subscription = this.#subscriptions.get(key)
		button.key = null
		if (!subscription) return

		subscription.controlIds.delete(controlId)
		if (subscription.controlIds.size > 0) return

		this.#subscriptions.delete(key)
		this.#sendToPeer(subscription.peerId, 'unsubscribe', { buttons: [subscription.sub] })
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
		const subscription = button.key ? this.#subscriptions.get(button.key) : undefined
		const peer = button.target ? (this.#peers.getPeer(button.target.peerId) ?? null) : null

		const inGracePeriod = !!button.target && this.#isInGracePeriod(button.target.peerId)
		const newState = computeState(
			button.target,
			peer && inGracePeriod ? { ...peer, online: true } : peer,
			subscription?.lastUpdate ?? null,
			subscription?.refused ?? null,
			this.#selfId()
		)
		if (isEqual(newState, button.state)) return

		button.state = newState
		button.onChange()
	}
}

function computeState(
	target: LinkButtonTarget | null,
	peer: Pick<LinkPeerInfo, 'name' | 'compatible' | 'online' | 'sharedWithUs'> | null,
	lastUpdate: LinkPayloadOfType<'button.update'> | null,
	refused: LinkSubscribeRefusedReason | null,
	selfId: string
): LinkButtonState {
	const state: LinkButtonState = {
		status: 'unconfigured',
		peerName: peer?.name ?? null,
		dataUrl: null,
		pressed: false,
		sourceChain: [],
	}

	if (!target) return state
	if (!peer) return { ...state, status: 'unknown_peer' }
	if (!peer.compatible) return { ...state, status: 'incompatible' }
	if (!peer.online) return { ...state, status: 'offline' }
	if (peer.sharedWithUs?.buttons === false || refused === 'denied') return { ...state, status: 'denied' }
	if (refused === 'limit') return { ...state, status: 'over_limit' }
	if (!lastUpdate) return { ...state, status: 'loading' }
	if (lastUpdate.sourceChain.includes(selfId)) return { ...state, status: 'loop' }

	return {
		...state,
		status: 'ok',
		dataUrl: lastUpdate.dataUrl,
		pressed: lastUpdate.pressed,
		sourceChain: lastUpdate.sourceChain,
	}
}

/** A key identifying a subscription to a button of a peer, at a size */
function subscriptionKey(peerId: string, sub: Pick<LinkButtonSubscription, 'button' | 'width' | 'height'>): string {
	return `${peerId}/${linkButtonSubscriptionKey(sub)}`
}

function toLinkButtonRef(location: ControlLocation): LinkButtonRef {
	return { type: 'location', page: location.pageNumber, row: location.row, column: location.column }
}

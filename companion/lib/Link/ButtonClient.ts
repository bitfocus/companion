import isEqual from 'fast-deep-equal'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { LinkButtonStatus, LinkPeerInfo } from '@companion-app/shared/Model/Link.js'
import LogController from '../Log/Controller.js'
import type { LinkPeerRegistry } from './PeerRegistry.js'
import {
	encodeLinkMessage,
	type LinkButtonSubscription,
	type LinkMessageType,
	type LinkPayloadOfType,
} from './Protocol/Schemas.js'
import { LINK_SUBSCRIPTION_RENEW_MS, linkButtonUpdateTopic, linkInboxTopic } from './Protocol/Topics.js'
import { getLinkPeerFeatures } from './Protocol/Versions.js'

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

/** What the button client needs from the transports */
export interface LinkButtonClientTransports {
	publishTo(transportId: string, topic: string, payload: string): void
	subscribe(pattern: string): void
	unsubscribe(pattern: string): void
}

interface LinkedButton {
	target: LinkButtonTarget | null
	/** The update topic of the subscription this button uses */
	topic: string | null
	onChange: () => void
	state: LinkButtonState
}

interface RemoteSubscription {
	readonly peerId: string
	readonly sub: LinkButtonSubscription
	readonly controlIds: Set<string>
	lastUpdate: LinkPayloadOfType<'button.update'> | null
}

/**
 * The client side of the button protocol: subscribes to the remote buttons that link buttons on this
 * installation show, keeps the subscriptions alive, and forwards presses. Link buttons that show the same remote
 * button share one subscription.
 */
export class LinkButtonClient {
	readonly #logger = LogController.createLogger('Link/ButtonClient')

	readonly #selfId: () => string
	readonly #peers: LinkPeerRegistry
	readonly #transports: LinkButtonClientTransports

	readonly #buttons = new Map<string, LinkedButton>()
	/** Subscriptions by update topic */
	readonly #subscriptions = new Map<string, RemoteSubscription>()

	#renewTimer: NodeJS.Timeout | null = null

	/** When each peer became unreachable, and the timer to show it as offline once the grace period is over */
	readonly #unreachable = new Map<string, { since: number; timer: NodeJS.Timeout }>()
	/** Peers last seen reachable, so that only a peer that drops out gets the grace period */
	readonly #reachable = new Set<string>()

	constructor(selfId: () => string, peers: LinkPeerRegistry, transports: LinkButtonClientTransports) {
		this.#selfId = selfId
		this.#peers = peers
		this.#transports = transports

		peers.on('changed', () => this.#refreshAllStates())
		// We may have missed updates while it was unreachable, so ask for the current state
		peers.on('peerReachable', (peerId, transportId) => this.#subscribeAllForPeer(peerId, [transportId], true))
		// It may have just started sharing its buttons with us
		peers.on('sharedWithUsChanged', (peerId, transportId) => {
			if (this.#peers.getReachableTransports(peerId, 'buttons').includes(transportId)) {
				this.#subscribeAllForPeer(peerId, [transportId], true)
			}
		})
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
			button = { target: null, topic: null, onChange, state: computeState(null, null, null, '') }
			this.#buttons.set(controlId, button)
		}
		button.onChange = onChange

		if (!isEqual(button.target, target)) {
			button.target = target
			this.#releaseSubscription(controlId, button)

			if (target) {
				const sub: LinkButtonSubscription = {
					page: target.location.pageNumber,
					row: target.location.row,
					column: target.location.column,
					width: LINK_BUTTON_BITMAP_SIZE,
					height: LINK_BUTTON_BITMAP_SIZE,
				}
				button.topic = linkButtonUpdateTopic(target.peerId, sub)

				let subscription = this.#subscriptions.get(button.topic)
				if (!subscription) {
					subscription = { peerId: target.peerId, sub, controlIds: new Set(), lastUpdate: null }
					this.#subscriptions.set(button.topic, subscription)

					this.#transports.subscribe(button.topic)
					this.#sendToPeer(
						target.peerId,
						'subscribe',
						{ requestorId: this.#selfId(), buttons: [sub], sendCurrent: true },
						true
					)
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

		this.#sendToPeer(
			target.peerId,
			'button.press',
			{ ...toLinkLocation(target.location), sourceId: this.#selfId(), pressed, surfaceId },
			false
		)
	}

	/** @returns whether the rotation was sent */
	rotate(controlId: string, delta: number, surfaceId: string): boolean {
		const target = this.#buttons.get(controlId)?.target
		if (!target) return false

		const peer = this.#peers.getPeer(target.peerId)
		if (!peer || !getLinkPeerFeatures(peer.protocolVersion).rotate) return false

		return this.#sendToPeer(
			target.peerId,
			'button.rotate',
			{ ...toLinkLocation(target.location), sourceId: this.#selfId(), delta, surfaceId },
			false
		)
	}

	/** An update arrived for a subscribed button */
	handleUpdate(topic: string, payload: LinkPayloadOfType<'button.update'>): void {
		const subscription = this.#subscriptions.get(topic)
		if (!subscription) return

		subscription.lastUpdate = payload
		for (const controlId of subscription.controlIds) {
			const button = this.#buttons.get(controlId)
			if (button) this.#refreshState(button)
		}
	}

	/** Renew the leases of all our subscriptions */
	renewAll(): void {
		const peerIds = new Set(Array.from(this.#subscriptions.values(), (s) => s.peerId))
		for (const peerId of peerIds) {
			this.#subscribeAllForPeer(peerId, this.#peers.getReachableTransports(peerId, 'buttons'), false)
		}
	}

	#subscribeAllForPeer(peerId: string, transportIds: string[], sendCurrent: boolean): void {
		if (!this.#peers.getPeer(peerId)?.compatible) return

		const buttons = Array.from(this.#subscriptions.values())
			.filter((s) => s.peerId === peerId)
			.map((s) => s.sub)
		if (buttons.length === 0) return

		const payload = encodeLinkMessage('subscribe', { requestorId: this.#selfId(), buttons, sendCurrent })
		for (const transportId of transportIds) {
			this.#transports.publishTo(transportId, linkInboxTopic(peerId), payload)
		}
	}

	#releaseSubscription(controlId: string, button: LinkedButton): void {
		if (!button.topic) return

		const subscription = this.#subscriptions.get(button.topic)
		button.topic = null
		if (!subscription) return

		subscription.controlIds.delete(controlId)
		if (subscription.controlIds.size > 0) return

		const topic = linkButtonUpdateTopic(subscription.peerId, subscription.sub)
		this.#subscriptions.delete(topic)
		this.#transports.unsubscribe(topic)
		this.#sendToPeer(
			subscription.peerId,
			'unsubscribe',
			{ requestorId: this.#selfId(), buttons: [subscription.sub] },
			true
		)
	}

	/**
	 * Send a message to a peer's inbox. Subscriptions are sent on every transport the peer is reachable on, so that
	 * updates keep flowing if one fails. Commands are sent on just one, so they aren't performed twice
	 * @returns whether there was a transport to send it on
	 */
	#sendToPeer<T extends LinkMessageType>(
		peerId: string,
		type: T,
		payload: LinkPayloadOfType<T>,
		allTransports: boolean
	): boolean {
		const peer = this.#peers.getPeer(peerId)
		// Everything sent here is about buttons, so only over transports where we may use them
		const transportIds = peer?.compatible ? this.#peers.getReachableTransports(peerId, 'buttons') : []
		if (transportIds.length === 0) {
			this.#logger.silly(`Not sending ${type} to ${peerId}, it is not reachable`)
			return false
		}

		const encoded = encodeLinkMessage(type, payload)
		for (const transportId of allTransports ? transportIds : transportIds.slice(0, 1)) {
			this.#transports.publishTo(transportId, linkInboxTopic(peerId), encoded)
		}
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
		const subscription = button.topic ? this.#subscriptions.get(button.topic) : undefined
		const peer = button.target ? (this.#peers.getPeer(button.target.peerId) ?? null) : null

		const inGracePeriod = !!button.target && this.#isInGracePeriod(button.target.peerId)
		const newState = computeState(
			button.target,
			peer && inGracePeriod ? { ...peer, online: true } : peer,
			subscription?.lastUpdate ?? null,
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
	if (peer.sharedWithUs?.buttons === false) return { ...state, status: 'denied' }
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

function toLinkLocation(location: ControlLocation): { page: number; row: number; column: number } {
	return { page: location.pageNumber, row: location.row, column: location.column }
}

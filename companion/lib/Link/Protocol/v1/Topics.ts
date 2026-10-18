import type { LinkButtonRef, LinkButtonSubscription } from './Schemas.js'

/**
 * Topics used by major version 1 of the Link protocol, once a peer has been discovered (see ../Announcement.ts for
 * the discovery topics).
 *
 * The protocol is described as publish/subscribe over hierarchical topics, using MQTT conventions (`/` separated,
 * `+` matches one level, `#` matches the remainder). Transports that are not a broker emulate this; see
 * Transports/README.md.
 *
 * Routing is done on topics, but receivers dispatch on the `type` in the message envelope. Every topic starts with
 * the major version, so that a peer that speaks several only receives the messages of the one it uses, and peers
 * using different major versions don't see each other's messages on shared topics (eg button updates).
 *
 * The topics are relative to Link. A transport on a backend shared with other things (eg an MQTT broker) puts them
 * under a prefix of its own.
 */

/** The start of every topic of a peer */
export function linkPeerTopicPrefix(peerId: string): string {
	return `v1/peers/${peerId}/`
}

/** Messages sent to a peer (access, subscribe, unsubscribe, button.press, button.rotate) */
export function linkInboxTopic(peerId: string): string {
	return `${linkPeerTopicPrefix(peerId)}inbox`
}

/** Updates for a subscribed button, published by the peer that owns the button */
export function linkButtonUpdateTopic(peerId: string, sub: LinkButtonSubscription): string {
	return `${linkPeerTopicPrefix(peerId)}button/${linkButtonRefPath(sub.button)}/${sub.width}x${sub.height}`
}

/** The topic levels identifying a button, starting with how it is referred to */
function linkButtonRefPath(ref: LinkButtonRef): string {
	switch (ref.type) {
		case 'location':
			return `location/${ref.page}/${ref.row}/${ref.column}`
	}
}

/** How long a subscription lasts without being renewed */
export const LINK_SUBSCRIPTION_LEASE_MS = 60_000

/** How often subscribers renew their subscriptions, comfortably inside the lease */
export const LINK_SUBSCRIPTION_RENEW_MS = 20_000

/** How long to wait for a pong before giving up on a ping */
export const LINK_PING_TIMEOUT_MS = 2_000

import type { LinkButtonSubscription } from './Schemas.js'

/**
 * Topics used by the Link protocol.
 *
 * The protocol is described as publish/subscribe over hierarchical topics, using MQTT conventions (`/` separated,
 * `+` matches one level, `#` matches the remainder). Transports that are not a broker emulate this; see
 * Transports/README.md.
 *
 * Routing is done on topics, but receivers dispatch on the `type` in the message envelope, so the topic only needs
 * to be parsed for the discovery messages (where an empty payload means a peer went offline).
 */

export const LINK_TOPIC_PREFIX = 'companion-link'

/** Retained announcement of a peer. An empty payload means it has gone offline */
export function linkDiscoveryTopic(peerId: string): string {
	return `${LINK_TOPIC_PREFIX}/discovery/${peerId}`
}

export const LINK_DISCOVERY_WILDCARD = `${LINK_TOPIC_PREFIX}/discovery/+`

/** Parse the peer id from a discovery topic */
export function parseLinkDiscoveryTopic(topic: string): string | null {
	const prefix = `${LINK_TOPIC_PREFIX}/discovery/`
	if (!topic.startsWith(prefix)) return null
	const id = topic.slice(prefix.length)
	return id && !id.includes('/') ? id : null
}

/** Messages sent to a peer (access, subscribe, unsubscribe, button.press, button.rotate) */
export function linkInboxTopic(peerId: string): string {
	return `${LINK_TOPIC_PREFIX}/${peerId}/inbox`
}

/** Updates for a subscribed button, published by the peer that owns the button */
export function linkButtonUpdateTopic(peerId: string, sub: LinkButtonSubscription): string {
	return `${LINK_TOPIC_PREFIX}/${peerId}/button/${sub.page}/${sub.row}/${sub.column}/${sub.width}x${sub.height}`
}

/** How often each installation repeats its announcement */
export const LINK_ANNOUNCE_INTERVAL_MS = 15_000

/** A peer is considered offline after missing this many announcements */
export const LINK_ANNOUNCE_MISSED_LIMIT = 3

/** How long a subscription lasts without being renewed */
export const LINK_SUBSCRIPTION_LEASE_MS = 60_000

/** How often subscribers renew their subscriptions, comfortably inside the lease */
export const LINK_SUBSCRIPTION_RENEW_MS = 20_000

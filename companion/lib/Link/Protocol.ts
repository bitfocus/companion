/**
 * Companion Link protocol message types
 *
 * Payload interfaces are generated from assets/link-protocol.schema.json
 * via `yarn build:link-schema`. Do NOT hand-edit the payload shapes here —
 * modify the JSON Schema instead and re-run the generator.
 *
 * This file re-exports those generated types, defines the generic message
 * envelope, composes discriminated-union message types, and provides
 * MQTT topic helpers.
 */

// ── Re-export generated payload types ──────────────────────
export type {
	LinkAnnouncementPayload as AnnouncementPayload,
	LinkSubscribeRequestPayload as SubscribeRequestPayload,
	LinkSubscribeResponsePayload as SubscribeResponsePayload,
	LinkSubscribeResponseButtonState as SubscribeResponseButtonState,
	LinkUnsubscribeRequestPayload as UnsubscribeRequestPayload,
	LinkButtonCommandPayload as ButtonCommandPayload,
	LinkButtonUpdatePayload as ButtonUpdatePayload,
	LinkButtonLocation as ButtonLocation,
	LinkButtonLocationWithResolution as ButtonLocationWithResolution,
	LinkGridSize as GridSize,
} from './LinkProtocolSchema.js'

import type {
	LinkAnnouncementPayload,
	LinkSubscribeRequestPayload,
	LinkSubscribeResponsePayload,
	LinkUnsubscribeRequestPayload,
	LinkButtonCommandPayload,
	LinkButtonUpdatePayload,
} from './LinkProtocolSchema.js'

// ── Message envelope ───────────────────────────────────────

/** Base envelope for all Link protocol messages */
export interface LinkMessage<T extends string = string, P = unknown> {
	/** Protocol envelope version */
	version: 1
	/** Message type discriminator */
	type: T
	/** Message payload */
	payload: P
}

// ── Composed message types (envelope + payload) ────────────

export type AnnouncementMessage = LinkMessage<'announcement', LinkAnnouncementPayload>

export type SubscribeRequestMessage = LinkMessage<'subscribe.request', LinkSubscribeRequestPayload>
export type SubscribeResponseMessage = LinkMessage<'subscribe.response', LinkSubscribeResponsePayload>
export type UnsubscribeRequestMessage = LinkMessage<'unsubscribe.request', LinkUnsubscribeRequestPayload>

export type ButtonPressMessage = LinkMessage<'button.press', LinkButtonCommandPayload>
export type ButtonReleaseMessage = LinkMessage<'button.release', LinkButtonCommandPayload>

export type ButtonUpdateMessage = LinkMessage<'button.update', LinkButtonUpdatePayload>

// ── Topic Helpers ──────────────────────────────────────────

export const LINK_TOPIC_PREFIX = 'companion-link'

export function discoveryTopic(uuid: string): string {
	return `${LINK_TOPIC_PREFIX}/discovery/${uuid}`
}

export function discoveryWildcard(): string {
	return `${LINK_TOPIC_PREFIX}/discovery/+`
}

export function updateTopic(
	uuid: string,
	page: number,
	row: number,
	col: number,
	width: number,
	height: number
): string {
	return `${LINK_TOPIC_PREFIX}/${uuid}/location/${page}/${row}/${col}/update/${width}x${height}`
}

export function pressTopic(uuid: string, page: number, row: number, col: number): string {
	return `${LINK_TOPIC_PREFIX}/${uuid}/location/${page}/${row}/${col}/press`
}

export function releaseTopic(uuid: string, page: number, row: number, col: number): string {
	return `${LINK_TOPIC_PREFIX}/${uuid}/location/${page}/${row}/${col}/release`
}

export function rpcRequestTopic(uuid: string, correlationId: string): string {
	return `${LINK_TOPIC_PREFIX}/${uuid}/rpc/${correlationId}/request`
}

export function rpcResponseTopic(uuid: string, correlationId: string): string {
	return `${LINK_TOPIC_PREFIX}/${uuid}/rpc/${correlationId}/response`
}

export function chunksTopic(): string {
	return `${LINK_TOPIC_PREFIX}/chunks`
}

/**
 * Wildcard pattern for subscribing to all button update topics for a specific instance.
 * Used by clients that want to receive updates from a remote instance.
 */
export function updateWildcard(uuid: string): string {
	return `${LINK_TOPIC_PREFIX}/${uuid}/location/+/+/+/update/+`
}

/**
 * Wildcard pattern for subscribing to all press commands for our instance.
 */
export function pressWildcard(uuid: string): string {
	return `${LINK_TOPIC_PREFIX}/${uuid}/location/+/+/+/press`
}

/**
 * Wildcard pattern for subscribing to all release commands for our instance.
 */
export function releaseWildcard(uuid: string): string {
	return `${LINK_TOPIC_PREFIX}/${uuid}/location/+/+/+/release`
}

/**
 * Wildcard pattern for subscribing to all RPC requests for our instance.
 */
export function rpcRequestWildcard(uuid: string): string {
	return `${LINK_TOPIC_PREFIX}/${uuid}/rpc/+/request`
}

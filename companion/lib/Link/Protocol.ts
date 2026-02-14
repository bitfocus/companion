/**
 * Companion Link protocol message types
 * Transport-agnostic message definitions
 */

/** Base envelope for all Link protocol messages */
export interface LinkMessage<T extends string = string, P = unknown> {
	/** Protocol envelope version */
	version: 1
	/** Message type discriminator */
	type: T
	/** Message payload */
	payload: P
}

// ── Discovery ──────────────────────────────────────────────

export interface AnnouncementPayload {
	/** Unique instance ID */
	id: string
	/** Human-readable instance name */
	name: string
	/** Companion app version */
	version: string
	/** Link protocol version */
	protocolVersion: number
	/** Number of pages configured */
	pageCount: number
	/** Grid dimensions */
	gridSize: { rows: number; cols: number }
	/** Unix timestamp (ms) */
	timestamp: number
}

export type AnnouncementMessage = LinkMessage<'announcement', AnnouncementPayload>

// ── Subscription ───────────────────────────────────────────

export interface ButtonLocation {
	page: number
	row: number
	col: number
}

export interface ButtonLocationWithResolution extends ButtonLocation {
	resolution: { width: number; height: number }
}

export interface SubscribeRequestPayload {
	buttons: ButtonLocationWithResolution[]
	timestamp: number
}

export type SubscribeRequestMessage = LinkMessage<'subscribe.request', SubscribeRequestPayload>

export interface SubscribeResponseButtonState {
	page: number
	row: number
	col: number
	bitmap: string | null
	pressed: boolean
}

export interface SubscribeResponsePayload {
	states: SubscribeResponseButtonState[]
	timestamp: number
}

export type SubscribeResponseMessage = LinkMessage<'subscribe.response', SubscribeResponsePayload>

export interface UnsubscribeRequestPayload {
	buttons: ButtonLocationWithResolution[]
	timestamp: number
}

export type UnsubscribeRequestMessage = LinkMessage<'unsubscribe.request', UnsubscribeRequestPayload>

// ── Button Commands ────────────────────────────────────────

export interface ButtonCommandPayload {
	page: number
	row: number
	col: number
	timestamp: number
}

export type ButtonPressMessage = LinkMessage<'button.press', ButtonCommandPayload>
export type ButtonReleaseMessage = LinkMessage<'button.release', ButtonCommandPayload>

// ── Bitmap Updates ─────────────────────────────────────────

export interface BitmapUpdatePayload {
	page: number
	row: number
	col: number
	width: number
	height: number
	/** Base64-encoded PNG */
	bitmap: string
	timestamp: number
}

export type BitmapUpdateMessage = LinkMessage<'bitmap.update', BitmapUpdatePayload>

// ── Chunking ───────────────────────────────────────────────

export interface ChunkHeader {
	/** Unique message ID for reassembly */
	id: string
	/** Chunk index (0-based) */
	idx: number
	/** Total number of chunks */
	total: number
	/** Total assembled size in bytes */
	size: number
	/** CRC32 of this chunk's data */
	crc: number
}

// ── Topic Helpers ──────────────────────────────────────────

export const LINK_TOPIC_PREFIX = 'companion-link'

export function discoveryTopic(uuid: string): string {
	return `${LINK_TOPIC_PREFIX}/discovery/${uuid}`
}

export function discoveryWildcard(): string {
	return `${LINK_TOPIC_PREFIX}/discovery/+`
}

export function bitmapTopic(
	uuid: string,
	page: number,
	row: number,
	col: number,
	width: number,
	height: number
): string {
	return `${LINK_TOPIC_PREFIX}/${uuid}/location/${page}/${row}/${col}/bitmap/${width}x${height}`
}

export function stateTopic(uuid: string, page: number, row: number, col: number): string {
	return `${LINK_TOPIC_PREFIX}/${uuid}/location/${page}/${row}/${col}/state`
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

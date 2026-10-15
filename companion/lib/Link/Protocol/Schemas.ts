import { z } from 'zod'

/**
 * The Companion Link wire protocol.
 *
 * These zod schemas are the source of truth for the protocol: incoming messages are validated against them, and
 * `yarn build:link-schema` generates `assets/link-protocol.schema.json` from them for implementations in other
 * languages. Any change here must be accompanied by a bump of LINK_PROTOCOL_VERSION (see Versions.ts).
 *
 * Every message is a JSON object with the envelope `{ version, type, payload }`. `version` is the version of the
 * envelope itself, which is not expected to ever change. Compatibility between peers is decided by the
 * `protocolVersion` in their announcements (see Versions.ts), so the announcement must stay readable by every
 * version: only ever add optional fields to it.
 */

/** The version of the message envelope */
export const LINK_ENVELOPE_VERSION = 1

const PeerIdSchema = z.string().min(1).max(64).describe('Unique id of a Companion installation')

const ButtonLocationShape = {
	page: z.number().int().min(1).describe('Page number'),
	row: z.number().int().describe('Row number'),
	column: z.number().int().describe('Column number'),
}

const BitmapSizeShape = {
	width: z.number().int().min(8).max(1024).describe('Bitmap width in pixels'),
	height: z.number().int().min(8).max(1024).describe('Bitmap height in pixels'),
}

export const LinkButtonLocationSchema = z.object(ButtonLocationShape).describe('Identifies a button on a peer')

export const LinkButtonSubscriptionSchema = z
	.object({ ...ButtonLocationShape, ...BitmapSizeShape })
	.describe('A button, and the size the subscriber wants its bitmap rendered at')

export const LinkAnnouncementPayloadSchema = z
	.object({
		id: PeerIdSchema,
		name: z.string().max(200).describe('Human readable name of the installation'),
		companionVersion: z.string().describe('Companion application version'),
		protocolVersion: z
			.string()
			.describe('Link protocol version (semver). Peers can only talk if the major versions match'),
		pageCount: z.number().int().min(0).describe('Number of pages'),
		grid: z
			.object({
				minRow: z.number().int(),
				maxRow: z.number().int(),
				minColumn: z.number().int(),
				maxColumn: z.number().int(),
			})
			.describe('Bounds of the button grid'),
		announceIntervalMs: z
			.number()
			.int()
			.positive()
			.describe('How often this announcement is repeated. Peers consider it gone after missing a few'),
	})
	.describe('Periodic announcement of an installation. Published retained, an empty payload means it went offline')

export const LinkSubscribePayloadSchema = z
	.object({
		requestorId: PeerIdSchema,
		buttons: z.array(LinkButtonSubscriptionSchema).max(1000),
		sendCurrent: z
			.boolean()
			.describe(
				'Whether the current state of the buttons should be sent straight away. False for renewals, to avoid resending unchanged images'
			),
	})
	.describe(
		'Ask a peer to start (or keep) publishing updates for some buttons. Subscriptions are leases: they must be renewed by repeating this message before LINK_SUBSCRIPTION_LEASE_MS elapses'
	)

export const LinkUnsubscribePayloadSchema = z
	.object({
		requestorId: PeerIdSchema,
		buttons: z.array(LinkButtonSubscriptionSchema).max(1000),
	})
	.describe('Release some subscriptions before their lease expires')

export const LinkButtonUpdatePayloadSchema = z
	.object({
		...ButtonLocationShape,
		...BitmapSizeShape,
		dataUrl: z.string().nullable().describe('PNG data url of the rendered button, or null if there is nothing to show'),
		pressed: z.boolean().describe('Whether the button is currently pressed'),
		sourceChain: z
			.array(PeerIdSchema)
			.max(16)
			.describe('Ids of the installations this image has passed through, used to detect loops'),
	})
	.describe('The current rendered state of a subscribed button')

export const LinkButtonPressPayloadSchema = z
	.object({
		...ButtonLocationShape,
		sourceId: PeerIdSchema,
		pressed: z.boolean(),
		surfaceId: z
			.string()
			.max(512)
			.describe('Id of the originating surface on the source, so that held buttons are tracked per surface'),
	})
	.describe('Press or release a button on a peer')

export const LinkButtonRotatePayloadSchema = z
	.object({
		...ButtonLocationShape,
		sourceId: PeerIdSchema,
		delta: z.number().int().describe('Signed number of rotation steps, positive is clockwise'),
		surfaceId: z.string().max(512),
	})
	.describe('Rotate an encoder button on a peer')

function envelope<TType extends string, TPayload extends z.ZodType>(type: TType, payload: TPayload) {
	return z.object({
		version: z.literal(LINK_ENVELOPE_VERSION),
		type: z.literal(type),
		payload,
	})
}

export const LinkMessageSchema = z.discriminatedUnion('type', [
	envelope('announcement', LinkAnnouncementPayloadSchema),
	envelope('subscribe', LinkSubscribePayloadSchema),
	envelope('unsubscribe', LinkUnsubscribePayloadSchema),
	envelope('button.update', LinkButtonUpdatePayloadSchema),
	envelope('button.press', LinkButtonPressPayloadSchema),
	envelope('button.rotate', LinkButtonRotatePayloadSchema),
])

export type LinkMessage = z.infer<typeof LinkMessageSchema>
export type LinkMessageType = LinkMessage['type']
export type LinkMessageOfType<T extends LinkMessageType> = Extract<LinkMessage, { type: T }>
export type LinkPayloadOfType<T extends LinkMessageType> = LinkMessageOfType<T>['payload']

export type LinkAnnouncementPayload = z.infer<typeof LinkAnnouncementPayloadSchema>
export type LinkButtonLocation = z.infer<typeof LinkButtonLocationSchema>
export type LinkButtonSubscription = z.infer<typeof LinkButtonSubscriptionSchema>

/** Serialise a message for the wire */
export function encodeLinkMessage<T extends LinkMessageType>(type: T, payload: LinkPayloadOfType<T>): string {
	return JSON.stringify({ version: LINK_ENVELOPE_VERSION, type, payload })
}

/**
 * Parse and validate a message from the wire
 * @returns the message, or an error describing why it was rejected
 */
export function decodeLinkMessage(raw: string): { ok: true; message: LinkMessage } | { ok: false; error: string } {
	let json: unknown
	try {
		json = JSON.parse(raw)
	} catch {
		return { ok: false, error: 'Invalid JSON' }
	}

	if (typeof json === 'object' && json !== null && 'version' in json && json.version !== LINK_ENVELOPE_VERSION) {
		return { ok: false, error: `Unsupported envelope version ${String(json.version)}` }
	}

	const result = LinkMessageSchema.safeParse(json)
	if (!result.success) return { ok: false, error: z.prettifyError(result.error) }

	return { ok: true, message: result.data }
}

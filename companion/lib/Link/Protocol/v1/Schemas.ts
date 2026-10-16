import { z } from 'zod'

/**
 * The Companion Link wire protocol, major version 1: the messages exchanged with a peer once it has been discovered
 * (see ../Announcement.ts for discovery, which is the same for every major version).
 *
 * These zod schemas are the source of truth for the protocol: incoming messages are validated against them. Any change
 * here must be accompanied by a bump of LINK_PROTOCOL_VERSIONS (see ../Versions.ts).
 *
 * Every message is a JSON object with the envelope `{ type, payload }`. The major version is not in the message, but
 * in the topic it is published on (see Topics.ts), so a new major version gets a folder of its own alongside this one
 * (`v2/`), with topics of its own.
 *
 * Messages don't say who sent them: that is up to the transport, which knows (or can prove) who is at the other end,
 * and reports it with each message it receives (see LinkMessageOrigin).
 */

const PeerIdSchema = z.string().min(1).max(64).describe('Unique id of a Companion installation')

const SurfaceIdSchema = z
	.string()
	.max(512)
	.describe('Id of the originating surface on the source, so that held buttons are tracked per surface')

const BitmapSizeShape = {
	width: z.number().int().min(8).max(1024).describe('Bitmap width in pixels'),
	height: z.number().int().min(8).max(1024).describe('Bitmap height in pixels'),
}

const LinkButtonLocationRefSchema = z
	.object({
		type: z.literal('location'),
		page: z.number().int().min(1).describe('Page number'),
		row: z.number().int().describe('Row number'),
		column: z.number().int().describe('Column number'),
	})
	.describe('A button by its position in the grid')

export const LinkButtonRefSchema = z
	.discriminatedUnion('type', [LinkButtonLocationRefSchema])
	.describe('Identifies a button on a peer. More ways of referring to a button may be added, as new `type`s')

export const LinkButtonSubscriptionSchema = z
	.object({ button: LinkButtonRefSchema, ...BitmapSizeShape })
	.describe('A button, and the size the subscriber wants its bitmap rendered at')

export const LinkSubscribePayloadSchema = z
	.object({
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
		buttons: z.array(LinkButtonSubscriptionSchema).max(1000),
	})
	.describe('Release some subscriptions before their lease expires')

export const LinkButtonUpdatePayloadSchema = z
	.object({
		button: LinkButtonRefSchema,
		...BitmapSizeShape,
		dataUrl: z.string().nullable().describe('PNG data url of the rendered button, or null if there is nothing to show'),
		pressed: z.boolean().describe('Whether the button is currently pressed'),
		sourceChain: z
			.array(PeerIdSchema)
			.max(16)
			.describe('Ids of the installations this image has passed through, used to detect loops'),
	})
	.describe('The current rendered state of a subscribed button')

export const LinkAccessPayloadSchema = z
	.object({
		permissions: z
			.object({
				buttons: z.boolean().describe('Whether the recipient may subscribe to, press and rotate buttons'),
			})
			.describe('What the recipient may use. Kinds of things added later are optional, and default to false'),
	})
	.describe(
		'Tells a peer what it may use of the sender, over the transport this arrives on. Sent when the peer becomes reachable, and whenever it changes. Requests for anything not granted are ignored'
	)

export const LinkButtonPressPayloadSchema = z
	.object({
		button: LinkButtonRefSchema,
		pressed: z.boolean(),
		surfaceId: SurfaceIdSchema,
	})
	.describe('Press or release a button on a peer')

export const LinkButtonRotatePayloadSchema = z
	.object({
		button: LinkButtonRefSchema,
		delta: z.number().int().describe('Signed number of rotation steps, positive is clockwise'),
		surfaceId: SurfaceIdSchema,
	})
	.describe('Rotate an encoder button on a peer')

export const LinkPingPayloadSchema = z
	.object({ nonce: z.string().min(1).max(64).describe('Echoed in the pong, to match it to this ping') })
	.describe(
		'Asks the recipient to reply with a pong, over the transport this arrived on, to measure the round trip time. Needs no permission'
	)

export const LinkPongPayloadSchema = z
	.object({ nonce: z.string().min(1).max(64).describe('The nonce of the ping this answers') })
	.describe('The reply to a ping')

function envelope<TType extends string, TPayload extends z.ZodType>(type: TType, payload: TPayload) {
	return z.object({
		type: z.literal(type),
		payload,
	})
}

export const LinkMessageSchema = z.discriminatedUnion('type', [
	envelope('subscribe', LinkSubscribePayloadSchema),
	envelope('unsubscribe', LinkUnsubscribePayloadSchema),
	envelope('button.update', LinkButtonUpdatePayloadSchema),
	envelope('button.press', LinkButtonPressPayloadSchema),
	envelope('button.rotate', LinkButtonRotatePayloadSchema),
	envelope('access', LinkAccessPayloadSchema),
	envelope('ping', LinkPingPayloadSchema),
	envelope('pong', LinkPongPayloadSchema),
])

export type LinkMessage = z.infer<typeof LinkMessageSchema>
export type LinkMessageType = LinkMessage['type']
export type LinkMessageOfType<T extends LinkMessageType> = Extract<LinkMessage, { type: T }>
export type LinkPayloadOfType<T extends LinkMessageType> = LinkMessageOfType<T>['payload']

export type LinkButtonRef = z.infer<typeof LinkButtonRefSchema>
export type LinkButtonSubscription = z.infer<typeof LinkButtonSubscriptionSchema>

/** Serialise a message for the wire */
export function encodeLinkMessage<T extends LinkMessageType>(type: T, payload: LinkPayloadOfType<T>): string {
	return JSON.stringify({ type, payload })
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

	const result = LinkMessageSchema.safeParse(json)
	if (!result.success) return { ok: false, error: z.prettifyError(result.error) }

	return { ok: true, message: result.data }
}

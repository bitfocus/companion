import { z } from 'zod'

/**
 * The Companion Link wire protocol, major version 1: the messages exchanged with a peer once it has been discovered
 * (see ../Announcement.ts for discovery, which is the same for every major version).
 *
 * These zod schemas are the definition of the protocol, and incoming messages are validated against them. Any change
 * here must be accompanied by a bump of LINK_PROTOCOL_VERSIONS (see ../Versions.ts).
 *
 * Every message is a JSON object with the envelope `{ type, payload }`, sent to one peer. The major version is not in
 * the message: it is the one negotiated with the peer from its announcement, so a new major version gets a folder of
 * its own alongside this one (`v2/`).
 *
 * Messages don't say who sent them: that is up to the transport, which knows (or can prove) who is at the other end,
 * and reports it with each message it receives (see LinkMessageOrigin).
 */

const PeerIdSchema = z.string().min(1).max(64).describe('Unique id of a Companion installation')

const SurfaceIdSchema = z
	.string()
	.max(512)
	.describe('Id of the originating surface on the source, so that held buttons are tracked per surface')

const MessageIdSchema = z
	.string()
	.min(1)
	.max(64)
	.describe('Unique to the sender, so that the receiver acts on it once, as it may arrive over several transports')

const ExpiresAtSchema = z
	.number()
	.int()
	.describe(
		"When it is too late to act on it, in the sender's clock (unix ms). The receiver converts it with its estimate of how far apart their clocks are (see pong), and drops it once expired"
	)

/** The most buttons a subscribe, unsubscribe or refusal may list. A receiver rejects a message with more */
export const LINK_MAX_BUTTONS_PER_MESSAGE = 1000

/** How many buttons a sender puts in one message, well under the limit so that each stays small */
export const LINK_BUTTONS_PER_MESSAGE = 200

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
	.describe(
		'A button, and the size the subscriber wants its bitmap rendered at. The bitmap is the content of the button only, without its decoration (eg top bar or status icons), which the subscriber draws itself from the state in each update'
	)

export const LinkButtonRevisionSchema = z
	.object({
		stream: z
			.string()
			.min(1)
			.max(64)
			.describe(
				'Chosen at random when the peer starts serving the button (at any size), so that the revisions of a restarted peer are not mistaken for older ones'
			),
		seq: z
			.number()
			.int()
			.nonnegative()
			.describe(
				'Counts up each time the button is redrawn. Shared by every size the button is served at, so updates of it at different sizes with the same revision are of the same render. Numbers may be skipped'
			),
	})
	.describe('Which render of a button an update is, to put updates in order and to say which one is held')

export const LinkSubscribePayloadSchema = z
	.object({
		buttons: z
			.array(
				LinkButtonSubscriptionSchema.extend({
					have: LinkButtonRevisionSchema.nullable().describe(
						'The revision the subscriber has of the button, or null for none. The peer sends the current render if it has a different one'
					),
				})
			)
			.max(LINK_MAX_BUTTONS_PER_MESSAGE),
	})
	.describe(
		'Ask a peer to start (or keep) sending updates for some buttons. Subscriptions are leases: they must be renewed by repeating this message before LINK_SUBSCRIPTION_LEASE_MS elapses'
	)

export const LinkUnsubscribePayloadSchema = z
	.object({
		buttons: z.array(LinkButtonSubscriptionSchema).max(LINK_MAX_BUTTONS_PER_MESSAGE),
	})
	.describe('Release some subscriptions before their lease expires')

export const LinkSubscribeRefusedPayloadSchema = z
	.object({
		buttons: z
			.array(
				LinkButtonSubscriptionSchema.extend({
					reason: z
						.enum(['denied', 'limit'])
						.describe(
							"Why it isn't served: `denied` when the subscriber isn't allowed buttons, `limit` when the peer is already serving as many as it can"
						),
				})
			)
			.max(LINK_MAX_BUTTONS_PER_MESSAGE),
	})
	.describe(
		'The answer to a subscribe (renewals included), for the buttons in it that are not served, matched by their button and size. Sent again for each renewal while it is still so. A served button gets no answer: its update is the answer'
	)

export const LinkButtonImageSchema = z
	.discriminatedUnion('type', [
		z.object({
			type: z.literal('image'),
			dataUrl: z
				.string()
				.nullable()
				.describe('PNG data url of the content of the button, or null if there is nothing to show'),
		}),
		z.object({
			type: z.literal('unchanged'),
			since: LinkButtonRevisionSchema.describe(
				'The revision the image was sent with. A subscriber without it subscribes again holding nothing, to be sent it'
			),
		}),
	])
	.describe(
		'The content of the button at this size, or that it is the same as it was, when only its state (eg pressed) has changed'
	)

export const LinkButtonUpdatePayloadSchema = z
	.object({
		button: LinkButtonRefSchema,
		...BitmapSizeShape,
		revision: LinkButtonRevisionSchema.describe('Older revisions than the one held are dropped'),
		image: LinkButtonImageSchema,
		pressed: z.boolean().describe('Whether the button is currently pressed'),
		stepCurrent: z.number().int().describe('The current step of the button, for its decoration'),
		stepCount: z.number().int().nonnegative().describe('How many steps the button has, for its decoration'),
		status: z
			.enum(['good', 'warning', 'error'])
			.nullable()
			.describe('The status of the connections the button uses, for its decoration, or null for none'),
		actionRunning: z.boolean().describe('Whether actions of the button are running, for its decoration'),
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
		id: MessageIdSchema,
		expiresAt: ExpiresAtSchema,
		button: LinkButtonRefSchema,
		pressed: z.boolean(),
		surfaceId: SurfaceIdSchema,
	})
	.describe('Press or release a button on a peer')

export const LinkButtonRotatePayloadSchema = z
	.object({
		id: MessageIdSchema,
		expiresAt: ExpiresAtSchema,
		button: LinkButtonRefSchema,
		delta: z.number().int().describe('Signed number of rotation steps, positive is clockwise'),
		surfaceId: SurfaceIdSchema,
	})
	.describe('Rotate an encoder button on a peer')

export const LinkButtonAbortPayloadSchema = z
	.object({
		id: MessageIdSchema,
		expiresAt: ExpiresAtSchema,
		button: LinkButtonRefSchema,
		unlatch: z.boolean().describe('Whether to also release the button, if it is latched'),
		hops: z
			.number()
			.int()
			.min(0)
			.describe('How many installations this abort has already been forwarded through, used to detect loops'),
	})
	.describe('Abort the running actions of a button on a peer')

export const LinkPingPayloadSchema = z
	.object({ nonce: z.string().min(1).max(64).describe('Echoed in the pong, to match it to this ping') })
	.describe(
		'Asks the recipient to reply with a pong, over the transport this arrived on, to measure the round trip time. Needs no permission'
	)

export const LinkPongPayloadSchema = z
	.object({
		nonce: z.string().min(1).max(64).describe('The nonce of the ping this answers'),
		time: z
			.number()
			.int()
			.describe(
				"The responder's clock (unix ms) when it replied. With when the ping was sent and the pong arrived, this estimates how far apart the clocks are"
			),
	})
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
	envelope('subscribe.refused', LinkSubscribeRefusedPayloadSchema),
	envelope('button.update', LinkButtonUpdatePayloadSchema),
	envelope('button.press', LinkButtonPressPayloadSchema),
	envelope('button.rotate', LinkButtonRotatePayloadSchema),
	envelope('button.abort', LinkButtonAbortPayloadSchema),
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
export type LinkButtonRevision = z.infer<typeof LinkButtonRevisionSchema>
export type LinkButtonImage = z.infer<typeof LinkButtonImageSchema>
export type LinkSubscribeRefusedReason = LinkPayloadOfType<'subscribe.refused'>['buttons'][number]['reason']

/** A key identifying a button at a size, eg to keep the subscriptions to it in a map */
export function linkButtonSubscriptionKey(sub: Pick<LinkButtonSubscription, 'button' | 'width' | 'height'>): string {
	switch (sub.button.type) {
		case 'location':
			return `location/${sub.button.page}/${sub.button.row}/${sub.button.column}/${sub.width}x${sub.height}`
	}
}

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

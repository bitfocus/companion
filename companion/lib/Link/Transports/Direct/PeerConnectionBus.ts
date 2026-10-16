import { z } from 'zod'
import type { LinkPermission, LinkPermissions } from '@companion-app/shared/Model/Link.js'
import { linkTopicMatches } from '../../TopicMatcher.js'

/**
 * Frames exchanged over a direct connection. They emulate the parts of an MQTT broker that the Link protocol uses,
 * between exactly two installations: each side tells the other which topics it is interested in, and only sends
 * what the other side subscribed to.
 */
const DirectFrameSchema = z.discriminatedUnion('op', [
	z.object({ op: z.literal('sub'), pattern: z.string() }),
	z.object({ op: z.literal('unsub'), pattern: z.string() }),
	z.object({ op: z.literal('pub'), topic: z.string(), payload: z.string(), retain: z.boolean() }),
])
type DirectFrame = z.infer<typeof DirectFrameSchema>

/** A retained message, with what the receiver needs to be allowed to get it */
export interface DirectRetainedMessage {
	payload: string
	requires: LinkPermission | null
}

/**
 * The publish/subscribe state of one direct connection.
 *
 * Retained messages are emulated: the retained messages we published are sent to the other side when it
 * subscribes to a matching pattern. When the connection drops, an empty payload is delivered locally for every
 * retained topic the other side had published, which is what a broker's last will would do for us.
 */
export class PeerConnectionBus {
	readonly #send: (frame: string) => void
	readonly #deliver: (topic: string, payload: string) => void
	/** Our retained messages, shared by all connections of a transport */
	readonly #localRetained: ReadonlyMap<string, DirectRetainedMessage>
	/** What the other side may use, which decides what is sent to it */
	readonly #getPermissions: () => LinkPermissions

	/** Patterns the other side is subscribed to */
	readonly #remoteSubscriptions = new Set<string>()
	/** Retained topics the other side has published, to clear when the connection drops */
	readonly #remoteRetainedTopics = new Set<string>()
	/** Patterns we are subscribed to, to filter what the other side sends */
	readonly #localSubscriptions: ReadonlySet<string>

	#closed = false

	constructor(
		send: (frame: string) => void,
		deliver: (topic: string, payload: string) => void,
		localRetained: ReadonlyMap<string, DirectRetainedMessage>,
		localSubscriptions: ReadonlySet<string>,
		getPermissions: () => LinkPermissions
	) {
		this.#send = send
		this.#deliver = deliver
		this.#localRetained = localRetained
		this.#localSubscriptions = localSubscriptions
		this.#getPermissions = getPermissions

		for (const pattern of localSubscriptions) this.#sendFrame({ op: 'sub', pattern })
	}

	/** Process a frame received from the other side */
	handleFrame(raw: string): { ok: true } | { ok: false; error: string } {
		if (this.#closed) return { ok: true }

		let json: unknown
		try {
			json = JSON.parse(raw)
		} catch {
			return { ok: false, error: 'Invalid JSON' }
		}
		const parsed = DirectFrameSchema.safeParse(json)
		if (!parsed.success) return { ok: false, error: z.prettifyError(parsed.error) }

		const frame = parsed.data
		switch (frame.op) {
			case 'sub':
				this.#remoteSubscriptions.add(frame.pattern)
				for (const [topic, { payload, requires }] of this.#localRetained) {
					if (linkTopicMatches(frame.pattern, topic) && this.#isAllowed(requires)) {
						this.#sendFrame({ op: 'pub', topic, payload, retain: true })
					}
				}
				break
			case 'unsub':
				this.#remoteSubscriptions.delete(frame.pattern)
				break
			case 'pub':
				if (frame.retain) {
					if (frame.payload) this.#remoteRetainedTopics.add(frame.topic)
					else this.#remoteRetainedTopics.delete(frame.topic)
				}
				if (this.#isLocallySubscribed(frame.topic)) this.#deliver(frame.topic, frame.payload)
				break
		}
		return { ok: true }
	}

	/** Send a message to the other side, if it is interested in it and allowed it */
	publish(topic: string, payload: string, retain: boolean, requires: LinkPermission | null): void {
		if (this.#closed || !this.#isAllowed(requires)) return

		for (const pattern of this.#remoteSubscriptions) {
			if (linkTopicMatches(pattern, topic)) {
				this.#sendFrame({ op: 'pub', topic, payload, retain })
				return
			}
		}
	}

	subscribe(pattern: string): void {
		this.#sendFrame({ op: 'sub', pattern })
	}

	unsubscribe(pattern: string): void {
		this.#sendFrame({ op: 'unsub', pattern })
	}

	/** The connection has closed: clear what the other side had retained, like a broker last will */
	close(): void {
		if (this.#closed) return
		this.#closed = true

		for (const topic of this.#remoteRetainedTopics) {
			if (this.#isLocallySubscribed(topic)) this.#deliver(topic, '')
		}
		this.#remoteRetainedTopics.clear()
		this.#remoteSubscriptions.clear()
	}

	#isAllowed(requires: LinkPermission | null): boolean {
		return requires === null || this.#getPermissions()[requires]
	}

	#isLocallySubscribed(topic: string): boolean {
		for (const pattern of this.#localSubscriptions) {
			if (linkTopicMatches(pattern, topic)) return true
		}
		return false
	}

	#sendFrame(frame: DirectFrame): void {
		if (this.#closed) return
		this.#send(JSON.stringify(frame))
	}
}

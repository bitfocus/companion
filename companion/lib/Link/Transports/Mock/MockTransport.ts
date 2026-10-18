import dgram from 'node:dgram'
import { z } from 'zod'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import { linkTopicMatches } from '../../TopicMatcher.js'
import type { LinkPublishOptions, LinkTransport, LinkTransportContext } from '../Types.js'

export type MockTransportConfig = {
	port: number
}

const MULTICAST_GROUP = '239.255.166.25'
/** Leave room for the IP and UDP headers below the 64KB limit of a datagram */
const MAX_DATAGRAM_BYTES = 65_000

const MockDatagramSchema = z.object({
	/** The Link id of the sender */
	from: z.string(),
	/** The name of the sender, to show the user */
	name: z.string(),
	/** When set, only these installations should accept it */
	to: z.array(z.string()).nullable(),
	topic: z.string(),
	payload: z.string(),
})
type MockDatagram = z.infer<typeof MockDatagramSchema>

/**
 * A stand-in transport for developing Link, until a real one exists. Every installation using it multicasts every
 * message to all the others on the local network, which filter them by their subscriptions.
 *
 * It does nothing to secure the connection, and the receivers are trusted to drop the messages not addressed to
 * them. Retained messages and the last will are not supported, so peers find each other on their next announcement,
 * and notice they have gone after a few missed ones.
 */
export class MockTransport implements LinkTransport {
	readonly #context: LinkTransportContext
	readonly #config: MockTransportConfig
	readonly #socket: dgram.Socket

	readonly #subscriptions = new Set<string>()
	/** The installations seen, by Link id, with their name */
	readonly #seen = new Map<string, string>()
	#bound = false

	constructor(context: LinkTransportContext, config: MockTransportConfig) {
		this.#context = context
		this.#config = config

		context.setStatus('connecting', null)
		context.setInfo([{ label: 'Port', value: String(config.port) }])

		this.#socket = dgram.createSocket({ type: 'udp4', reuseAddr: true })
		this.#socket.on('error', (err) => {
			context.logger.warn(`Socket error: ${stringifyError(err)}`)
			context.setStatus('error', stringifyError(err))
		})
		this.#socket.on('message', (data) => this.#handleDatagram(data))
		this.#socket.bind(config.port, () => {
			try {
				this.#socket.addMembership(MULTICAST_GROUP)
				this.#socket.setMulticastLoopback(true)
				this.#bound = true
				context.setStatus('connected', null)
			} catch (e) {
				context.setStatus('error', `Failed to join the multicast group: ${stringifyError(e)}`)
			}
		})
	}

	#handleDatagram(data: Buffer): void {
		let message: MockDatagram
		try {
			message = MockDatagramSchema.parse(JSON.parse(data.toString('utf8')))
		} catch (e) {
			this.#context.logger.debug(`Ignoring invalid datagram: ${stringifyError(e)}`)
			return
		}
		if (message.from === this.#context.identity.id) return
		if (message.to && !message.to.includes(this.#context.identity.id)) return

		if (this.#seen.get(message.from) !== message.name) {
			this.#seen.set(message.from, message.name)
			this.#reportSections()
		}

		if (!Array.from(this.#subscriptions).some((pattern) => linkTopicMatches(pattern, message.topic))) return
		// Trusted, as this is only for development
		this.#context.receive(message.topic, message.payload, { peerId: message.from })
	}

	#reportSections(): void {
		this.#context.setSections([
			{
				id: 'seen',
				title: 'Installations seen',
				description: null,
				attention: false,
				entries: Array.from(this.#seen, ([peerId, name]) => ({
					id: peerId,
					title: name,
					description: peerId,
					inputLabel: null,
					actions: [],
				})),
			},
		])
	}

	publish(topic: string, payload: string, options: LinkPublishOptions): void {
		if (!this.#bound) return

		const requires = options.requires
		const message: MockDatagram = {
			from: this.#context.identity.id,
			name: this.#context.getName(),
			to: requires
				? Array.from(this.#seen.keys()).filter((peerId) => this.#context.getPermissions(peerId)[requires])
				: null,
			topic,
			payload,
		}
		if (message.to?.length === 0) return

		const data = Buffer.from(JSON.stringify(message))
		if (data.length > MAX_DATAGRAM_BYTES) {
			this.#context.logger.warn(`Dropping message to ${topic}, as it is too large for a datagram`)
			return
		}
		this.#socket.send(data, this.#config.port, MULTICAST_GROUP, (err) => {
			if (err) this.#context.logger.warn(`Failed to send to ${topic}: ${stringifyError(err)}`)
		})
	}

	subscribe(pattern: string): void {
		this.#subscriptions.add(pattern)
	}

	unsubscribe(pattern: string): void {
		this.#subscriptions.delete(pattern)
	}

	async handleSectionAction(_entryId: string, _actionId: string, _input: string | null): Promise<string | null> {
		return 'Unknown action'
	}

	async destroy(): Promise<void> {
		this.#bound = false
		this.#subscriptions.clear()
		await new Promise<void>((resolve) => this.#socket.close(() => resolve()))
	}
}

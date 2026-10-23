import dgram from 'node:dgram'
import { z } from 'zod'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import type { LinkTransport, LinkTransportContext } from '../Types.js'

export type MockTransportConfig = {
	port: number
}

const MULTICAST_GROUP = '239.255.166.25'
/** Leave room for the IP and UDP headers below the 64KB limit of a datagram */
const MAX_DATAGRAM_BYTES = 65_000

const MockDatagramSchema = z.discriminatedUnion('kind', [
	z.object({
		kind: z.literal('announce'),
		/** The Link id of the sender */
		from: z.string(),
		/** The name of the sender, to show the user */
		name: z.string(),
		/** The announcement, or null when the sender has gone */
		payload: z.string().nullable(),
	}),
	z.object({
		kind: z.literal('message'),
		from: z.string(),
		name: z.string(),
		/** The only installation that should accept it */
		to: z.string(),
		payload: z.string(),
	}),
])
type MockDatagram = z.infer<typeof MockDatagramSchema>

/**
 * A stand-in transport for developing Link, until a real one exists. Every installation using it multicasts every
 * datagram to all the others on the local network, which drop the messages not addressed to them.
 *
 * It does nothing to secure the connection, and the receivers are trusted to drop what is not theirs. Announcements
 * are not kept for installations that start later, so peers find each other on their next announcement, and notice
 * one that vanished without saying goodbye after a few missed ones.
 */
export class MockTransport implements LinkTransport {
	readonly #context: LinkTransportContext
	readonly #config: MockTransportConfig
	readonly #socket: dgram.Socket

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
		if (message.kind === 'message' && message.to !== this.#context.identity.id) return

		if (this.#seen.get(message.from) !== message.name) {
			this.#seen.set(message.from, message.name)
			this.#reportSections()
		}

		// Trusted, as this is only for development
		if (message.kind === 'announce') {
			this.#context.receiveAnnouncement(message.from, message.payload)
		} else {
			this.#context.receive(message.payload, { peerId: message.from })
		}
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

	announce(payload: string | null): void {
		this.#sendDatagram({ kind: 'announce', from: this.#context.identity.id, name: this.#context.getName(), payload })
	}

	send(peerId: string, payload: string): void {
		this.#sendDatagram({
			kind: 'message',
			from: this.#context.identity.id,
			name: this.#context.getName(),
			to: peerId,
			payload,
		})
	}

	#sendDatagram(message: MockDatagram): void {
		if (!this.#bound) return

		const data = Buffer.from(JSON.stringify(message))
		if (data.length > MAX_DATAGRAM_BYTES) {
			this.#context.logger.warn(`Dropping a ${message.kind}, as it is too large for a datagram`)
			return
		}
		this.#socket.send(data, this.#config.port, MULTICAST_GROUP, (err) => {
			if (err) this.#context.logger.warn(`Failed to send a ${message.kind}: ${stringifyError(err)}`)
		})
	}

	async handleSectionAction(_entryId: string, _actionId: string, _input: string | null): Promise<string | null> {
		return 'Unknown action'
	}

	async destroy(): Promise<void> {
		this.#bound = false
		await new Promise<void>((resolve) => this.#socket.close(() => resolve()))
	}
}

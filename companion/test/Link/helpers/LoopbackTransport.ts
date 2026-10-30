import type {
	LinkTransport,
	LinkTransportContext,
	LinkTransportDefinition,
} from '../../../lib/Link/Transports/Types.js'

/**
 * An in-memory network for tests: every transport joined to it reaches every other, with the sender proven (it is
 * the transport that sent it), as a direct connection does. Delivery is asynchronous, as over a real connection.
 */
export class LoopbackNetwork {
	readonly #members = new Set<LoopbackTransport>()

	/** Whether messages flow, to simulate the network going down and coming back */
	#up = true

	join(transport: LoopbackTransport): void {
		this.#members.add(transport)
		if (this.#up) transport.connected()
	}

	leave(transport: LoopbackTransport): void {
		this.#members.delete(transport)
	}

	/** The transport vanishes without saying goodbye: the others are told it has gone, as a broker's last will does */
	drop(transport: LoopbackTransport): void {
		this.leave(transport)
		if (this.#up) for (const member of this.#members) this.#deliverAnnouncement(member, transport, null)
		transport.disconnected()
	}

	/** Messages stop flowing, and every member says it is not connected */
	goDown(): void {
		this.#up = false
		for (const member of this.#members) member.disconnected()
	}

	/** Messages flow again: like a reconnect, every member gets the current announcements of the others */
	goUp(): void {
		this.#up = true
		for (const member of this.#members) member.connected()
	}

	/** Hand an announcement of `from` to every other member */
	announce(from: LoopbackTransport, payload: string | null): void {
		if (!this.#up || !this.#members.has(from)) return
		for (const member of this.#members) {
			if (member !== from) this.#deliverAnnouncement(member, from, payload)
		}
	}

	/** Hand the current announcements of the other members to one that has just connected */
	sendAnnouncements(to: LoopbackTransport): void {
		if (!this.#up) return
		for (const member of this.#members) {
			if (member !== to && member.announcement !== null) this.#deliverAnnouncement(to, member, member.announcement)
		}
	}

	send(from: LoopbackTransport, peerId: string, payload: string): void {
		if (!this.#up || !this.#members.has(from)) return
		for (const member of this.#members) {
			if (member === from || member.context.identity.id !== peerId) continue
			setImmediate(() => {
				if (this.#up && this.#members.has(member)) member.context.receive(payload, { peerId: from.context.identity.id })
			})
		}
	}

	#deliverAnnouncement(to: LoopbackTransport, from: LoopbackTransport, payload: string | null): void {
		setImmediate(() => {
			if (this.#up && this.#members.has(to)) to.context.receiveAnnouncement(from.context.identity.id, payload)
		})
	}
}

/** A transport on a {@link LoopbackNetwork} */
export class LoopbackTransport implements LinkTransport {
	readonly context: LinkTransportContext
	readonly #network: LoopbackNetwork
	#announcement: string | null = null

	constructor(context: LinkTransportContext, network: LoopbackNetwork) {
		this.context = context
		this.#network = network
		context.setStatus('connecting', null)
		network.join(this)
	}

	get announcement(): string | null {
		return this.#announcement
	}

	connected(): void {
		this.context.setStatus('connected', null)
		this.#network.sendAnnouncements(this)
	}

	disconnected(): void {
		this.context.setStatus('connecting', 'Network is down')
	}

	announce(payload: string | null): void {
		this.#announcement = payload
		this.#network.announce(this, payload)
	}

	send(peerId: string, payload: string): void {
		this.#network.send(this, peerId, payload)
	}

	async handleSectionAction(): Promise<string | null> {
		return 'Unknown action'
	}

	async destroy(): Promise<void> {
		this.#network.leave(this)
	}
}

/** A transport type whose instances all join one network, for running real controllers against each other */
export function loopbackTransportDefinition(
	network: LoopbackNetwork,
	instances: LoopbackTransport[]
): LinkTransportDefinition<Record<string, never>> {
	return {
		type: 'loopback',
		name: 'Loopback',
		description: 'An in-memory network, for tests',
		configFields: [],
		create: (context) => {
			const transport = new LoopbackTransport(context, network)
			instances.push(transport)
			return transport
		},
	}
}

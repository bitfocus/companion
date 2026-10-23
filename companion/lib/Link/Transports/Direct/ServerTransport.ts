import { nanoid } from 'nanoid'
import { WebSocketServer } from 'ws'
import { z } from 'zod'
import {
	formatLinkIdFingerprint,
	type LinkTransportEntry,
	type LinkTransportSection,
} from '@companion-app/shared/Model/Link.js'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import { GLOBAL_BIND_ADDRESS } from '../../../Resources/Constants.js'
import { websocketMessagePipe } from '../Secure/MessagePipe.js'
import { acceptAuthentication, type PairingRequest } from '../Secure/PairingSession.js'
import { SecureChannel } from '../Secure/SecureChannel.js'
import type { LinkTransportContext } from '../Types.js'
import { formatRemoteAddress } from './Address.js'
import {
	DIRECT_HANDSHAKE_TIMEOUT_MS,
	DIRECT_MAX_UNTRUSTED_MESSAGE_SIZE,
	DirectTransportBase,
} from './DirectTransportBase.js'

export type DirectServerTransportConfig = {
	port: number
}

const PAIRED_STORAGE_KEY = 'pairedClients'
const PairedClientsSchema = z.record(z.string(), z.object({ name: z.string(), pairedAt: z.number() }))
type PairedClients = z.infer<typeof PairedClientsSchema>

/** Bound on waiting pairing requests, so that they can't be used to flood the UI */
const PAIRING_MAX_PENDING = 10
/** Bound on the waiting pairing requests from one address, so that one host can't hold every slot */
const PAIRING_MAX_PENDING_PER_HOST = 3

/** Bound on connections that are not trusted yet, so that they can't be used to exhaust memory */
const MAX_UNTRUSTED_CONNECTIONS = 32
/** Bound on the connections from one address that are not trusted yet */
const MAX_UNTRUSTED_CONNECTIONS_PER_HOST = 8

interface PendingPairing {
	readonly request: PairingRequest
	readonly address: string
	/** The address without its port, which every connection from one host shares */
	readonly host: string
}

/**
 * Accepts direct connections from other installations. Each connection is encrypted with Noise, and only
 * installations that have been paired (by entering the code they show) are trusted.
 *
 * This does not relay between the installations connected to it: each connection is a link between this
 * installation and one other.
 */
export class DirectServerTransport extends DirectTransportBase {
	readonly #port: number
	readonly #server: WebSocketServer

	readonly #pending = new Map<string, PendingPairing>()
	/** How many connections from each host are not trusted yet */
	readonly #untrusted = new Map<string, number>()
	#untrustedTotal = 0
	/** The channels of linked installations, by their public key, so that unpairing can disconnect them */
	readonly #linked = new Map<string, Set<SecureChannel>>()

	#listening = false

	constructor(context: LinkTransportContext, config: DirectServerTransportConfig) {
		super(context)
		this.#port = config.port

		context.setStatus('connecting', 'Starting')

		this.#server = new WebSocketServer({ host: GLOBAL_BIND_ADDRESS, port: this.#port, maxPayload: 65535 })
		this.#server.on('listening', () => {
			this.#listening = true
			this.context.logger.info(`Listening on port ${this.#port}`)
			this.#updateState()
		})
		this.#server.on('error', (e: NodeJS.ErrnoException) => {
			this.context.logger.error(`Server error: ${stringifyError(e)}`)
			this.context.setStatus(
				'error',
				e.code === 'EADDRINUSE'
					? `Port ${this.#port} is already in use, by another program or installation. Choose another in Settings, under Protocols.`
					: e.message
			)
		})
		this.#server.on('connection', (socket, req) => {
			const address = formatRemoteAddress(req.socket.remoteAddress, req.socket.remotePort)
			const host = req.socket.remoteAddress ?? address
			socket.on('error', (e) => this.context.logger.debug(`Socket error from ${address}: ${stringifyError(e)}`))

			const untrusted = this.#countUntrusted(host)
			if (!untrusted) {
				this.context.logger.warn(`Refusing a connection from ${address}, too many are not trusted yet`)
				socket.terminate()
				return
			}
			socket.on('close', untrusted.release)

			this.keepAlive(socket, address)

			SecureChannel.establish(
				websocketMessagePipe(socket),
				false,
				this.noiseKeyPair,
				this.context.identity,
				this.context.getName(),
				DIRECT_MAX_UNTRUSTED_MESSAGE_SIZE,
				DIRECT_HANDSHAKE_TIMEOUT_MS
			)
				.then((channel) => this.#accept(channel, address, host, untrusted.release))
				.catch((e) => {
					this.context.logger.info(`Handshake with ${address} failed: ${stringifyError(e)}`)
					socket.terminate()
				})
		})
	}

	/** The paired installations, by Link id. Loaded once, as it is checked for every connection */
	#pairedCache: PairedClients | null = null

	#getPaired(): PairedClients {
		if (!this.#pairedCache) {
			const parsed = PairedClientsSchema.safeParse(this.context.storage.get(PAIRED_STORAGE_KEY))
			this.#pairedCache = parsed.success ? parsed.data : {}
		}
		return this.#pairedCache
	}

	#setPaired(paired: PairedClients): void {
		this.#pairedCache = paired
		this.context.storage.set(PAIRED_STORAGE_KEY, paired)
	}

	/**
	 * Count a connection from a host as not trusted yet, if there is room for it
	 * @returns how to stop counting it, once it is trusted or closed, or null when there is no room
	 */
	#countUntrusted(host: string): { release: () => void } | null {
		const fromHost = this.#untrusted.get(host) ?? 0
		if (this.#untrustedTotal >= MAX_UNTRUSTED_CONNECTIONS || fromHost >= MAX_UNTRUSTED_CONNECTIONS_PER_HOST) return null

		this.#untrusted.set(host, fromHost + 1)
		this.#untrustedTotal++

		let released = false
		return {
			release: () => {
				if (released) return
				released = true
				this.#untrustedTotal--
				const remaining = (this.#untrusted.get(host) ?? 1) - 1
				if (remaining > 0) this.#untrusted.set(host, remaining)
				else this.#untrusted.delete(host)
			},
		}
	}

	/** Make room for a pairing request from a host: one that waits from the same installation, or its host's oldest */
	#makeRoomForPairing(linkId: string, host: string): void {
		const fromHost: PendingPairing[] = []
		for (const pending of this.#pending.values()) {
			// The same installation asking again, eg after reconnecting: the new request replaces it
			if (pending.request.channel.remoteLinkId === linkId) pending.request.reject()
			else if (pending.host === host) fromHost.push(pending)
		}
		// Oldest first, as they were added
		while (fromHost.length >= PAIRING_MAX_PENDING_PER_HOST) fromHost.shift()?.request.reject()
	}

	#accept(channel: SecureChannel, address: string, host: string, releaseUntrusted: () => void): void {
		acceptAuthentication(channel, {
			logger: this.context.logger,
			isPaired: (linkId) => !!this.#getPaired()[linkId],
			canRequestPairing: () => {
				this.#makeRoomForPairing(channel.remoteLinkId, host)
				return this.#pending.size < PAIRING_MAX_PENDING
			},
			requestPairing: (request) => {
				this.context.logger.info(`Pairing requested by ${channel.remoteName} (${address})`)
				const id = nanoid()
				this.#pending.set(id, { request, address, host })
				request.onEnd(() => {
					if (this.#pending.delete(id)) this.#updateState()
				})
				this.#updateState()
			},
			trusted: (trustedChannel, newlyPaired) => {
				releaseUntrusted()
				const paired = this.#getPaired()
				const known = paired[trustedChannel.remoteLinkId]
				if (newlyPaired || known?.name !== trustedChannel.remoteName) {
					// Keep the name up to date, as it may have been renamed
					this.#setPaired({
						...paired,
						// Nothing is shared until the user says so
						[trustedChannel.remoteLinkId]: {
							name: trustedChannel.remoteName,
							pairedAt: newlyPaired || !known ? Date.now() : known.pairedAt,
						},
					})
				}
				this.context.logger.info(
					`${newlyPaired ? 'Paired with' : 'Accepted connection from'} ${trustedChannel.remoteName} (${address})`
				)
				this.#establishLink(trustedChannel, address)
				this.#updateState()
			},
		})
	}

	#establishLink(channel: SecureChannel, address: string): void {
		const key = channel.remoteLinkId
		let channels = this.#linked.get(key)
		if (!channels) {
			channels = new Set()
			this.#linked.set(key, channels)
		}
		channels.add(channel)
		channel.onClose(() => {
			channels.delete(channel)
			if (channels.size === 0) this.#linked.delete(key)
		})

		this.link(channel, `${channel.remoteName} (${address})`)
	}

	async handleSectionAction(entryId: string, actionId: string, input: string | null): Promise<string | null> {
		const [kind, id] = splitEntryId(entryId)

		if (kind === 'pending') {
			const pending = this.#pending.get(id)
			if (!pending) return 'This pairing request is no longer waiting'

			if (actionId === 'reject') {
				pending.request.reject()
				return null
			}

			if (actionId === 'pair') {
				switch (pending.request.enterCode(input ?? '')) {
					case 'paired':
						return null
					case 'wrong':
						return `That code doesn't match the one shown on ${pending.request.channel.remoteName}`
					case 'rejected':
						return 'The code was wrong too many times, so the request has been rejected'
				}
			}
		}

		if (kind === 'paired' && actionId === 'unpair') {
			const paired = { ...this.#getPaired() }
			delete paired[id]
			this.#setPaired(paired)

			for (const channel of this.#linked.get(id) ?? []) channel.close()
			this.#updateState()
			return null
		}

		return 'Unknown action'
	}

	protected linksChanged(): void {
		this.#updateState()
	}

	#updateState(): void {
		if (!this.#listening) return

		const waiting = this.#pending.size
		this.context.setStatus(
			'connected',
			waiting > 0 ? `${waiting} installation${waiting === 1 ? ' is' : 's are'} waiting to be paired` : null
		)
		this.context.setInfo([
			{ label: 'Port', value: String(this.#port) },
			{ label: 'Identity', value: formatLinkIdFingerprint(this.context.identity.id) },
			{ label: 'Connected installations', value: String(this.linkedCount) },
		])

		const pendingEntries: LinkTransportEntry[] = Array.from(this.#pending, ([id, { request, address }]) => ({
			id: `pending:${id}`,
			title: request.channel.remoteName,
			description: `From ${address}, identity ${formatLinkIdFingerprint(request.channel.remoteLinkId)}. Enter the pairing code it shows.`,
			inputLabel: 'Pairing code',
			actions: [
				{ id: 'pair', label: 'Pair', color: 'primary' },
				{ id: 'reject', label: 'Reject', color: 'secondary' },
			],
		}))

		const pairedEntries: LinkTransportEntry[] = Object.entries(this.#getPaired()).map(([key, info]) => ({
			id: `paired:${key}`,
			title: info.name,
			peerId: key,
			description: `${this.#linked.has(key) ? 'Connected' : 'Not connected'} · identity ${formatLinkIdFingerprint(key)} · paired ${new Date(info.pairedAt).toLocaleDateString()}`,
			inputLabel: null,
			actions: [{ id: 'unpair', label: 'Unpair', color: 'danger' }],
		}))

		const sections: LinkTransportSection[] = []
		if (pendingEntries.length > 0) {
			sections.push({
				id: 'pending',
				title: 'Pairing requests',
				description:
					'These installations want to connect. Only pair with ones you recognise. Once paired, choose what each may use.',
				attention: true,
				entries: pendingEntries,
			})
		}
		sections.push({
			id: 'paired',
			title: 'Paired installations',
			description:
				pairedEntries.length === 0
					? 'None yet. Add a "Direct connection" transport on another installation, pointing at this one, to pair it.'
					: null,
			attention: false,
			entries: pairedEntries,
		})
		this.context.setSections(sections)
	}

	async destroy(): Promise<void> {
		this.#listening = false
		for (const client of this.#server.clients) client.terminate()
		await new Promise<void>((resolve) => this.#server.close(() => resolve()))
	}
}

function splitEntryId(entryId: string): [string, string] {
	const index = entryId.indexOf(':')
	return index === -1 ? [entryId, ''] : [entryId.slice(0, index), entryId.slice(index + 1)]
}

import { nanoid } from 'nanoid'
import { WebSocketServer } from 'ws'
import { z } from 'zod'
import { type LinkTransportEntry, type LinkTransportSection } from '@companion-app/shared/Model/Link.js'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import { GLOBAL_BIND_ADDRESS } from '../../../Resources/Constants.js'
import type { LinkTransportContext } from '../Types.js'
import { DIRECT_HANDSHAKE_TIMEOUT_MS, DIRECT_MAX_MESSAGE_SIZE, DirectTransportBase } from './DirectTransportBase.js'
import { derivePairingCode, formatKeyFingerprint, normalisePairingCode, type DirectAuthFrame } from './Pairing.js'
import { SecureChannel } from './SecureChannel.js'

export type DirectServerTransportConfig = {
	port: number
}

const PAIRED_STORAGE_KEY = 'pairedClients'
const PairedClientsSchema = z.record(z.string(), z.object({ name: z.string(), pairedAt: z.number() }))
type PairedClients = z.infer<typeof PairedClientsSchema>

/** How long a pairing request waits for the user */
const PAIRING_TIMEOUT_MS = 5 * 60 * 1000
/** Wrong codes allowed before a pairing request is rejected */
const PAIRING_MAX_ATTEMPTS = 3
/** Bound on waiting pairing requests, so that they can't be used to flood the UI */
const PAIRING_MAX_PENDING = 10

interface PendingPairing {
	readonly id: string
	readonly channel: SecureChannel
	readonly address: string
	readonly expectedCode: string
	attempts: number
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
		this.#server.on('error', (e) => {
			this.context.logger.error(`Server error: ${stringifyError(e)}`)
			this.context.setStatus('error', stringifyError(e))
		})
		this.#server.on('connection', (socket, req) => {
			const address = `${req.socket.remoteAddress}:${req.socket.remotePort}`
			socket.on('error', (e) => this.context.logger.debug(`Socket error from ${address}: ${stringifyError(e)}`))
			this.keepAlive(socket, address)

			SecureChannel.establish(
				socket,
				false,
				this.noiseKeyPair,
				this.context.identity,
				this.context.getName(),
				DIRECT_MAX_MESSAGE_SIZE,
				DIRECT_HANDSHAKE_TIMEOUT_MS
			)
				.then((channel) => this.#accept(channel, address))
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

	#accept(channel: SecureChannel, address: string): void {
		const paired = this.#getPaired()
		const known = paired[channel.remoteLinkId]
		if (known) {
			// Keep the name up to date, as it may have been renamed
			if (known.name !== channel.remoteName) {
				this.#setPaired({ ...paired, [channel.remoteLinkId]: { ...known, name: channel.remoteName } })
			}
			this.context.logger.info(`Accepted connection from ${channel.remoteName} (${address})`)
			this.#establishLink(channel, address)
			return
		}

		if (this.#pending.size >= PAIRING_MAX_PENDING) {
			this.context.logger.warn(`Refusing pairing request from ${address}, too many are waiting`)
			sendAuth(channel, 'rejected')
			channel.socket.close()
			return
		}

		this.context.logger.info(`Pairing requested by ${channel.remoteName} (${address})`)
		const request: PendingPairing = {
			id: nanoid(),
			channel,
			address,
			expectedCode: derivePairingCode(channel.handshakeHash),
			attempts: 0,
		}
		this.#pending.set(request.id, request)

		// Nothing is accepted from an unpaired installation
		channel.setHandler(() => {})

		const timeout = setTimeout(() => {
			sendAuth(channel, 'rejected')
			channel.socket.close()
		}, PAIRING_TIMEOUT_MS)
		channel.socket.on('close', () => {
			clearTimeout(timeout)
			if (this.#pending.delete(request.id)) this.#updateState()
		})

		sendAuth(channel, 'pairing-required')
		this.#updateState()
	}

	#establishLink(channel: SecureChannel, address: string): void {
		const key = channel.remoteLinkId
		let channels = this.#linked.get(key)
		if (!channels) {
			channels = new Set()
			this.#linked.set(key, channels)
		}
		channels.add(channel)
		channel.socket.on('close', () => {
			channels.delete(channel)
			if (channels.size === 0) this.#linked.delete(key)
		})

		sendAuth(channel, 'paired')
		this.link(channel, `${channel.remoteName} (${address})`)
	}

	async handleSectionAction(entryId: string, actionId: string, input: string | null): Promise<string | null> {
		const [kind, id] = splitEntryId(entryId)

		if (kind === 'pending') {
			const request = this.#pending.get(id)
			if (!request) return 'This pairing request is no longer waiting'

			if (actionId === 'reject') {
				this.#pending.delete(id)
				sendAuth(request.channel, 'rejected')
				request.channel.socket.close()
				this.#updateState()
				return null
			}

			if (actionId === 'pair') {
				if (normalisePairingCode(input ?? '') !== normalisePairingCode(request.expectedCode)) {
					request.attempts++
					if (request.attempts >= PAIRING_MAX_ATTEMPTS) {
						this.#pending.delete(id)
						sendAuth(request.channel, 'rejected')
						request.channel.socket.close()
						this.#updateState()
						return 'The code was wrong too many times, so the request has been rejected'
					}
					return `That code doesn't match the one shown on ${request.channel.remoteName}`
				}

				this.#pending.delete(id)
				const { channel } = request
				this.#setPaired({
					...this.#getPaired(),
					// Nothing is shared until the user says so
					[channel.remoteLinkId]: {
						name: channel.remoteName,
						pairedAt: Date.now(),
					},
				})
				this.context.logger.info(`Paired with ${channel.remoteName} (${request.address})`)
				this.#establishLink(channel, request.address)
				this.#updateState()
				return null
			}
		}

		if (kind === 'paired' && actionId === 'unpair') {
			const paired = { ...this.#getPaired() }
			delete paired[id]
			this.#setPaired(paired)

			for (const channel of this.#linked.get(id) ?? []) channel.socket.close()
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
			{ label: 'Identity', value: formatKeyFingerprint(this.context.identity.id) },
			{ label: 'Connected installations', value: String(this.linkedCount) },
		])

		const pendingEntries: LinkTransportEntry[] = Array.from(this.#pending.values(), (request) => ({
			id: `pending:${request.id}`,
			title: request.channel.remoteName,
			description: `From ${request.address}, identity ${formatKeyFingerprint(request.channel.remoteLinkId)}. Enter the pairing code it shows.`,
			inputLabel: 'Pairing code',
			actions: [
				{ id: 'pair', label: 'Pair', color: 'primary' },
				{ id: 'reject', label: 'Reject', color: 'secondary' },
			],
		}))

		const pairedEntries: LinkTransportEntry[] = Object.entries(this.#getPaired()).map(([key, info]) => ({
			id: `paired:${key}`,
			title: info.name,
			description: `${this.#linked.has(key) ? 'Connected' : 'Not connected'} · identity ${formatKeyFingerprint(key)} · paired ${new Date(info.pairedAt).toLocaleDateString()}`,
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
					? 'None yet. Add a "Connect directly" transport on another installation, pointing at this one, to pair it.'
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

function sendAuth(channel: SecureChannel, status: DirectAuthFrame['status']): void {
	channel.send(JSON.stringify({ op: 'auth', status } satisfies DirectAuthFrame))
}

function splitEntryId(entryId: string): [string, string] {
	const index = entryId.indexOf(':')
	return index === -1 ? [entryId, ''] : [entryId.slice(0, index), entryId.slice(index + 1)]
}

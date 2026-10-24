import { WebSocket } from 'ws'
import { z } from 'zod'
import { type LinkTransportInfoItem, type LinkTransportSection } from '@companion-app/shared/Model/Link.js'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import { formatLinkIdFingerprint } from '../../Identity.js'
import { websocketMessagePipe } from '../Secure/MessagePipe.js'
import { requestAuthentication } from '../Secure/PairingSession.js'
import { SecureChannel } from '../Secure/SecureChannel.js'
import type { LinkTransportContext } from '../Types.js'
import { resolveDirectAddress } from './Address.js'
import { DIRECT_DEFAULT_PORT } from './Constants.js'
import {
	DIRECT_HANDSHAKE_TIMEOUT_MS,
	DIRECT_MAX_UNTRUSTED_MESSAGE_SIZE,
	DirectTransportBase,
} from './DirectTransportBase.js'

export type DirectClientTransportConfig = {
	/** The installation chosen from those discovered with mDNS, as `ip:port`, or null to use `address` */
	bonjourHost: string | null | undefined
	address: string
}

const PAIRED_STORAGE_KEY = 'pairedServer'
const PairedServerSchema = z.object({
	/** The Link id of the server, pinned when paired */
	linkId: z.string(),
	name: z.string(),
})
type PairedServer = z.infer<typeof PairedServerSchema>

/**
 * Delays between reconnect attempts. The first is short, so that a brief drop (eg a proxy closing the connection)
 * goes unnoticed; later ones back off so that an installation that is down isn't hammered
 */
const RECONNECT_DELAYS_MS = [250, 1_000, 2_000, 5_000, 10_000, 20_000, 30_000]

/**
 * Connects directly to another installation that is accepting direct connections. The connection is encrypted with
 * Noise. The first time, the user pairs the two by entering the code shown here on the other installation; after
 * that, the other installation's identity is remembered and a different one is refused.
 */
export class DirectClientTransport extends DirectTransportBase {
	readonly #url: string | null

	#socket: WebSocket | null = null
	#reconnectTimer: NodeJS.Timeout | null = null
	/** Reconnect attempts since the connection was last working, to pick the delay */
	#reconnectAttempt = 0
	#destroyed = false
	/** Set when retrying would not help, until the user does something about it */
	#stopped = false
	/** Why the connection was closed, to show while retrying, when the other end said */
	#retryReason: string | null = null

	/** The code to enter on the other installation, while it is waiting for it */
	#pairingCode: string | null = null
	#serverName: string | null = null

	constructor(context: LinkTransportContext, config: DirectClientTransportConfig) {
		super(context)
		const resolved = config.bonjourHost
			? resolveDirectAddress(config.bonjourHost, DIRECT_DEFAULT_PORT)
			: config.address.trim()
				? resolveDirectAddress(config.address, DIRECT_DEFAULT_PORT)
				: ({ ok: false, error: 'Choose an installation, or enter its address' } as const)
		this.#url = resolved.ok ? resolved.url : null
		if (!resolved.ok) {
			this.#stop(resolved.error)
			return
		}

		this.#connect()
	}

	/** The paired installation. Loaded once, as it is checked for every connection */
	#pairedCache: PairedServer | null | undefined = undefined

	#getPaired(): PairedServer | null {
		if (this.#pairedCache === undefined) {
			const parsed = PairedServerSchema.safeParse(this.context.storage.get(PAIRED_STORAGE_KEY))
			this.#pairedCache = parsed.success ? parsed.data : null
		}
		return this.#pairedCache
	}

	#setPaired(paired: PairedServer | null): void {
		this.#pairedCache = paired
		this.context.storage.set(PAIRED_STORAGE_KEY, paired)
	}

	#connect(): void {
		this.#reconnectTimer = null
		const url = this.#url
		if (this.#destroyed || this.#stopped || !url) return

		this.#pairingCode = null
		this.#updateInfo()

		let lastError: string | null = null
		const socket = new WebSocket(url, {
			maxPayload: 65535,
			handshakeTimeout: 10_000,
			// When there is TLS (wss://, eg through a reverse proxy) it is only an outer layer: the other end is
			// authenticated by the Noise handshake, so a self-signed proxy certificate shouldn't stop it working
			rejectUnauthorized: false,
		})
		this.#socket = socket

		socket.on('error', (e) => {
			this.context.logger.debug(`Connection error: ${stringifyError(e)}`)
			lastError = stringifyError(e)
		})
		socket.on('close', () => {
			if (this.#socket !== socket) return
			this.#socket = null
			this.#pairingCode = null
			this.#updateInfo()
			if (this.#destroyed || this.#stopped) return

			// Reported as connecting rather than an error while retrying, so that a brief drop doesn't look like a fault
			const reason = this.#retryReason ?? lastError
			this.#retryReason = null
			const delay = RECONNECT_DELAYS_MS[Math.min(this.#reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)]
			this.#reconnectAttempt++
			this.#reconnectTimer = setTimeout(() => this.#connect(), delay)
			this.context.setStatus(
				this.#reconnectAttempt > 3 ? 'error' : 'connecting',
				reason ? `${reason}, retrying` : 'Connection lost, retrying'
			)
		})
		socket.on('open', () => {
			this.keepAlive(socket, url)

			SecureChannel.establish(
				websocketMessagePipe(socket),
				true,
				this.noiseKeyPair,
				this.context.identity,
				this.context.getName(),
				DIRECT_MAX_UNTRUSTED_MESSAGE_SIZE,
				DIRECT_HANDSHAKE_TIMEOUT_MS
			)
				.then((channel) => this.#authenticate(channel))
				.catch((e) => {
					this.context.logger.info(`Handshake failed: ${stringifyError(e)}`)
					// Shown once it has closed, rather than replaced by it
					if (this.#socket === socket) this.#retryReason = stringifyError(e, true)
					socket.terminate()
				})
		})
	}

	#authenticate(channel: SecureChannel): void {
		this.#serverName = channel.remoteName

		const paired = this.#getPaired()
		if (paired && paired.linkId !== channel.remoteLinkId) {
			// Either the other installation was reset, or something is impersonating it
			this.#stop(
				`${channel.remoteName} has a different Link id (${formatLinkIdFingerprint(channel.remoteLinkId)}) to when it was paired. If it was reset, forget the pairing and pair again.`
			)
			channel.close()
			return
		}

		requestAuthentication(channel, {
			logger: this.context.logger,
			paired: paired !== null,
			showCode: (code) => {
				// The connection works, it is just waiting for the user
				this.#reconnectAttempt = 0
				this.#pairingCode = code
				this.context.setStatus(
					'connecting',
					`Waiting for pairing. Enter the code ${code} into the pairing request on the Link page of ${channel.remoteName} (Link id ${formatLinkIdFingerprint(channel.remoteLinkId)})`
				)
				this.#updateInfo()
			},
			trusted: () => {
				this.#pairingCode = null
				if (!paired) this.#setPaired({ linkId: channel.remoteLinkId, name: channel.remoteName })
				this.context.logger.info(`Connected to ${channel.remoteName}`)
				this.link(channel, channel.remoteName)
			},
			refused: (reason) => {
				switch (reason) {
					case 'rejected':
						return this.#stop(`${channel.remoteName} rejected the pairing`)
					case 'expired':
						return this.#stop(`The pairing request to ${channel.remoteName} timed out. Try again to pair.`)
					case 'not-paired':
						return this.#stop(
							`${channel.remoteName} (${formatLinkIdFingerprint(channel.remoteLinkId)}) said it is paired with this installation, but it never was. Try again to pair.`
						)
				}
			},
			busy: () => {
				this.#retryReason = `${channel.remoteName} is busy with other pairing requests`
			},
		})
	}

	/** Stop retrying, as it would not help, until the user acts */
	#stop(reason: string): void {
		this.#stopped = true
		this.#pairingCode = null
		this.context.setStatus('error', reason)
		this.#updateInfo()
	}

	async handleSectionAction(entryId: string, actionId: string, _input: string | null): Promise<string | null> {
		if (entryId !== 'pairing') return 'Unknown action'

		if (actionId === 'forget') {
			this.#setPaired(null)
		} else if (actionId !== 'retry') {
			return 'Unknown action'
		}

		this.#stopped = false
		this.#reconnectAttempt = 0
		this.#socket?.close()
		if (!this.#socket && !this.#reconnectTimer) this.#connect()
		this.#updateInfo()
		return null
	}

	protected linksChanged(): void {
		if (this.#destroyed) return
		if (this.linkedCount > 0) {
			this.#reconnectAttempt = 0
			this.context.setStatus('connected', null)
		}
		this.#updateInfo()
	}

	#updateInfo(): void {
		const info: LinkTransportInfoItem[] = [
			...(this.#url ? [{ label: 'Address', value: this.#url }] : []),
			{ label: 'Link id', value: formatLinkIdFingerprint(this.context.identity.id) },
		]
		if (this.#pairingCode) info.unshift({ label: 'Pairing code', value: this.#pairingCode })

		const paired = this.#getPaired()
		if (paired) {
			info.push({
				label: 'Paired with',
				value: `${paired.name} (${formatLinkIdFingerprint(paired.linkId)})`,
				peerId: paired.linkId,
			})
		}
		this.context.setInfo(info)

		const sections: LinkTransportSection[] = []
		if (paired && this.#stopped) {
			// Only worth forgetting when it has stopped working, eg because the other installation was reset. While it
			// works, forgetting would only pair again straight away, as the other installation still knows this one
			sections.push({
				id: 'pairing',
				title: 'Pairing',
				description: null,
				attention: true,
				entries: [
					{
						id: 'pairing',
						title: `Paired with ${paired.name}`,
						description: `Link id ${formatLinkIdFingerprint(paired.linkId)}. If ${paired.name} was reset, forget it to pair again. What is shared with it is kept until you forget it on the Installations tab.`,
						inputLabel: null,
						actions: [{ id: 'forget', label: 'Forget pairing', color: 'danger' }],
					},
				],
			})
		} else if (this.#stopped) {
			sections.push({
				id: 'pairing',
				title: 'Pairing',
				description: null,
				attention: true,
				entries: [
					{
						id: 'pairing',
						title: `Not paired with ${this.#serverName ?? 'the other installation'}`,
						description: 'Try again to get a new pairing code.',
						inputLabel: null,
						actions: [{ id: 'retry', label: 'Try again', color: 'primary' }],
					},
				],
			})
		}
		this.context.setSections(sections)
	}

	async destroy(): Promise<void> {
		this.#destroyed = true

		if (this.#reconnectTimer) clearTimeout(this.#reconnectTimer)
		this.#reconnectTimer = null

		this.#socket?.terminate()
		this.#socket = null
	}
}

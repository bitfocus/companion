import { WebSocket } from 'ws'
import { z } from 'zod'
import type { LinkTransportInfoItem, LinkTransportSection } from '@companion-app/shared/Model/Link.js'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import type { LinkTransportContext } from '../Types.js'
import { DIRECT_HANDSHAKE_TIMEOUT_MS, DIRECT_MAX_MESSAGE_SIZE, DirectTransportBase } from './DirectTransportBase.js'
import { derivePairingCode, DirectAuthFrameSchema, formatKeyFingerprint } from './Pairing.js'
import { SecureChannel } from './SecureChannel.js'

export type DirectClientTransportConfig = {
	host: string
	port: number
}

const PAIRED_STORAGE_KEY = 'pairedServer'
const PairedServerSchema = z.object({ publicKey: z.string(), name: z.string() })
type PairedServer = z.infer<typeof PairedServerSchema>

const RECONNECT_DELAY_MS = 5_000

/**
 * Connects directly to another installation that is accepting direct connections. The connection is encrypted with
 * Noise. The first time, the user pairs the two by entering the code shown here on the other installation; after
 * that, the other installation's identity is remembered and a different one is refused.
 */
export class DirectClientTransport extends DirectTransportBase {
	readonly #url: string

	#socket: WebSocket | null = null
	#reconnectTimer: NodeJS.Timeout | null = null
	#destroyed = false
	/** Set when retrying would not help, until the user does something about it */
	#stopped = false

	/** The code to enter on the other installation, while it is waiting for it */
	#pairingCode: string | null = null
	#serverName: string | null = null

	constructor(context: LinkTransportContext, config: DirectClientTransportConfig) {
		super(context)
		this.#url = `ws://${config.host.includes(':') ? `[${config.host}]` : config.host}:${config.port}`

		this.#connect()
	}

	#getPaired(): PairedServer | null {
		const parsed = PairedServerSchema.safeParse(this.context.storage.get(PAIRED_STORAGE_KEY))
		return parsed.success ? parsed.data : null
	}

	#connect(): void {
		this.#reconnectTimer = null
		if (this.#destroyed || this.#stopped) return

		this.#pairingCode = null
		this.context.setStatus('connecting', null)
		this.#updateInfo()

		const socket = new WebSocket(this.#url, { maxPayload: 65535, handshakeTimeout: 10_000 })
		this.#socket = socket

		socket.on('error', (e) => {
			this.context.logger.debug(`Connection error: ${stringifyError(e)}`)
			if (!this.#stopped) this.context.setStatus('error', stringifyError(e))
		})
		socket.on('close', () => {
			if (this.#socket !== socket) return
			this.#socket = null
			this.#pairingCode = null
			this.#updateInfo()
			if (this.#destroyed || this.#stopped) return

			if (this.linkedCount === 0) this.context.setStatus('connecting', 'Connection lost, retrying')
			this.#reconnectTimer = setTimeout(() => this.#connect(), RECONNECT_DELAY_MS)
		})
		socket.on('open', () => {
			this.keepAlive(socket, this.#url)

			SecureChannel.establish(
				socket,
				true,
				this.identity,
				this.context.getName(),
				DIRECT_MAX_MESSAGE_SIZE,
				DIRECT_HANDSHAKE_TIMEOUT_MS
			)
				.then((channel) => this.#authenticate(channel))
				.catch((e) => {
					this.context.logger.info(`Handshake failed: ${stringifyError(e)}`)
					this.context.setStatus('error', stringifyError(e))
					socket.terminate()
				})
		})
	}

	#authenticate(channel: SecureChannel): void {
		this.#serverName = channel.remoteName

		const paired = this.#getPaired()
		if (paired && paired.publicKey !== channel.remotePublicKey) {
			// Either the other installation was reset, or something is impersonating it
			this.#stop(
				`${channel.remoteName} has a different identity (${formatKeyFingerprint(channel.remotePublicKey)}) to when it was paired. If it was reset, forget the pairing and pair again.`
			)
			channel.socket.close()
			return
		}

		channel.setHandler((text) => {
			let frame
			try {
				frame = DirectAuthFrameSchema.parse(JSON.parse(text))
			} catch {
				this.context.logger.warn('Invalid message while pairing')
				channel.socket.close()
				return
			}

			switch (frame.status) {
				case 'pairing-required':
					this.#pairingCode = derivePairingCode(channel.handshakeHash)
					this.context.setStatus(
						'connecting',
						`Waiting for pairing. Enter the code ${this.#pairingCode} on ${channel.remoteName} to pair`
					)
					this.#updateInfo()
					break
				case 'paired':
					this.#pairingCode = null
					if (!paired) {
						this.context.storage.set(PAIRED_STORAGE_KEY, {
							publicKey: channel.remotePublicKey,
							name: channel.remoteName,
						} satisfies PairedServer)
					}
					this.context.logger.info(`Connected to ${channel.remoteName}`)
					this.link(channel, channel.remoteName)
					break
				case 'rejected':
					this.#stop(`${channel.remoteName} rejected the pairing`)
					channel.socket.close()
					break
			}
		})
	}

	/** Stop retrying, as it would not help, until the user acts */
	#stop(reason: string): void {
		this.#stopped = true
		this.#pairingCode = null
		this.context.setStatus('error', reason)
		this.#updateInfo()
	}

	async handleAction(entryId: string, actionId: string, _input: string | null): Promise<string | null> {
		if (entryId !== 'pairing') return 'Unknown action'

		if (actionId === 'forget') {
			this.context.storage.set(PAIRED_STORAGE_KEY, null)
		} else if (actionId !== 'retry') {
			return 'Unknown action'
		}

		this.#stopped = false
		this.#socket?.close()
		if (!this.#socket && !this.#reconnectTimer) this.#connect()
		this.#updateInfo()
		return null
	}

	protected linksChanged(): void {
		if (this.#destroyed) return
		if (this.linkedCount > 0) this.context.setStatus('connected', null)
		this.#updateInfo()
	}

	#updateInfo(): void {
		const info: LinkTransportInfoItem[] = [
			{ label: 'Address', value: this.#url },
			{ label: 'Identity', value: formatKeyFingerprint(this.identity.publicKey.toString('hex')) },
		]
		if (this.#pairingCode) info.unshift({ label: 'Pairing code', value: this.#pairingCode })
		this.context.setInfo(info)

		const paired = this.#getPaired()
		const sections: LinkTransportSection[] = []
		if (paired) {
			sections.push({
				id: 'pairing',
				title: 'Pairing',
				description: null,
				attention: this.#stopped,
				entries: [
					{
						id: 'pairing',
						title: `Paired with ${paired.name}`,
						description: `Identity ${formatKeyFingerprint(paired.publicKey)}. Forget it to pair again, eg if it was reset.`,
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

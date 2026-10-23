import Noise from 'noise-handshake'
import CipherState from 'noise-handshake/cipher.js'
import type { KeyPair as NoiseKeyPair } from 'noise-handshake/dh.js'
import { z } from 'zod'
import { LinkIdentity } from '../../Identity.js'
import { LINK_NAME_MAX_LENGTH } from '../../Protocol/Announcement.js'
import type { MessagePipe } from './MessagePipe.js'

/** What the signature of the Noise static key is for (see LinkIdentity.sign) */
const STATIC_KEY_SIGNATURE_CONTEXT = 'companion-link secure-channel static-key'

/** Binds the handshake to this protocol, so it can't be confused with any other use of Noise */
const PROLOGUE = Buffer.from('companion-link-secure/1')

/** A Noise message is at most 65535 bytes; leave room for the auth tag and the continuation flag */
const MAX_CHUNK_SIZE = 65535 - 16 - 1

const FLAG_FINAL = 0
const FLAG_MORE = 1

/** What each end tells the other about itself during the handshake. Encrypted, as XX encrypts these payloads */
const HelloSchema = z.object({
	/** The Link id of the installation, which every message received over the channel is then from */
	linkId: z.string().min(1).max(64),
	/**
	 * The Noise static public key of the sender, signed with the identity key of the Link id, proving the id belongs
	 * to whoever completed the handshake (base64)
	 */
	keySignature: z.string().max(200),
	/** The name of the installation, to show the user */
	name: z.string().max(LINK_NAME_MAX_LENGTH),
})
type Hello = z.infer<typeof HelloSchema>

/**
 * An encrypted, mutually authenticated (by static key) channel over a message pipe, using the Noise XX handshake
 * (Noise_XX_25519_ChaChaPoly_BLAKE2b).
 *
 * Every message on the pipe is a Noise message. After the three handshake messages, each carries a chunk of a text
 * message: messages longer than a Noise message are split, with a leading flag byte saying whether more chunks follow.
 *
 * Whether to trust the other end is up to the caller (see PairingSession.ts).
 */
export class SecureChannel {
	readonly #pipe: MessagePipe
	/** The Link id of the remote end, proven by its signature of the key it completed the handshake with */
	readonly remoteLinkId: string
	/** The name the remote end gave for itself */
	readonly remoteName: string
	/** Hash of the handshake, identical at both ends unless someone is in the middle */
	readonly handshakeHash: Uint8Array

	readonly #sendCipher: CipherState
	readonly #receiveCipher: CipherState
	readonly #maxMessageSize: number

	#partial: Buffer[] = []
	#partialSize = 0
	#handler: ((text: string) => void) | null = null
	#queue: string[] = []

	private constructor(pipe: MessagePipe, noise: Noise, remoteHello: Hello, maxMessageSize: number) {
		if (!noise.tx || !noise.rx || !noise.rs || !noise.hash) throw new Error('Handshake is not complete')

		this.#pipe = pipe
		this.remoteLinkId = remoteHello.linkId
		this.remoteName = remoteHello.name
		this.handshakeHash = noise.hash
		this.#sendCipher = new CipherState(noise.tx)
		this.#receiveCipher = new CipherState(noise.rx)
		this.#maxMessageSize = maxMessageSize

		// Attached synchronously, so that nothing sent straight after the handshake is missed
		pipe.setReceiver((data) => this.#receive(data))
	}

	/**
	 * Run the handshake over an open pipe
	 * @param initiator - whether this end opened the connection
	 * @param keyPair - the Noise static key pair of this end
	 * @param identity - the identity of this installation, which signs the static key to prove its Link id
	 * @param localName - the name to give the other end
	 * @param maxMessageSize - the largest message accepted from the other end, after reassembly
	 */
	static async establish(
		pipe: MessagePipe,
		initiator: boolean,
		keyPair: NoiseKeyPair,
		identity: LinkIdentity,
		localName: string,
		maxMessageSize: number,
		timeoutMs: number
	): Promise<SecureChannel> {
		const noise = new Noise('XX', initiator, keyPair)
		noise.initialise(PROLOGUE)
		const hello = Buffer.from(
			JSON.stringify({
				linkId: identity.id,
				keySignature: identity.sign(STATIC_KEY_SIGNATURE_CONTEXT, keyPair.publicKey).toString('base64'),
				name: localName,
			} satisfies Hello)
		)

		return new Promise<SecureChannel>((resolve, reject) => {
			let step = 0
			let settled = false

			const cleanup = () => {
				settled = true
				clearTimeout(timeout)
				pipe.setReceiver(() => {})
			}
			const fail = (reason: string) => {
				if (settled) return
				cleanup()
				reject(new Error(reason))
			}
			const finish = (remotePayload: Uint8Array) => {
				cleanup()
				const remoteHello = parseHello(remotePayload)
				if (!remoteHello) return reject(new Error('Invalid handshake payload'))
				if (
					!noise.rs ||
					!LinkIdentity.verify(
						remoteHello.linkId,
						STATIC_KEY_SIGNATURE_CONTEXT,
						noise.rs,
						Buffer.from(remoteHello.keySignature, 'base64')
					)
				) {
					return reject(new Error('The other end could not prove its Link id'))
				}
				resolve(new SecureChannel(pipe, noise, remoteHello, maxMessageSize))
			}

			const timeout = setTimeout(() => fail('Handshake timed out'), timeoutMs)

			// -> e
			// <- e, ee, s, es (+ responder hello)
			// -> s, se (+ initiator hello)
			const onMessage = (buf: Buffer) => {
				try {
					step++
					if (initiator) {
						if (step !== 1) return fail('Unexpected handshake message')
						const remotePayload = noise.recv(buf)
						pipe.send(noise.send(hello))
						finish(remotePayload)
					} else if (step === 1) {
						noise.recv(buf)
						pipe.send(noise.send(hello))
					} else if (step === 2) {
						finish(noise.recv(buf))
					} else {
						fail('Unexpected handshake message')
					}
				} catch (e) {
					fail(`Handshake failed: ${e instanceof Error ? e.message : String(e)}`)
				}
			}

			pipe.setReceiver(onMessage)
			pipe.onClose(() => fail('Connection closed during handshake'))

			if (initiator) pipe.send(noise.send())
		})
	}

	/** Set what receives the decrypted messages. Anything received before this is delivered now */
	setHandler(handler: (text: string) => void): void {
		this.#handler = handler
		const queued = this.#queue
		this.#queue = []
		for (const text of queued) handler(text)
	}

	send(text: string): void {
		const plaintext = Buffer.from(text, 'utf8')
		let offset = 0
		do {
			const chunk = plaintext.subarray(offset, offset + MAX_CHUNK_SIZE)
			offset += chunk.length
			const flag = offset < plaintext.length ? FLAG_MORE : FLAG_FINAL
			this.#pipe.send(this.#sendCipher.encrypt(Buffer.concat([Buffer.from([flag]), chunk])))
		} while (offset < plaintext.length)
	}

	/** Be told when the channel has closed, from either end. Can be called more than once */
	onClose(listener: () => void): void {
		this.#pipe.onClose(listener)
	}

	close(): void {
		this.#pipe.close()
	}

	/** Close at once, as the other end can't be trusted */
	terminate(): void {
		this.#pipe.terminate()
	}

	#receive(data: Buffer): void {
		let frame: Buffer
		try {
			frame = asBuffer(this.#receiveCipher.decrypt(data))
			if (frame.length < 1) throw new Error('Empty frame')
		} catch {
			// Tampered with, or out of step: the channel can't be trusted any more
			this.#pipe.terminate()
			return
		}

		const chunk = frame.subarray(1)
		this.#partial.push(chunk)
		this.#partialSize += chunk.length
		if (this.#partialSize > this.#maxMessageSize) {
			this.#pipe.terminate()
			return
		}
		if (frame[0] === FLAG_MORE) return

		const text = Buffer.concat(this.#partial).toString('utf8')
		this.#partial = []
		this.#partialSize = 0

		if (this.#handler) this.#handler(text)
		else this.#queue.push(text)
	}
}

function parseHello(payload: Uint8Array): Hello | null {
	try {
		const parsed = HelloSchema.safeParse(JSON.parse(asBuffer(payload).toString('utf8')))
		return parsed.success ? parsed.data : null
	} catch {
		return null
	}
}

/** View the bytes noise-handshake returns as a Buffer, without copying (it returns Buffers in Node anyway) */
function asBuffer(data: Uint8Array): Buffer {
	return Buffer.isBuffer(data) ? data : Buffer.from(data.buffer, data.byteOffset, data.byteLength)
}

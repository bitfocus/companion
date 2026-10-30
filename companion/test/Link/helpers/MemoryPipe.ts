import { generateKeyPair } from 'noise-handshake/dh.js'
import { LinkIdentity } from '../../../lib/Link/Identity.js'
import type { MessagePipe } from '../../../lib/Link/Transports/Secure/MessagePipe.js'
import { SecureChannel } from '../../../lib/Link/Transports/Secure/SecureChannel.js'

interface MemoryPipeEnd extends MessagePipe {
	readonly closed: boolean
	/** Intercept what this end sends, eg to tamper with it. Return null to drop it */
	tamper: ((data: Uint8Array) => Uint8Array | null) | null
}

/**
 * Two connected in-memory message pipes. Messages are delivered asynchronously, as over a real connection, and closing
 * either end closes both, after delivering what was sent before
 */
export function createMemoryPipePair(): [MemoryPipeEnd, MemoryPipeEnd] {
	const receivers: (((data: Buffer) => void) | null)[] = [null, null]
	const closeListeners: (() => void)[] = []
	let closed = false

	let closing = false
	const closeNow = () => {
		if (closed) return
		closed = true
		setImmediate(() => {
			for (const listener of closeListeners) listener()
		})
	}
	/** Like a websocket, what was sent before closing is still delivered */
	const close = () => {
		if (closing) return
		closing = true
		setImmediate(closeNow)
	}

	const end = (index: 0 | 1): MemoryPipeEnd => {
		const self: MemoryPipeEnd = {
			get closed() {
				return closed
			},
			tamper: null,
			send: (data) => {
				if (closing || closed) return
				const out = self.tamper ? self.tamper(data) : data
				if (!out) return
				const copy = Buffer.from(out)
				setImmediate(() => {
					if (!closed) receivers[1 - index]?.(copy)
				})
			},
			setReceiver: (receiver) => {
				receivers[index] = receiver
			},
			onClose: (listener) => {
				closeListeners.push(listener)
			},
			close,
			terminate: closeNow,
		}
		return self
	}

	return [end(0), end(1)]
}

const MAX_MESSAGE_SIZE = 1024 * 1024

/** Two ends of a secure channel over an in-memory pipe */
export async function establishPair() {
	const [connecting, accepting] = createMemoryPipePair()
	const connectingIdentity = LinkIdentity.generate()
	const acceptingIdentity = LinkIdentity.generate()
	const [connectingChannel, acceptingChannel] = await Promise.all([
		SecureChannel.establish(
			connecting,
			true,
			generateKeyPair(),
			connectingIdentity,
			'Connecting',
			MAX_MESSAGE_SIZE,
			5000
		),
		SecureChannel.establish(
			accepting,
			false,
			generateKeyPair(),
			acceptingIdentity,
			'Accepting',
			MAX_MESSAGE_SIZE,
			5000
		),
	])
	return {
		connecting: { channel: connectingChannel, pipe: connecting, identity: connectingIdentity },
		accepting: { channel: acceptingChannel, pipe: accepting, identity: acceptingIdentity },
	}
}

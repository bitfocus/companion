import type { RawData, WebSocket } from 'ws'

/**
 * A two-way pipe of binary messages between two ends, which a {@link SecureChannel} runs over. Anything that can carry
 * opaque messages between two installations can be one: a websocket, a relay, a data channel, …
 */
export interface MessagePipe {
	send(data: Uint8Array): void
	/** Set what receives the messages. Messages that arrive before it is set may be dropped */
	setReceiver(receiver: (data: Buffer) => void): void
	/** Be told when the pipe has closed, from either end. Can be called more than once */
	onClose(listener: () => void): void
	/** Close the pipe */
	close(): void
	/** Close the pipe at once, as the other end can't be trusted */
	terminate(): void
}

/** A websocket as a message pipe. A text message isn't part of the protocol, so the socket is terminated on one */
export function websocketMessagePipe(socket: WebSocket): MessagePipe {
	let receiver: ((data: Buffer) => void) | null = null
	socket.on('message', (data, isBinary) => {
		if (!isBinary) {
			socket.terminate()
			return
		}
		receiver?.(toBuffer(data))
	})

	return {
		send: (data) => socket.send(data),
		setReceiver: (fn) => {
			receiver = fn
		},
		onClose: (listener) => socket.on('close', listener),
		close: () => socket.close(),
		terminate: () => socket.terminate(),
	}
}

function toBuffer(data: RawData): Buffer {
	if (Buffer.isBuffer(data)) return data
	if (Array.isArray(data)) return Buffer.concat(data)
	return Buffer.from(data)
}

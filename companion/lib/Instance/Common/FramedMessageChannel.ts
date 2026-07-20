/*
 * The stateful side of the framed module IPC transport (see MessageFraming.ts for the wire format).
 *
 * FramedChannel wraps a single duplex stream (the data channel socket): it frames outbound messages with
 * backpressure handling and decodes inbound frames. HostFramedTransport adds the host-side respawn
 * lifecycle - the child is replaced on every restart, and each incarnation opens its own socket, so it
 * rebinds a fresh FramedChannel on each DataChannelServer 'connect'.
 */

import type { Socket } from 'node:net'
import type { Duplex } from 'node:stream'
import type { DataChannelServer } from './DataChannelServer.js'
import { encodeFrame, FrameDecoder } from './MessageFraming.js'

/** Called for each decoded inbound message, with the exact wire byte count of its body. */
export type FramedMessageHandler = (message: unknown, bodyBytes: number) => void

/**
 * Frame/deframe messages over one duplex stream. Outbound writes are queued and paced to the stream's
 * backpressure (`write()` returning false -> wait for 'drain') so a flood of large messages can't run the
 * write buffer away. Inbound chunks are reassembled into whole frames.
 */
export class FramedChannel {
	readonly #stream: Duplex
	readonly #decoder = new FrameDecoder()
	readonly #writeQueue: Buffer[] = []
	#blocked = false
	#destroyed = false

	constructor(stream: Duplex, onMessage: FramedMessageHandler) {
		this.#stream = stream

		stream.on('data', (chunk: Buffer) => {
			if (this.#destroyed) return

			let frames
			try {
				frames = this.#decoder.push(chunk)
			} catch (_e) {
				// Unrecoverable framing error (e.g. an over-limit or corrupt length prefix) - the stream can't
				// be resynced, so tear it down. The child lifecycle (crash/respawn) is owned by RespawnMonitor.
				stream.destroy()
				return
			}
			for (const frame of frames) {
				if (this.#destroyed) return
				onMessage(frame.message, frame.bodyBytes)
			}
		})
		stream.on('drain', () => {
			this.#blocked = false
			this.#flush()
		})
		// Swallow stream errors here - the child lifecycle (crash/respawn) is owned by RespawnMonitor.
		stream.on('error', () => undefined)
	}

	/**
	 * Queue a message for sending. Returns the exact body byte count put on the wire (for metrics), or 0 once
	 * the channel has been destroyed.
	 */
	send(message: unknown): number {
		if (this.#destroyed) return 0

		const { frame, bodyBytes } = encodeFrame(message)
		this.#writeQueue.push(frame)
		this.#flush()
		return bodyBytes
	}

	/**
	 * Stop carrying messages in either direction. Anything still in flight on the stream is discarded rather
	 * than delivered, so a late message cannot land on an owner that has already torn itself down.
	 *
	 * The stream itself is left alone - it belongs to the child's lifecycle, not to this channel.
	 */
	destroy(): void {
		this.#destroyed = true
		this.#writeQueue.length = 0
	}

	#flush(): void {
		while (!this.#blocked && this.#writeQueue.length > 0) {
			const frame = this.#writeQueue.shift()!
			// write() returns false when the internal buffer is full; keep the rest queued until 'drain'
			if (!this.#stream.write(frame)) this.#blocked = true
		}
	}
}

/**
 * Host-side transport over the child's data channel socket. Binds a fresh FramedChannel each time a child
 * connects, so partial-frame state from a dead child can never bleed into the next one, and drops it again
 * when that child goes away so messages are not written into a dead socket.
 */
export class HostFramedTransport {
	readonly #dataChannel: DataChannelServer
	readonly #onConnect: (socket: Socket) => void
	readonly #onDisconnect: () => void

	#channel: FramedChannel | null = null

	constructor(dataChannel: DataChannelServer, onMessage: FramedMessageHandler) {
		this.#dataChannel = dataChannel

		this.#onConnect = (socket) => {
			this.#channel = new FramedChannel(socket, onMessage)
		}
		this.#onDisconnect = () => {
			this.#channel?.destroy()
			this.#channel = null
		}

		dataChannel.on('connect', this.#onConnect)
		dataChannel.on('disconnect', this.#onDisconnect)
	}

	/**
	 * Send a message to the current child. Returns the body byte count, or 0 if no child is connected.
	 */
	send(message: unknown): number {
		if (!this.#channel) return 0
		return this.#channel.send(message)
	}

	/**
	 * Permanently stop carrying messages, in either direction, for an owner that is being torn down. A child
	 * that is still alive (or one that connects later) can no longer deliver a message into stale state.
	 */
	destroy(): void {
		this.#dataChannel.off('connect', this.#onConnect)
		this.#dataChannel.off('disconnect', this.#onDisconnect)

		this.#onDisconnect()
	}
}

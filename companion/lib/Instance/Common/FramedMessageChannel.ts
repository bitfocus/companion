/*
 * The stateful side of the framed module IPC transport (see MessageFraming.ts for the wire format).
 *
 * FramedChannel wraps a single duplex stream (a raw 'pipe' stdio fd): it frames outbound messages with
 * backpressure handling and decodes inbound frames. HostFramedTransport adds the host-side respawn
 * lifecycle - the child (and its fd streams) is replaced on every restart, so it rebinds a fresh
 * FramedChannel on each RespawnMonitor 'spawn'.
 */

import type { Duplex } from 'node:stream'
import type { RespawnChild, RespawnMonitor } from '@companion-app/shared/Respawn.js'
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

	constructor(stream: Duplex, onMessage: FramedMessageHandler) {
		this.#stream = stream

		stream.on('data', (chunk: Buffer) => {
			for (const frame of this.#decoder.push(chunk)) {
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
	 * Queue a message for sending. Returns the exact body byte count put on the wire (for metrics).
	 */
	send(message: unknown): number {
		const { frame, bodyBytes } = encodeFrame(message)
		this.#writeQueue.push(frame)
		this.#flush()
		return bodyBytes
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
 * Host-side transport over a child's extra stdio fd. Rebinds a fresh FramedChannel whenever the child is
 * (re)spawned, so partial-frame state from a dead child can never bleed into the next one.
 */
export class HostFramedTransport {
	#channel: FramedChannel | null = null

	constructor(monitor: RespawnMonitor, fd: number, onMessage: FramedMessageHandler) {
		const bind = (child: RespawnChild) => {
			const stream = child.stdio[fd] as Duplex | undefined
			if (!stream) return
			this.#channel = new FramedChannel(stream, onMessage)
		}

		monitor.on('spawn', bind)
		if (monitor.child) bind(monitor.child)
	}

	/**
	 * Send a message to the current child. Returns the body byte count, or 0 if no child is running.
	 */
	send(message: unknown): number {
		if (!this.#channel) return 0
		return this.#channel.send(message)
	}
}

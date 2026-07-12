/*
 * Length-prefixed JSON framing for the module IPC transport.
 *
 * The companion-owned module IPC (new connections + surfaces) sends its messages over a dedicated raw
 * 'pipe' stdio fd rather than the object-mode 'ipc' channel. Owning the serialization means we serialize
 * each message exactly once (here), and `bodyBytes` is the exact number of bytes put on the wire - so IPC
 * byte metrics are free and exact, with no double-encode through Node's object-mode IPC serializer.
 *
 * Wire format per message: [uint32 BE body length][utf-8 JSON body]. uint32 prefix gives O(1) framing on
 * multi-MB messages (no newline scan). It stays UTF-8 JSON, so it is cross-Node-version safe (unlike V8
 * 'advanced' serialization). Both ends of the new transport are companion code shipped as one unit -
 * published modules sit behind @companion-module/host and never see this framing.
 */

const HEADER_BYTES = 4

/**
 * Upper bound on a single frame body. The 4-byte length prefix is attacker-influenced (a module can
 * write to its own fd), and without a cap a bogus/corrupt length makes the receiver accumulate toward
 * ~4 GB waiting for a body that never arrives - an unbounded-memory DoS. This ceiling is far above any
 * legitimate message (large base64 draw images, big preset sets) while keeping worst-case buffering
 * bounded. An over-limit prefix means the stream is desynced and unrecoverable, so the transport tears
 * the connection down (see FramedChannel).
 */
export const MAX_FRAME_BODY_BYTES = 256 * 1024 * 1024

/**
 * Serialize a message to a length-prefixed frame. `bodyBytes` is the exact JSON byte count on the wire,
 * for metrics (the 4-byte header is fixed overhead and not counted).
 */
export function encodeFrame(message: unknown): { frame: Buffer; bodyBytes: number } {
	const body = Buffer.from(JSON.stringify(message), 'utf8')
	const header = Buffer.allocUnsafe(HEADER_BYTES)
	header.writeUInt32BE(body.length, 0)
	return { frame: Buffer.concat([header, body]), bodyBytes: body.length }
}

/** A decoded frame: the parsed message plus its exact wire byte count. */
export interface DecodedFrame {
	message: unknown
	bodyBytes: number
}

/**
 * Accumulates raw chunks from a pipe and emits complete frames. Stateful - one per stream/child. Reset
 * (construct a new one) when the underlying child is replaced, so a partial frame from a dead child can't
 * corrupt the next one.
 */
export class FrameDecoder {
	#buffer: Buffer = Buffer.alloc(0)
	#expectedBody: number | null = null

	push(chunk: Buffer): DecodedFrame[] {
		this.#buffer = this.#buffer.length === 0 ? chunk : Buffer.concat([this.#buffer, chunk])

		const out: DecodedFrame[] = []
		for (;;) {
			if (this.#expectedBody === null) {
				if (this.#buffer.length < HEADER_BYTES) break
				const declared = this.#buffer.readUInt32BE(0)
				if (declared > MAX_FRAME_BODY_BYTES) {
					// The length prefix is desynced or hostile; the stream can no longer be framed. Throw so
					// the transport can tear the connection down rather than buffer toward ~4 GB.
					throw new Error(`Incoming frame body ${declared} bytes exceeds maximum ${MAX_FRAME_BODY_BYTES}`)
				}
				this.#expectedBody = declared
				this.#buffer = this.#buffer.subarray(HEADER_BYTES)
			}

			if (this.#buffer.length < this.#expectedBody) break

			const body = this.#buffer.subarray(0, this.#expectedBody)
			this.#buffer = this.#buffer.subarray(this.#expectedBody)
			const bodyBytes = this.#expectedBody
			this.#expectedBody = null

			out.push({ message: JSON.parse(body.toString('utf8')), bodyBytes })
		}
		return out
	}
}

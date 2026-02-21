import { v4 } from 'uuid'
import EventEmitter from 'node:events'
import LogController from '../Log/Controller.js'
import { crc32 } from './Crc32.js'

/** Maximum chunk payload size (~63KB to stay under 64KB MQTT broker limit) */
const MAX_CHUNK_SIZE = 63 * 1024

/** Timeout for incomplete reassembly buffers (60 seconds) */
const REASSEMBLY_TIMEOUT_MS = 60_000

/** Interval for cleaning up stale reassembly buffers (10 seconds) */
const CLEANUP_INTERVAL_MS = 10_000

/** Separator between JSON header and binary data in a chunk message */
const CHUNK_SEPARATOR = '\n'

/** Header prepended to chunked messages so receivers know the payload was chunked */
export interface ChunkHeader {
	/** Unique message ID for reassembly */
	id: string
	/** Chunk index (0-based) */
	idx: number
	/** Total number of chunks */
	total: number
	/** Total assembled size in bytes */
	size: number
	/** CRC32 of this chunk's binary data */
	crc: number
}

/** A chunk ready to be published */
export interface OutboundChunk {
	/** The chunk payload (JSON header + newline + binary data) */
	payload: Buffer
}

/** Internal reassembly buffer */
interface ReassemblyBuffer {
	/** Total number of chunks expected */
	total: number
	/** Total expected assembled size */
	size: number
	/** Received chunks indexed by position */
	chunks: Map<number, Buffer>
	/** Timestamp when first chunk was received */
	firstChunkTime: number
}

export type ChunkManagerEvents = {
	/** Emitted when a complete message has been reassembled */
	assembled: [messageId: string, data: Buffer]
}

/**
 * Handles chunking of large messages and reassembly of received chunks.
 *
 * Chunking protocol:
 * - Messages larger than MAX_CHUNK_SIZE are split into chunks
 * - Each chunk is a Buffer: JSON header + '\n' + binary data
 * - The JSON header contains id, idx, total, size, and crc fields
 * - Receiver reassembles chunks by message ID and verifies CRC32 per chunk
 * - Incomplete messages are discarded after REASSEMBLY_TIMEOUT_MS
 */
export class ChunkManager extends EventEmitter<ChunkManagerEvents> {
	readonly #logger = LogController.createLogger('Link/ChunkManager')

	/** Active reassembly buffers keyed by message ID */
	readonly #reassemblyBuffers = new Map<string, ReassemblyBuffer>()

	/** Cleanup interval handle */
	#cleanupInterval: ReturnType<typeof setInterval> | null = null

	/**
	 * Check whether a payload needs chunking.
	 */
	needsChunking(data: Buffer): boolean {
		return data.length > MAX_CHUNK_SIZE
	}

	/**
	 * Split a large payload into chunks ready for publishing.
	 * Each chunk is a self-contained Buffer with a JSON header and binary data.
	 *
	 * @param data - The complete binary payload to chunk
	 * @returns Array of outbound chunks
	 */
	chunkify(data: Buffer): OutboundChunk[] {
		const messageId = v4()
		const totalSize = data.length
		const chunkCount = Math.ceil(totalSize / MAX_CHUNK_SIZE)
		const chunks: OutboundChunk[] = []

		for (let i = 0; i < chunkCount; i++) {
			const start = i * MAX_CHUNK_SIZE
			const end = Math.min(start + MAX_CHUNK_SIZE, totalSize)
			const chunkData = data.subarray(start, end)

			const header: ChunkHeader = {
				id: messageId,
				idx: i,
				total: chunkCount,
				size: totalSize,
				crc: crc32(chunkData),
			}

			const headerJson = JSON.stringify(header)
			const headerBuf = Buffer.from(headerJson, 'utf-8')
			const separatorBuf = Buffer.from(CHUNK_SEPARATOR, 'utf-8')

			const payload = Buffer.concat([headerBuf, separatorBuf, chunkData])
			chunks.push({ payload })
		}

		return chunks
	}

	/**
	 * Process a received chunk message.
	 * When all chunks for a message are received, emits 'assembled' with the complete data.
	 *
	 * @param payload - Raw chunk message (JSON header + '\n' + binary data)
	 */
	handleChunk(payload: Buffer): void {
		// Parse header: find the newline separator
		const separatorIndex = payload.indexOf(CHUNK_SEPARATOR)
		if (separatorIndex === -1) {
			this.#logger.warn('Received chunk without header separator')
			return
		}

		const headerStr = payload.subarray(0, separatorIndex).toString('utf-8')
		const chunkData = payload.subarray(separatorIndex + 1)

		let header: ChunkHeader
		try {
			header = JSON.parse(headerStr)
		} catch {
			this.#logger.warn('Failed to parse chunk header')
			return
		}

		// Validate header fields
		if (
			typeof header.id !== 'string' ||
			typeof header.idx !== 'number' ||
			typeof header.total !== 'number' ||
			typeof header.size !== 'number' ||
			typeof header.crc !== 'number'
		) {
			this.#logger.warn('Invalid chunk header fields')
			return
		}

		// Verify CRC32 of chunk data
		const computedCrc = crc32(chunkData)
		if (computedCrc !== header.crc) {
			this.#logger.warn(`CRC32 mismatch for chunk ${header.idx} of message ${header.id}`)
			return
		}

		// Get or create reassembly buffer
		let buffer = this.#reassemblyBuffers.get(header.id)
		if (!buffer) {
			buffer = {
				total: header.total,
				size: header.size,
				chunks: new Map(),
				firstChunkTime: Date.now(),
			}
			this.#reassemblyBuffers.set(header.id, buffer)
		}

		// Validate consistency
		if (buffer.total !== header.total || buffer.size !== header.size) {
			this.#logger.warn(`Inconsistent chunk metadata for message ${header.id}`)
			this.#reassemblyBuffers.delete(header.id)
			return
		}

		// Store chunk (ignore duplicates)
		if (!buffer.chunks.has(header.idx)) {
			buffer.chunks.set(header.idx, chunkData)
		}

		// Check if all chunks received
		if (buffer.chunks.size === buffer.total) {
			this.#assemble(header.id, buffer)
		}
	}

	/**
	 * Start the background cleanup timer for stale reassembly buffers.
	 */
	start(): void {
		this.stop()
		this.#cleanupInterval = setInterval(() => this.#cleanupStale(), CLEANUP_INTERVAL_MS)
	}

	/**
	 * Stop the cleanup timer and clear all reassembly buffers.
	 */
	stop(): void {
		if (this.#cleanupInterval) {
			clearInterval(this.#cleanupInterval)
			this.#cleanupInterval = null
		}
		this.#reassemblyBuffers.clear()
	}

	/**
	 * Assemble a complete message from all received chunks.
	 */
	#assemble(messageId: string, buffer: ReassemblyBuffer): void {
		this.#reassemblyBuffers.delete(messageId)

		// Build the complete payload in order
		const parts: Buffer[] = []
		for (let i = 0; i < buffer.total; i++) {
			const chunk = buffer.chunks.get(i)
			if (!chunk) {
				this.#logger.warn(`Missing chunk ${i} for message ${messageId} during assembly`)
				return
			}
			parts.push(chunk)
		}

		const assembled = Buffer.concat(parts)

		// Verify total size
		if (assembled.length !== buffer.size) {
			this.#logger.warn(
				`Size mismatch for message ${messageId}: expected ${buffer.size}, got ${assembled.length}`
			)
			return
		}

		this.emit('assembled', messageId, assembled)
	}

	/**
	 * Remove reassembly buffers that have timed out.
	 */
	#cleanupStale(): void {
		const now = Date.now()
		for (const [messageId, buffer] of this.#reassemblyBuffers) {
			if (now - buffer.firstChunkTime > REASSEMBLY_TIMEOUT_MS) {
				this.#logger.debug(
					`Discarding incomplete message ${messageId} (${buffer.chunks.size}/${buffer.total} chunks after ${REASSEMBLY_TIMEOUT_MS}ms)`
				)
				this.#reassemblyBuffers.delete(messageId)
			}
		}
	}
}

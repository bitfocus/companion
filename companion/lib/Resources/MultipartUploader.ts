import { nanoid } from 'nanoid'
import crypto from 'crypto'

const TIMEOUT_DURATION = 5000 // time before upload session is considered inactive and killed

export class MultipartUploader {
	#session: MultipartUploaderSession | null = null

	#inactiveTimeout: NodeJS.Timeout | null = null

	#sessionTimeoutCallback: (sessionId: string) => void

	constructor(sessionTimeoutCallback: (sessionId: string) => void) {
		this.#sessionTimeoutCallback = sessionTimeoutCallback
	}

	initSession(name: string, size: number): string | null {
		if (this.#session) return null

		const sessionId = nanoid()
		this.#session = {
			id: sessionId,
			name,
			size,
			data: Buffer.alloc(size),

			filledBytes: 0,
			lastChunkTime: Date.now(),
		}

		if (!this.#inactiveTimeout) {
			this.#inactiveTimeout = setInterval(() => {
				if (!this.#session) {
					clearInterval(this.#inactiveTimeout!)
					this.#inactiveTimeout = null
					return
				}

				if (Date.now() - this.#session.lastChunkTime > TIMEOUT_DURATION) {
					const sessionId = this.#session.id
					this.#session = null
					this.#sessionTimeoutCallback(sessionId)
				}
			}, 1000)
		}

		return sessionId
	}

	addChunk(sessionId: string, offset: number, data: Uint8Array): number | null {
		if (!this.#session || this.#session.id !== sessionId) return null

		this.#session.data.set(data, offset)
		this.#session.filledBytes += data.length
		this.#session.lastChunkTime = Date.now()

		return Math.min(1, this.#session.filledBytes / this.#session.size)
	}

	completeSession(sessionId: string, expectedChecksum: string): Buffer | null {
		if (!this.#session || this.#session.id !== sessionId) return null

		const session = this.#session
		this.#session = null

		if (this.#inactiveTimeout) {
			clearInterval(this.#inactiveTimeout)
			this.#inactiveTimeout = null
		}

		const computedChecksum = crypto.createHash('sha-1').update(session.data).digest('hex')
		if (computedChecksum !== expectedChecksum) throw new Error('Checksum mismatch')

		return session.data
	}

	cancelSession(sessionId: string): boolean {
		if (!this.#session || this.#session.id !== sessionId) return false

		this.#session = null
		return true
	}
}

interface MultipartUploaderSession {
	readonly id: string
	readonly name: string
	readonly size: number
	readonly data: Buffer

	filledBytes: number
	lastChunkTime: number
}

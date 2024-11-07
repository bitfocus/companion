import { nanoid } from 'nanoid'
import crypto from 'crypto'

export class MultipartUploader {
	#session: MultipartUploaderSession | null = null

	initSession(name: string, size: number, checksum: string): string | null {
		if (this.#session) return null

		const sessionId = nanoid()
		this.#session = {
			id: sessionId,
			name,
			size,
			checksum,
			data: new Uint8Array(size),

			filledBytes: 0,
		}

		// TODO - setup timeout

		return sessionId
	}

	addChunk(sessionId: string, offset: number, data: Uint8Array): number | null {
		if (!this.#session || this.#session.id !== sessionId) return null

		this.#session.data.set(data, offset)
		this.#session.filledBytes += data.length

		return Math.min(1, this.#session.filledBytes / this.#session.size)
	}

	completeSession(sessionId: string): Uint8Array | null {
		if (!this.#session || this.#session.id !== sessionId) return null

		const checksum = crypto.createHash('sha-1').update(this.#session.data).digest('hex')
		if (checksum !== this.#session.checksum) throw new Error('Checksum mismatch')

		const data = this.#session.data
		this.#session = null
		return data
	}

	cancelSession(sessionId: string): boolean {
		if (!this.#session || this.#session.id !== sessionId) return false

		this.#session = null
		return true
	}
}

interface MultipartUploaderSession {
	id: string
	name: string
	size: number
	checksum: string
	data: Uint8Array

	filledBytes: number
}

import { nanoid } from 'nanoid'
import crypto from 'crypto'
import { publicProcedure, router, toIterable, TrpcContext } from '../UI/TRPC.js'
import z from 'zod'
import LogController, { type Logger } from '../Log/Controller.js'
import { EventEmitter } from 'node:events'

const TIMEOUT_DURATION = 5000 // time before upload session is considered inactive and killed

export type MultipartUploaderApi<TRes> = ReturnType<MultipartUploader<TRes>['createTrpcRouter']>

export class MultipartUploader<TRes> {
	#logger: Logger
	#session: MultipartUploaderSession | null = null

	#inactiveTimeout: NodeJS.Timeout | null = null

	readonly #maxUploadSize: number
	readonly #sessionCompleteCallback: (
		name: string,
		data: Buffer,
		updateProgress: (percent: number) => void,
		ctx: TrpcContext
	) => Promise<TRes>

	readonly #progressEvents = new EventEmitter<{ [id: `progress:${string}`]: [progress: number | null] }>()

	constructor(
		logPrefix: string,
		maxUploadSize: number,
		sessionCompleteCallback: (
			name: string,
			data: Buffer,
			updateProgress: (percent: number) => void,
			ctx: TrpcContext
		) => Promise<TRes>
	) {
		this.#logger = LogController.createLogger(logPrefix)
		this.#maxUploadSize = maxUploadSize
		this.#sessionCompleteCallback = sessionCompleteCallback

		this.#progressEvents.setMaxListeners(0)
	}

	createTrpcRouter() {
		// Future: maybe this could be simplified a bit to use trpc file transfers, but for now we'll keep it as is
		const self = this
		return router({
			watchProgress: publicProcedure
				.input(
					z.object({
						sessionId: z.string(),
					})
				)
				.subscription(async function* ({ input, signal }) {
					const changes = toIterable(self.#progressEvents, `progress:${input.sessionId}`, signal)

					yield 0 // TODO - better value?

					for await (const [change] of changes) {
						yield change
					}
				}),

			start: publicProcedure
				.input(
					z.object({
						name: z.string(),
						size: z.number().min(1).max(this.#maxUploadSize),
					})
				)
				.mutation(({ input }) => {
					this.#logger.info(`Starting upload of file ${input.name} (${input.size} bytes)`)

					const sessionId = this.initSession(input.name, input.size)
					if (!sessionId) throw new Error('Session already exists or size is invalid')

					this.#progressEvents.emit(`progress:${sessionId}`, 0)

					return sessionId
				}),

			cancel: publicProcedure
				.input(
					z.object({
						sessionId: z.string(),
					})
				)
				.mutation(({ input }) => {
					this.#logger.info(`Cancelling upload session ${input.sessionId}`)

					this.cancelSession(input.sessionId)
				}),

			uploadChunk: publicProcedure
				.input(
					z.object({
						sessionId: z.string(),
						offset: z.number().min(0),
						data: z.string(), // Base64 encoded string
					})
				)
				.mutation(({ input }) => {
					const buffer = Buffer.from(input.data, 'base64')
					this.#logger.info(`Uploading chunk ${input.sessionId} (@${input.offset} = ${buffer.length} bytes)`)

					const progress = this.addChunk(input.sessionId, input.offset, buffer)
					if (progress === null) throw new Error('Invalid session or offset')

					this.#progressEvents.emit(`progress:${input.sessionId}`, progress / 2)
					return progress
				}),

			complete: publicProcedure
				.input(
					z.object({
						sessionId: z.string(),
						expectedChecksum: z.string().length(40), // SHA-1 checksum is 40
					})
				)
				.mutation(async ({ input, ctx }) => {
					this.#logger.info(`Completing upload session ${input.sessionId}`)

					const data = this.completeSession(input.sessionId, input.expectedChecksum)
					if (!data) throw new Error('Failed to complete session')

					this.#progressEvents.emit(`progress:${input.sessionId}`, 0.5)

					let hasFinished = false
					const updateProgress = (percent: number) => {
						if (hasFinished) return
						this.#progressEvents.emit(`progress:${input.sessionId}`, 0.5 + percent / 2)
					}

					return this.#sessionCompleteCallback(input.sessionId, data, updateProgress, ctx)
						.catch((e) => {
							this.#logger.error(`Failed to complete upload`, e)
							hasFinished = true
							this.#progressEvents.emit(`progress:${input.sessionId}`, null) // TODO - report failure?
							throw e
						})
						.finally(() => {
							hasFinished = true
							this.#progressEvents.emit(`progress:${input.sessionId}`, null)
						})
				}),
		})
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

					this.#logger.info(`Upload session "${sessionId}" timed out`)
					this.#progressEvents.emit(`progress:${sessionId}`, null)
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

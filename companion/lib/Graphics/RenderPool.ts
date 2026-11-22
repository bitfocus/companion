/*
 * This file is part of the Companion project
 * Copyright (c) 2026 Bitfocus AS
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 */

import { EventEmitter } from 'node:events'
import workerPool from 'workerpool'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import type { Logger } from '../Log/Controller.js'
import { execWithStallTimeout, RenderTaskStalledError } from './RenderTaskTimeout.js'

const WORKER_TERMINATION_WINDOW_MS = 60_000 // 1 minute
const WORKER_TERMINATION_THRESHOLD = 30 // High limit, to catch extreme cases

export type WorkerPool = ReturnType<typeof workerPool.pool>

type PoolMethods = Record<string, (...args: any[]) => any>

type WorkerPoolOptions = NonNullable<Parameters<typeof workerPool.pool>[1]>

/** The workerpool options a pool must be created with, so that its threads can be tracked */
export type RenderPoolWorkerHooks = Required<Pick<WorkerPoolOptions, 'onCreateWorker' | 'onTerminateWorker'>>

interface TrackedPool {
	pool: WorkerPool
	/** The names of its threads which haven't stopped */
	runningThreads: Set<string>
}

/** A pool which had a task stall, and is no longer used */
interface AbandonedPool extends TrackedPool {
	/** How many of its threads stalled */
	stalledThreads: number
	/** Whether its stalled threads are taken to be stuck, as they didn't stop in time */
	lost: boolean
}

export interface RenderPoolEvents {
	/** The number of threads which are stuck for good changed */
	lostThreadsChanged: [lostThreads: number]
}

/**
 * The threads which draw. When a task stalls, the pool it ran in is replaced, so that everything else is drawn by
 * new threads, while the stalled thread is terminated. A thread stuck in native code can't be terminated, so is lost
 * until it returns, if it ever does.
 */
export class RenderPool<TMethods extends PoolMethods> extends EventEmitter<RenderPoolEvents> {
	readonly #logger: Logger
	readonly #createPool: (hooks: RenderPoolWorkerHooks) => WorkerPool
	readonly #timeoutsMs: Readonly<Record<keyof TMethods & string, number>>
	readonly #lostThreadGraceMs: number

	#current: TrackedPool
	readonly #abandoned = new Map<WorkerPool, AbandonedPool>()
	#poolCount = 0

	// Track recent worker terminations (timestamps in ms), used for crash-loop detection
	#workerTerminationTimestamps: number[] = []

	/** Worker terminations since startup */
	workerTerminationsTotal = 0
	/** Tasks which stalled since startup */
	stallsTotal = 0
	/** Threads which stalled and are stuck for good */
	lostThreads = 0

	/**
	 * @param createPool Create a pool, with the given hooks in its options
	 * @param timeoutsMs How long each task may run before it is taken to have stalled
	 * @param lostThreadGraceMs How long a stalled thread has to stop, before it is taken to be stuck for good
	 */
	constructor(
		logger: Logger,
		createPool: (hooks: RenderPoolWorkerHooks) => WorkerPool,
		timeoutsMs: Readonly<Record<keyof TMethods & string, number>>,
		lostThreadGraceMs: number
	) {
		super()

		this.#logger = logger
		this.#createPool = createPool
		this.#timeoutsMs = timeoutsMs
		this.#lostThreadGraceMs = lostThreadGraceMs

		this.#current = this.#createTrackedPool()
	}

	#createTrackedPool(): TrackedPool {
		const poolIndex = ++this.#poolCount
		let threadCount = 0
		const runningThreads = new Set<string>()
		// The threads are created as the pool is, before it is returned
		const created: { pool: WorkerPool | null } = { pool: null }

		const pool = this.#createPool({
			onCreateWorker: (options) => {
				// Named so that each thread's exit can be told apart
				const name = `render-${poolIndex}-${++threadCount}`
				this.#logger.info(`Render worker ${name} created`)

				const abandonedPool = created.pool && this.#abandoned.has(created.pool) ? created.pool : null
				if (abandonedPool) {
					// workerpool replaces a thread which stopped, even in a pool which is being terminated, where the new
					// one would idle forever. It is added to the pool once this returns
					setImmediate(() => {
						abandonedPool.terminate().catch(() => null)
					})
				} else {
					runningThreads.add(name)
				}

				return { workerThreadOpts: { ...options.workerThreadOpts, name } }
			},
			onTerminateWorker: (options) => {
				const name = options.workerThreadOpts?.name
				this.#logger.info(`Render worker ${name} terminated`)
				if (name && runningThreads.delete(name)) this.#updateLostThreads()
			},
		})

		created.pool = pool

		return { pool, runningThreads }
	}

	/** The stats of the pool in use */
	stats(): ReturnType<WorkerPool['stats']> {
		return this.#current.pool.stats()
	}

	/**
	 * Run a task
	 * @param attempts How many times to try, if the thread running it crashes
	 */
	async exec<TKey extends keyof TMethods & string>(
		key: TKey,
		args: Parameters<TMethods[TKey]>,
		attempts: number
	): Promise<Awaited<ReturnType<TMethods[TKey]>>> {
		const pool = this.#current.pool

		try {
			return await execWithStallTimeout<Awaited<ReturnType<TMethods[TKey]>>>(pool, key, args, this.#timeoutsMs[key])
		} catch (e: unknown) {
			if (e instanceof RenderTaskStalledError) {
				// Not retried, as it would most likely stall again
				this.stallsTotal++
				this.#abandonStalledPool(pool)
				throw e
			}

			// Queued in a pool which was replaced before it ran
			if (pool !== this.#current.pool && e instanceof Error && e.message === 'Pool terminated') {
				return this.exec(key, args, attempts)
			}

			const isTermination =
				e instanceof workerPool.TerminateError || (e instanceof Error && e.message.includes('Worker is terminated'))
			if (!isTermination) throw e

			// Count every worker termination, including the one on the final attempt where we give up and
			// rethrow below - otherwise the metric undercounts crashes on the last retry.
			this.workerTerminationsTotal++

			// if a worker crashes, the first attempt will fail, retry when that happens, but not infinitely
			if (attempts > 1) {
				// Track termination timestamps in a sliding window

				const now = Date.now()
				this.#workerTerminationTimestamps.push(now)
				const cutoff = now - WORKER_TERMINATION_WINDOW_MS

				// prune old timestamps
				this.#workerTerminationTimestamps = this.#workerTerminationTimestamps.filter((timestamp) => timestamp >= cutoff)

				if (this.#workerTerminationTimestamps.length > WORKER_TERMINATION_THRESHOLD) {
					this.#logger.error(
						`More than ${WORKER_TERMINATION_THRESHOLD} worker terminations within ${WORKER_TERMINATION_WINDOW_MS / 1000}s. Terminating.`
					)
					// Force an immediate exit, as this suggests a major problem
					// eslint-disable-next-line n/no-process-exit
					process.exit(5)
				}

				return this.exec(key, args, attempts - 1)
			} else {
				throw e
			}
		}
	}

	/**
	 * Replace a pool which had a task stall, and terminate it. Those of its stalled threads which don't stop in time
	 * are lost, until they do
	 */
	#abandonStalledPool(pool: WorkerPool): void {
		let abandoned = this.#abandoned.get(pool)
		if (!abandoned) {
			if (pool !== this.#current.pool) return // Already stopped

			const entry: AbandonedPool = { ...this.#current, stalledThreads: 0, lost: false }
			this.#abandoned.set(pool, entry)
			abandoned = entry
			this.#current = this.#createTrackedPool()

			// Lets the tasks it is running finish, and rejects the ones queued in it, which are run in the new pool
			pool.terminate().catch((e: unknown) => {
				this.#logger.warn(`Failed to terminate a stalled render pool: ${stringifyError(e)}`)
			})

			setTimeout(() => {
				if (!this.#abandoned.has(pool)) return

				entry.lost = true
				this.#updateLostThreads()
				if (this.#lostThreadsOf(entry) > 0) {
					this.#logger.error(
						`${this.#lostThreadsOf(entry)} stalled render threads didn't stop within ${this.#lostThreadGraceMs / 1000}s, so are stuck`
					)
				}
			}, this.#lostThreadGraceMs).unref()
		}

		abandoned.stalledThreads++
		this.#updateLostThreads()
	}

	/** A thread which stalled can't be told apart from the others, but those which didn't stall stop promptly */
	#lostThreadsOf(abandoned: AbandonedPool): number {
		return abandoned.lost ? Math.min(abandoned.stalledThreads, abandoned.runningThreads.size) : 0
	}

	#updateLostThreads(): void {
		let lostThreads = 0
		for (const [pool, abandoned] of this.#abandoned) {
			if (abandoned.runningThreads.size === 0) {
				this.#abandoned.delete(pool)
				if (abandoned.lost) this.#logger.info(`The stalled render threads of a replaced pool all stopped`)
				continue
			}
			lostThreads += this.#lostThreadsOf(abandoned)
		}

		if (lostThreads === this.lostThreads) return
		this.lostThreads = lostThreads
		this.emit('lostThreadsChanged', lostThreads)
	}

	/** Terminate every thread, without waiting for the stalled ones */
	async terminate(): Promise<void> {
		for (const pool of this.#abandoned.keys()) void pool.terminate(true).catch(() => null)
		await this.#current.pool.terminate(true)
	}
}

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

/** A pool which had a task stall, and is no longer used */
interface AbandonedPool {
	/** How many of its threads stalled */
	stalledThreads: number
	/** Whether its threads have all stopped */
	exited: boolean
	/** Whether its stalled threads are taken to be stuck for good, as they didn't stop in time */
	lost: boolean
}

interface RenderPoolEvents {
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
	readonly #createPool: () => WorkerPool
	readonly #timeoutsMs: Readonly<Record<keyof TMethods & string, number>>
	readonly #lostThreadGraceMs: number

	#current: WorkerPool
	readonly #abandoned = new Map<WorkerPool, AbandonedPool>()

	// Track recent worker terminations (timestamps in ms), used for crash-loop detection
	#workerTerminationTimestamps: number[] = []

	/** Worker terminations since startup */
	workerTerminationsTotal = 0
	/** Tasks which stalled since startup */
	stallsTotal = 0
	/** Threads which stalled and are stuck for good */
	lostThreads = 0

	/**
	 * @param timeoutsMs How long each task may run before it is taken to have stalled
	 * @param lostThreadGraceMs How long a stalled thread has to stop, before it is taken to be stuck for good
	 */
	constructor(
		logger: Logger,
		createPool: () => WorkerPool,
		timeoutsMs: Readonly<Record<keyof TMethods & string, number>>,
		lostThreadGraceMs: number
	) {
		super()

		this.#logger = logger
		this.#createPool = createPool
		this.#timeoutsMs = timeoutsMs
		this.#lostThreadGraceMs = lostThreadGraceMs

		this.#current = createPool()
	}

	/** The stats of the pool in use */
	stats(): ReturnType<WorkerPool['stats']> {
		return this.#current.stats()
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
		const pool = this.#current

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
			if (pool !== this.#current && e instanceof Error && e.message === 'Pool terminated') {
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
	 * Replace a pool which had a task stall, and terminate it. If its threads don't stop in time, the stalled ones
	 * are lost
	 */
	#abandonStalledPool(pool: WorkerPool): void {
		let abandoned = this.#abandoned.get(pool)
		if (!abandoned) {
			if (pool === this.#current) this.#current = this.#createPool()

			const entry: AbandonedPool = { stalledThreads: 0, exited: false, lost: false }
			this.#abandoned.set(pool, entry)
			abandoned = entry

			// Lets the tasks it is running finish, and rejects the ones queued in it, which are run in the new pool
			pool.terminate().then(
				() => {
					entry.exited = true
					this.#abandoned.delete(pool)

					if (entry.lost) {
						this.#logger.info(`${entry.stalledThreads} stalled render threads stopped after all`)
						this.#setLostThreads(this.lostThreads - entry.stalledThreads)
					}
				},
				(e: unknown) => {
					this.#logger.warn(`Failed to terminate a stalled render pool: ${stringifyError(e)}`)
				}
			)

			setTimeout(() => {
				if (entry.exited) return

				entry.lost = true
				this.#logger.error(
					`${entry.stalledThreads} stalled render threads didn't stop within ${this.#lostThreadGraceMs / 1000}s, so are stuck`
				)
				this.#setLostThreads(this.lostThreads + entry.stalledThreads)
			}, this.#lostThreadGraceMs).unref()
		}

		abandoned.stalledThreads++
		// Another task which was running in it stalled after its threads were taken to be stuck
		if (abandoned.lost) this.#setLostThreads(this.lostThreads + 1)
	}

	#setLostThreads(lostThreads: number): void {
		this.lostThreads = lostThreads
		this.emit('lostThreadsChanged', lostThreads)
	}

	/** Terminate every thread, without waiting for the stalled ones */
	async terminate(): Promise<void> {
		for (const pool of this.#abandoned.keys()) void pool.terminate(true).catch(() => null)
		await this.#current.terminate(true)
	}
}

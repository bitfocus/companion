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
import z from 'zod'
import type { RenderStallRestart, RenderStallStatus } from '@companion-app/shared/Model/RenderStall.js'
import type { DataCacheDefaultTable } from '../Data/Cache.js'
import type { DataStoreTableView } from '../Data/Tables/TableView.js'
import LogController from '../Log/Controller.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'
import type { RenderPoolEvents } from './RenderPool.js'
import type { RenderQuarantine } from './RenderQuarantine.js'

/** How long until a restart, so that it can be seen coming, and postponed */
export const RESTART_DELAY_MS = 60_000
/** How long until trying again, when a restart couldn't happen yet, eg as Companion is still starting */
export const RESTART_RETRY_MS = 10_000
/** How long postponing a restart puts it off for */
export const RESTART_POSTPONE_MS = 10 * 60_000
/** Restarting this many times within the window means restarting isn't helping, so it is left to the user */
export const RESTART_LOOP_LIMIT = 2
export const RESTART_LOOP_WINDOW_MS = 10 * 60_000

/** The threads which are stuck for good */
export interface LostRenderThreads extends EventEmitter<RenderPoolEvents> {
	readonly lostThreads: number
}

/** When Companion restarted itself to free stuck render threads, kept across the restarts */
export interface RenderStallRestartHistory {
	load(): number[]
	save(times: number[]): void
}

export class CachedRenderStallRestartHistory implements RenderStallRestartHistory {
	readonly #table: Pick<DataStoreTableView<DataCacheDefaultTable>, 'get' | 'set'>

	constructor(table: Pick<DataStoreTableView<DataCacheDefaultTable>, 'get' | 'set'>) {
		this.#table = table
	}

	load(): number[] {
		const times = this.#table.get('render_stall_restarts')
		return Array.isArray(times) ? times.filter((time) => typeof time === 'number') : []
	}

	save(times: number[]): void {
		this.#table.set('render_stall_restarts', times)
	}
}

interface RenderStallMonitorEvents {
	status: [status: RenderStallStatus]
}

/**
 * Watches for draws which stalled, for the ui to warn about, and restarts Companion once so many render threads are
 * stuck for good that drawing would slow to a halt. The stalled draws are quarantined across the restart, so it
 * doesn't stall on them again, and if it keeps having to restart anyway, that is left to the user.
 */
export class RenderStallMonitor {
	readonly #logger = LogController.createLogger('Graphics/RenderStallMonitor')
	readonly #events = new EventEmitter<RenderStallMonitorEvents>()

	readonly #quarantine: RenderQuarantine
	readonly #lostThreads: LostRenderThreads | null
	readonly #lostThreadBudget: number
	readonly #restartHistory: RenderStallRestartHistory
	readonly #requestRestart: () => boolean

	#restart: RenderStallRestart | null = null
	#restartTimer: NodeJS.Timeout | null = null

	/**
	 * @param lostThreads Null when rendering isn't threaded
	 * @param lostThreadBudget How many threads may be stuck for good, before restarting
	 * @param requestRestart Returns whether the restart will happen
	 */
	constructor(
		quarantine: RenderQuarantine,
		lostThreads: LostRenderThreads | null,
		lostThreadBudget: number,
		restartHistory: RenderStallRestartHistory,
		requestRestart: () => boolean
	) {
		this.#quarantine = quarantine
		this.#lostThreads = lostThreads
		this.#lostThreadBudget = lostThreadBudget
		this.#restartHistory = restartHistory
		this.#requestRestart = requestRestart

		quarantine.on('changed', this.#emitStatus)
		lostThreads?.on('lostThreadsChanged', this.#updateRestart)
	}

	get status(): RenderStallStatus {
		return {
			quarantined: this.#quarantine.list(),
			lostThreads: this.#lostThreads?.lostThreads ?? 0,
			restart: this.#restart,
		}
	}

	#emitStatus = (): void => {
		this.#events.emit('status', this.status)
	}

	#updateRestart = (): void => {
		const lostThreads = this.#lostThreads?.lostThreads ?? 0
		if (lostThreads < this.#lostThreadBudget) {
			// Enough of them stopped after all
			if (this.#restart) this.#logger.info('Stuck render threads stopped, so a restart is no longer needed')
			this.#setRestart(null)
		} else if (!this.#restart) {
			const cutoff = Date.now() - RESTART_LOOP_WINDOW_MS
			const recentRestarts = this.#restartHistory.load().filter((time) => time >= cutoff)
			if (recentRestarts.length >= RESTART_LOOP_LIMIT) {
				this.#logger.error(
					`${lostThreads} render threads are stuck, but Companion has restarted for this ${recentRestarts.length} times recently, so it is left to the user`
				)
				this.#setRestart({ type: 'manual' })
			} else {
				this.#logger.error(
					`${lostThreads} render threads are stuck, so Companion will restart in ${RESTART_DELAY_MS / 1000}s`
				)
				this.#setRestart({ type: 'scheduled', at: Date.now() + RESTART_DELAY_MS })
			}
		}

		this.#emitStatus()
	}

	#setRestart(restart: RenderStallRestart | null): void {
		this.#restart = restart

		if (this.#restartTimer) clearTimeout(this.#restartTimer)
		this.#restartTimer = null

		if (restart?.type === 'scheduled') {
			this.#restartTimer = setTimeout(() => {
				this.#restartTimer = null
				this.#logger.warn('Restarting, to free the stuck render threads')

				if (!this.#requestRestart()) {
					this.#logger.warn(`Couldn't restart yet, so trying again in ${RESTART_RETRY_MS / 1000}s`)
					this.#setRestart({ type: 'scheduled', at: Date.now() + RESTART_RETRY_MS })
					this.#emitStatus()
					return
				}

				const cutoff = Date.now() - RESTART_LOOP_WINDOW_MS
				this.#restartHistory.save([...this.#restartHistory.load().filter((time) => time >= cutoff), Date.now()])
			}, restart.at - Date.now())
		}
	}

	/** Put off a scheduled restart */
	postponeRestart(): void {
		if (this.#restart?.type !== 'scheduled') return

		this.#logger.info(`Restart postponed by ${RESTART_POSTPONE_MS / 60_000} minutes`)
		this.#setRestart({ type: 'scheduled', at: Date.now() + RESTART_POSTPONE_MS })
		this.#emitStatus()
	}

	/** Restart now, as the user asked to */
	restartNow(): void {
		if (!this.#requestRestart()) return

		this.#setRestart(null)
	}

	destroy(): void {
		this.#setRestart(null)
		this.#quarantine.off('changed', this.#emitStatus)
		this.#lostThreads?.off('lostThreadsChanged', this.#updateRestart)
	}

	createTrpcRouter() {
		const self = this
		return router({
			status: publicProcedure.subscription(async function* (opts) {
				const changes = toIterable(self.#events, 'status', opts.signal)

				yield self.status

				for await (const [status] of changes) {
					yield status
				}
			}),

			retry: publicProcedure.input(z.object({ key: z.string() })).mutation(({ input }) => {
				return this.#quarantine.remove(input.key)
			}),

			postponeRestart: publicProcedure.mutation(() => {
				this.postponeRestart()
			}),

			restartNow: publicProcedure.mutation(() => {
				this.restartNow()
			}),
		})
	}
}

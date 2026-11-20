import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { QuarantinedRender } from '@companion-app/shared/Model/RenderStall.js'
import type { RenderPoolEvents } from '../../lib/Graphics/RenderPool.js'
import { RenderQuarantine } from '../../lib/Graphics/RenderQuarantine.js'
import {
	RenderStallMonitor,
	RESTART_DELAY_MS,
	RESTART_LOOP_WINDOW_MS,
	RESTART_POSTPONE_MS,
	type LostRenderThreads,
	type RenderStallRestartHistory,
} from '../../lib/Graphics/RenderStallMonitor.js'

vi.mock('../../lib/Log/Controller.js', () => ({
	default: { createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
}))

const NOW = 1_000_000_000

class FakeLostThreads extends EventEmitter<RenderPoolEvents> implements LostRenderThreads {
	lostThreads = 0

	set(lostThreads: number): void {
		this.lostThreads = lostThreads
		this.emit('lostThreadsChanged', lostThreads)
	}
}

function makeHistory(initial: number[]): RenderStallRestartHistory & { times: number[] } {
	const history = {
		times: initial,
		load: () => history.times,
		save: (times: number[]) => {
			history.times = times
		},
	}
	return history
}

describe('RenderStallMonitor', () => {
	let quarantine: RenderQuarantine
	let lostThreads: FakeLostThreads
	let requestRestart: ReturnType<typeof vi.fn<() => void>>

	function makeMonitor(history: RenderStallRestartHistory): RenderStallMonitor {
		return new RenderStallMonitor(quarantine, lostThreads, 4, history, requestRestart)
	}

	beforeEach(() => {
		vi.useFakeTimers({ now: NOW })
		quarantine = new RenderQuarantine({ load: () => [], save: () => undefined })
		lostThreads = new FakeLostThreads()
		requestRestart = vi.fn<() => void>()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	test("doesn't restart while fewer threads than the budget are stuck", () => {
		const monitor = makeMonitor(makeHistory([]))

		lostThreads.set(3)
		vi.advanceTimersByTime(RESTART_DELAY_MS * 10)

		expect(monitor.status.restart).toBeNull()
		expect(monitor.status.lostThreads).toBe(3)
		expect(requestRestart).not.toHaveBeenCalled()
	})

	test('restarts a while after the budget of stuck threads is used up, and records it', () => {
		const history = makeHistory([])
		const monitor = makeMonitor(history)

		lostThreads.set(4)
		expect(monitor.status.restart).toEqual({ type: 'scheduled', at: NOW + RESTART_DELAY_MS })

		vi.advanceTimersByTime(RESTART_DELAY_MS - 1)
		expect(requestRestart).not.toHaveBeenCalled()

		vi.advanceTimersByTime(1)
		expect(requestRestart).toHaveBeenCalledTimes(1)
		expect(history.times).toEqual([NOW + RESTART_DELAY_MS])
	})

	test("doesn't restart if the stuck threads stop after all", () => {
		const monitor = makeMonitor(makeHistory([]))

		lostThreads.set(4)
		lostThreads.set(2)
		vi.advanceTimersByTime(RESTART_DELAY_MS)

		expect(monitor.status.restart).toBeNull()
		expect(requestRestart).not.toHaveBeenCalled()
	})

	test('postpones a restart', () => {
		const monitor = makeMonitor(makeHistory([]))
		lostThreads.set(4)

		vi.advanceTimersByTime(RESTART_DELAY_MS / 2)
		monitor.postponeRestart()

		expect(monitor.status.restart).toEqual({
			type: 'scheduled',
			at: NOW + RESTART_DELAY_MS / 2 + RESTART_POSTPONE_MS,
		})
		vi.advanceTimersByTime(RESTART_POSTPONE_MS - 1)
		expect(requestRestart).not.toHaveBeenCalled()
		vi.advanceTimersByTime(1)
		expect(requestRestart).toHaveBeenCalledTimes(1)
	})

	test('leaves the restart to the user after restarting too often recently', () => {
		const monitor = makeMonitor(makeHistory([NOW - 60_000, NOW - 120_000]))

		lostThreads.set(4)
		vi.advanceTimersByTime(RESTART_POSTPONE_MS * 10)

		expect(monitor.status.restart).toEqual({ type: 'manual' })
		expect(requestRestart).not.toHaveBeenCalled()
	})

	test('only counts the recent restarts', () => {
		const monitor = makeMonitor(makeHistory([NOW - RESTART_LOOP_WINDOW_MS - 1, NOW - 60_000]))

		lostThreads.set(4)

		expect(monitor.status.restart).toEqual({ type: 'scheduled', at: NOW + RESTART_DELAY_MS })
	})

	test('restarts now when asked to, without recording it', () => {
		const history = makeHistory([])
		const monitor = makeMonitor(history)
		lostThreads.set(4)

		monitor.restartNow()
		vi.advanceTimersByTime(RESTART_DELAY_MS)

		expect(requestRestart).toHaveBeenCalledTimes(1)
		expect(history.times).toEqual([])
	})

	test('reports what is quarantined', () => {
		const monitor = makeMonitor(makeHistory([]))
		const entry: QuarantinedRender = { key: 'a', location: null, description: 'preview', texts: [], time: NOW }

		quarantine.add(entry)

		expect(monitor.status.quarantined).toEqual([entry])
	})
})

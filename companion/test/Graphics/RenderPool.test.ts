import path from 'node:path'
import { afterEach, describe, expect, test, vi } from 'vitest'
import workerPool from 'workerpool'
import { RenderPool } from '../../lib/Graphics/RenderPool.js'
import { RenderTaskStalledError } from '../../lib/Graphics/RenderTaskTimeout.js'

const THREAD_PATH = path.join(import.meta.dirname, 'helpers/StallingThread.mjs')

type Methods = {
	stall: () => void
	nativeStall: (ms: number) => void
	add: (a: number, b: number) => number
}

const logger: any = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }

describe('RenderPool', () => {
	let pool: RenderPool<Methods> | undefined
	let createdPools = 0

	function makePool(lostThreadGraceMs: number): RenderPool<Methods> {
		createdPools = 0
		pool = new RenderPool<Methods>(
			logger,
			() => {
				createdPools++
				// One thread, so that a task can only run once the stalled one is out of the way
				return workerPool.pool(THREAD_PATH, {
					minWorkers: 1,
					maxWorkers: 1,
					workerType: 'thread',
					workerTerminateTimeout: 100,
				})
			},
			{ stall: 200, nativeStall: 200, add: 5000 },
			lostThreadGraceMs
		)
		return pool
	}

	afterEach(async () => {
		await pool?.terminate()
		pool = undefined
	})

	test('runs tasks', async () => {
		const pool = makePool(1000)

		await expect(pool.exec('add', [1, 2], 1)).resolves.toBe(3)
		expect(createdPools).toBe(1)
	})

	test('replaces the pool when a task stalls, and runs what was queued behind it in the new one', async () => {
		const pool = makePool(1000)

		const stalled = pool.exec('stall', [], 1)
		const queued = pool.exec('add', [2, 3], 1)

		await expect(stalled).rejects.toBeInstanceOf(RenderTaskStalledError)
		await expect(queued).resolves.toBe(5)
		await expect(pool.exec('add', [1, 1], 1)).resolves.toBe(2)

		expect(createdPools).toBe(2)
		expect(pool.stallsTotal).toBe(1)
	})

	test("doesn't count a stalled thread which stops as lost", async () => {
		const pool = makePool(1000)

		await expect(pool.exec('stall', [], 1)).rejects.toBeInstanceOf(RenderTaskStalledError)
		await new Promise((resolve) => setTimeout(resolve, 1500))

		expect(pool.lostThreads).toBe(0)
	})

	test('counts a stalled thread which is stuck in native code as lost, until it returns', async () => {
		const pool = makePool(500)
		const lostThreadsChanged = vi.fn()
		pool.on('lostThreadsChanged', lostThreadsChanged)

		await expect(pool.exec('nativeStall', [3000], 1)).rejects.toBeInstanceOf(RenderTaskStalledError)
		// Drawing carries on in the new pool meanwhile
		await expect(pool.exec('add', [1, 2], 1)).resolves.toBe(3)

		await vi.waitFor(() => expect(pool.lostThreads).toBe(1), { timeout: 2000 })
		await vi.waitFor(() => expect(pool.lostThreads).toBe(0), { timeout: 5000 })

		expect(lostThreadsChanged.mock.calls).toEqual([[1], [0]])
	})
})

import path from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import workerPool from 'workerpool'
import {
	execWithStallTimeout,
	RenderTaskStalledError,
	stringifyDrawStyleForLog,
} from '../../lib/Graphics/RenderTaskTimeout.js'

const THREAD_PATH = path.join(import.meta.dirname, 'helpers/StallingThread.mjs')

describe('execWithStallTimeout', () => {
	let pool: ReturnType<typeof workerPool.pool> | undefined

	afterEach(async () => {
		await pool?.terminate(true)
		pool = undefined
	})

	test('resolves with the result of a task', async () => {
		pool = workerPool.pool(THREAD_PATH, { minWorkers: 1, maxWorkers: 1, workerType: 'thread' })

		await expect(execWithStallTimeout(pool, 'add', [1, 2], 1000)).resolves.toBe(3)
	})

	test('rejects a stalled task, and replaces its thread', async () => {
		pool = workerPool.pool(THREAD_PATH, {
			minWorkers: 1,
			maxWorkers: 1,
			workerType: 'thread',
			workerTerminateTimeout: 100,
		})

		await expect(execWithStallTimeout(pool, 'stall', [], 200)).rejects.toBeInstanceOf(RenderTaskStalledError)

		// With only one thread, this can only run once the stalled one has been replaced
		await expect(execWithStallTimeout(pool, 'add', [2, 3], 5000)).resolves.toBe(5)
	})

	test("doesn't count time waiting for a free thread", async () => {
		pool = workerPool.pool(THREAD_PATH, {
			minWorkers: 1,
			maxWorkers: 1,
			workerType: 'thread',
			workerTerminateTimeout: 100,
		})

		const stalled = execWithStallTimeout(pool, 'stall', [], 300)
		// Queued behind the stalled task for longer than its own timeout
		const queued = execWithStallTimeout(pool, 'add', [1, 1], 200)

		await expect(stalled).rejects.toBeInstanceOf(RenderTaskStalledError)
		await expect(queued).resolves.toBe(2)
	})
})

describe('stringifyDrawStyleForLog', () => {
	test('keeps text, and leaves out images and binary data', () => {
		const image = `data:image/png;base64,${'A'.repeat(5000)}`
		const result = JSON.parse(
			stringifyDrawStyleForLog({
				elements: [
					{ type: 'text', text: 'Hello 👋' },
					{ type: 'image', base64Image: image },
				],
				buffer: new Uint8Array(64),
				map: new Map([['a', 1]]),
				set: new Set(['b']),
			})
		)

		expect(result).toEqual({
			elements: [
				{ type: 'text', text: 'Hello 👋' },
				{ type: 'image', base64Image: `<${image.length} chars: ${image.slice(0, 40)}…>` },
			],
			buffer: '<64 bytes>',
			map: { a: 1 },
			set: ['b'],
		})
	})
})

import { describe, expect, test, vi } from 'vitest'
import type { Logger } from '../../lib/Log/Controller.js'
import { ImageWriteQueue } from '../../lib/Resources/ImageWriteQueue.js'

const logger = { silly: vi.fn() } as unknown as Logger

describe('ImageWriteQueue', () => {
	test('a key queued again while waiting is written once, with the newest arguments', async () => {
		const written: [string, number][] = []
		let release!: () => void
		const blocked = new Promise<void>((resolve) => (release = resolve))
		const queue = new ImageWriteQueue<string, [number]>(
			logger,
			async (key, value) => {
				written.push([key, value])
				if (key === 'busy') await blocked
			},
			0
		)

		// One at a time, so that the rest wait
		queue.queue('busy', 1)
		queue.queue('a', 1)
		queue.queue('b', 1)
		queue.queue('a', 2)
		queue.queue('a', 3)
		expect(queue.pending).toBe(2)

		release()
		await vi.waitFor(() =>
			expect(written).toEqual([
				['busy', 1],
				['a', 3],
				['b', 1],
			])
		)
	})

	test('a key queued again once it has started is written again', async () => {
		const written: number[] = []
		const queue = new ImageWriteQueue<string, [number]>(logger, async (_key, value) => {
			written.push(value)
		})

		queue.queue('a', 1)
		await vi.waitFor(() => expect(written).toEqual([1]))
		queue.queue('a', 2)
		await vi.waitFor(() => expect(written).toEqual([1, 2]))
	})
})

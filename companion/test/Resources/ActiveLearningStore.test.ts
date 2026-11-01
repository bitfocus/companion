import { initTRPC } from '@trpc/server'
import { describe, expect, test } from 'vitest'
import { ActiveLearningStore } from '../../lib/Resources/ActiveLearningStore.js'
import type { TrpcContext } from '../../lib/UI/TRPC.js'
import { createMockTrpcContext } from '../Util.js'

const t = initTRPC.context<TrpcContext>().create()

function createStore() {
	const store = new ActiveLearningStore()
	const caller = t.createCallerFactory(store.createTrpcRouter())(createMockTrpcContext())
	return { store, caller }
}

describe('ActiveLearningStore', () => {
	test('runs the callback with an unaborted signal', async () => {
		const { store } = createStore()

		let received: AbortSignal | undefined
		await store.runLearnRequest('a', async (signal) => {
			received = signal
		})

		expect(received).toBeInstanceOf(AbortSignal)
		expect(received?.aborted).toBe(false)
	})

	test('rejects a second learn for the same id while one is running', async () => {
		const { store } = createStore()
		const pending = Promise.withResolvers<void>()

		const first = store.runLearnRequest('a', async () => pending.promise)
		await expect(store.runLearnRequest('a', async () => {})).rejects.toThrow('Learn is already running')

		pending.resolve()
		await first
		// Once finished, the id can learn again
		await expect(store.runLearnRequest('a', async () => {})).resolves.toBeUndefined()
	})

	test('releases the id when the callback throws', async () => {
		const { store } = createStore()

		await expect(
			store.runLearnRequest('a', async () => {
				throw new Error('boom')
			})
		).rejects.toThrow('boom')
		await expect(store.runLearnRequest('a', async () => {})).resolves.toBeUndefined()
	})

	test('abort aborts the signal of the running learn', async () => {
		const { store, caller } = createStore()

		const aborted = Promise.withResolvers<void>()
		const run = store.runLearnRequest('a', async (signal) => {
			signal.addEventListener('abort', () => aborted.resolve(), { once: true })
			await aborted.promise
		})

		await caller.abort({ id: 'a' })
		await run
		await expect(aborted.promise).resolves.toBeUndefined()
	})

	test('abort only affects the matching learn', async () => {
		const { store, caller } = createStore()

		let signalA: AbortSignal | undefined
		let signalB: AbortSignal | undefined
		const pending = Promise.withResolvers<void>()
		const runA = store.runLearnRequest('a', async (signal) => {
			signalA = signal
			await pending.promise
		})
		const runB = store.runLearnRequest('b', async (signal) => {
			signalB = signal
			await pending.promise
		})

		await caller.abort({ id: 'b' })
		expect(signalA?.aborted).toBe(false)
		expect(signalB?.aborted).toBe(true)

		pending.resolve()
		await Promise.all([runA, runB])
	})

	test('abort for an id that is not learning is a no-op', async () => {
		const { caller } = createStore()

		await expect(caller.abort({ id: 'nope' })).resolves.toBeUndefined()
	})

	test('a finished learn is not aborted by a later abort', async () => {
		const { store, caller } = createStore()

		let received: AbortSignal | undefined
		await store.runLearnRequest('a', async (signal) => {
			received = signal
		})
		await caller.abort({ id: 'a' })

		expect(received?.aborted).toBe(false)
	})
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IpcWrapper, type IpcEventHandlers } from '../../../lib/Instance/Common/IpcWrapper.js'

/**
 * The API "exposed" by the receiving side of the wrapper. Methods that return a value model
 * request/response calls (sendWithCb); methods that return `never` model fire-and-forget
 * messages (sendWithNoCb).
 */
interface TestApi {
	add: (msg: { a: number; b: number }) => number
	echo: (msg: string) => string
	slow: (msg: void) => string
	throwsError: (msg: void) => string
	throwsString: (msg: void) => string
	throwsWithProps: (msg: void) => string
	notify: (msg: string) => never
}

/** An API with no methods, for the side of a pair that only ever sends. */
type EmptyApi = Record<never, never>

function makeHandlers(overrides: Partial<IpcEventHandlers<TestApi>> = {}): IpcEventHandlers<TestApi> {
	return {
		add: async (data) => data.a + data.b,
		echo: async (data) => data,
		slow: async (_data, _signal) => new Promise<string>(() => {}), // never resolves
		throwsError: async () => {
			throw new Error('boom')
		},
		throwsString: async () => {
			// eslint-disable-next-line @typescript-eslint/only-throw-error
			throw 'just a string'
		},
		throwsWithProps: async () => {
			const err = new Error('with props') as Error & { code: string }
			err.code = 'E_CUSTOM'
			throw err
		},
		notify: async () => {},
		...overrides,
	}
}

function createWrapper(handlers: IpcEventHandlers<TestApi> = makeHandlers(), timeout = 1000) {
	const sendMessage = vi.fn<(msg: any) => void>()
	const wrapper = new IpcWrapper<TestApi, TestApi>(handlers, sendMessage, timeout)
	return { wrapper, sendMessage }
}

/** Wire two wrappers together so messages from one are delivered to the other. */
function createPair(handlersB: IpcEventHandlers<TestApi> = makeHandlers(), timeout = 1000) {
	let wrapperB: IpcWrapper<EmptyApi, TestApi>
	const wrapperA = new IpcWrapper<TestApi, EmptyApi>({}, (msg) => wrapperB.receivedMessage(msg), timeout)
	wrapperB = new IpcWrapper<EmptyApi, TestApi>(handlersB, (msg) => wrapperA.receivedMessage(msg), timeout)
	return { wrapperA, wrapperB }
}

/** Flush pending microtasks/macrotasks so async handlers can settle (real timers only). */
const tick = () => new Promise<void>((resolve) => setImmediate(resolve))

describe('IpcWrapper', () => {
	describe('sendWithCb', () => {
		it('sends a call packet with an incrementing callbackId', () => {
			const { wrapper, sendMessage } = createWrapper()

			void wrapper.sendWithCb('add', { a: 1, b: 2 })
			void wrapper.sendWithCb('echo', 'hello')

			expect(sendMessage).toHaveBeenNthCalledWith(1, {
				direction: 'call',
				name: 'add',
				payload: { a: 1, b: 2 },
				callbackId: 1,
			})
			expect(sendMessage).toHaveBeenNthCalledWith(2, {
				direction: 'call',
				name: 'echo',
				payload: 'hello',
				callbackId: 2,
			})
		})

		it('resolves when a matching success response arrives', async () => {
			const { wrapper } = createWrapper()

			const promise = wrapper.sendWithCb('add', { a: 2, b: 3 })
			wrapper.receivedMessage({ direction: 'response', callbackId: 1, success: true, payload: 5 })

			await expect(promise).resolves.toBe(5)
		})

		it('rejects with a reconstructed Error when a failure response arrives', async () => {
			const { wrapper } = createWrapper()

			const promise = wrapper.sendWithCb('add', { a: 2, b: 3 })
			wrapper.receivedMessage({
				direction: 'response',
				callbackId: 1,
				success: false,
				payload: { name: 'RangeError', message: 'out of range', stack: 'RangeError: out of range\n    at remote' },
			})

			const err = await promise.catch((e) => e)
			expect(err).toBeInstanceOf(Error)
			expect(err.name).toBe('RangeError')
			expect(err.message).toBe('out of range')
			// The host call site is stitched onto the remote stack
			expect(err.stack).toContain('--- via IPC call ---')
		})

		it('ignores a response for an unknown callbackId', () => {
			const { wrapper } = createWrapper()

			expect(() =>
				wrapper.receivedMessage({ direction: 'response', callbackId: 999, success: true, payload: 1 })
			).not.toThrow()
		})
	})

	describe('sendWithCb timeouts', () => {
		beforeEach(() => vi.useFakeTimers())
		afterEach(() => vi.useRealTimers())

		it('rejects with a timeout error and sends a cancel', async () => {
			const { wrapper, sendMessage } = createWrapper(makeHandlers(), 500)

			const promise = wrapper.sendWithCb('add', { a: 1, b: 2 })
			promise.catch(() => {}) // avoid unhandled rejection warning

			await vi.advanceTimersByTimeAsync(500)

			await expect(promise).rejects.toThrow('Call timed out')
			expect(sendMessage).toHaveBeenCalledWith({ direction: 'cancel', callbackId: 1 })
		})

		it('uses the defaultResponse error when provided', async () => {
			const { wrapper } = createWrapper(makeHandlers(), 500)

			const promise = wrapper.sendWithCb('add', { a: 1, b: 2 }, () => new Error('custom default'))
			promise.catch(() => {})

			await vi.advanceTimersByTimeAsync(500)

			await expect(promise).rejects.toThrow('custom default')
		})

		it('falls back to the default timeout when timeout is <= 0', async () => {
			const { wrapper } = createWrapper(makeHandlers(), 500)

			const promise = wrapper.sendWithCb('add', { a: 1, b: 2 }, undefined, 0)
			promise.catch(() => {})

			await vi.advanceTimersByTimeAsync(499)
			// not yet rejected
			await vi.advanceTimersByTimeAsync(1)
			await expect(promise).rejects.toThrow('Call timed out')
		})

		it('clears the timeout once a response is received', async () => {
			const { wrapper } = createWrapper(makeHandlers(), 500)

			const promise = wrapper.sendWithCb('add', { a: 1, b: 2 })
			wrapper.receivedMessage({ direction: 'response', callbackId: 1, success: true, payload: 3 })
			await expect(promise).resolves.toBe(3)

			// Advancing past the timeout must not produce a second (rejecting) settlement.
			// A double-settle attempt would surface as an unhandled rejection here.
			const onReject = vi.fn()
			promise.catch(onReject)
			await vi.advanceTimersByTimeAsync(1000)
			expect(onReject).not.toHaveBeenCalled()
		})
	})

	describe('sendWithCb abort handling', () => {
		it('rejects immediately and sends nothing if the signal is already aborted', async () => {
			const { wrapper, sendMessage } = createWrapper()

			const controller = new AbortController()
			controller.abort(new Error('pre-aborted'))

			await expect(wrapper.sendWithCb('add', { a: 1, b: 2 }, undefined, 0, controller.signal)).rejects.toThrow(
				'pre-aborted'
			)
			expect(sendMessage).not.toHaveBeenCalled()
		})

		it('rejects with the abort reason and sends a cancel when aborted in-flight', async () => {
			const { wrapper, sendMessage } = createWrapper()

			const controller = new AbortController()
			const promise = wrapper.sendWithCb('add', { a: 1, b: 2 }, undefined, 0, controller.signal)
			promise.catch(() => {})

			controller.abort(new Error('aborted in-flight'))

			await expect(promise).rejects.toThrow('aborted in-flight')
			expect(sendMessage).toHaveBeenCalledWith({ direction: 'cancel', callbackId: 1 })
		})
	})

	describe('sendWithNoCb', () => {
		it('sends a call packet without a callbackId', () => {
			const { wrapper, sendMessage } = createWrapper()

			wrapper.sendWithNoCb('notify', 'hi')

			expect(sendMessage).toHaveBeenCalledWith({
				direction: 'call',
				name: 'notify',
				payload: 'hi',
				callbackId: undefined,
			})
		})
	})

	describe('receivedMessage - inbound calls', () => {
		it('responds with the handler result on success', async () => {
			const { wrapper, sendMessage } = createWrapper()

			wrapper.receivedMessage({ direction: 'call', name: 'add', payload: { a: 2, b: 3 }, callbackId: 11 })
			await tick()

			expect(sendMessage).toHaveBeenCalledWith({ direction: 'response', callbackId: 11, success: true, payload: 5 })
		})

		it('responds with an error when the handler rejects, preserving custom properties', async () => {
			const { wrapper, sendMessage } = createWrapper()

			wrapper.receivedMessage({ direction: 'call', name: 'throwsWithProps', payload: undefined, callbackId: 12 })
			await tick()

			expect(sendMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					direction: 'response',
					callbackId: 12,
					success: false,
					payload: expect.objectContaining({ name: 'Error', message: 'with props', code: 'E_CUSTOM' }),
				})
			)
		})

		it('passes a thrown non-Error value through untouched', async () => {
			const { wrapper, sendMessage } = createWrapper()

			wrapper.receivedMessage({ direction: 'call', name: 'throwsString', payload: undefined, callbackId: 13 })
			await tick()

			expect(sendMessage).toHaveBeenCalledWith({
				direction: 'response',
				callbackId: 13,
				success: false,
				payload: 'just a string',
			})
		})

		it('responds with an error for an unknown command (when a callbackId is present)', () => {
			const { wrapper, sendMessage } = createWrapper()

			wrapper.receivedMessage({ direction: 'call', name: 'doesNotExist', payload: undefined, callbackId: 7 })

			expect(sendMessage).toHaveBeenCalledWith({
				direction: 'response',
				callbackId: 7,
				success: false,
				payload: { message: 'Unknown command "doesNotExist"' },
			})
		})

		it('stays silent for an unknown command with no callbackId', () => {
			const { wrapper, sendMessage } = createWrapper()

			wrapper.receivedMessage({ direction: 'call', name: 'doesNotExist', payload: undefined, callbackId: undefined })

			expect(sendMessage).not.toHaveBeenCalled()
		})

		it('does not respond when the call has no callbackId', async () => {
			const { wrapper, sendMessage } = createWrapper()

			wrapper.receivedMessage({ direction: 'call', name: 'add', payload: { a: 1, b: 1 }, callbackId: undefined })
			await tick()

			expect(sendMessage).not.toHaveBeenCalled()
		})

		it('passes the handler an abort signal that fires on cancel, and suppresses the late result', async () => {
			let capturedSignal: AbortSignal | undefined
			const deferred = Promise.withResolvers<string>()
			const { wrapper, sendMessage } = createWrapper(
				makeHandlers({
					slow: async (_data, signal) => {
						capturedSignal = signal
						return deferred.promise
					},
				})
			)

			wrapper.receivedMessage({ direction: 'call', name: 'slow', payload: undefined, callbackId: 20 })
			expect(capturedSignal?.aborted).toBe(false)

			wrapper.receivedMessage({ direction: 'cancel', callbackId: 20 })
			expect(capturedSignal?.aborted).toBe(true)

			// The handler resolving after cancellation must not produce a response
			deferred.resolve('too late')
			await tick()
			expect(sendMessage).not.toHaveBeenCalled()
		})

		it('ignores a cancel for an unknown callbackId', () => {
			const { wrapper } = createWrapper()

			expect(() => wrapper.receivedMessage({ direction: 'cancel', callbackId: 404 })).not.toThrow()
		})
	})

	describe('receivedMessage - malformed responses', () => {
		it('logs an error for a response without a callbackId', () => {
			const { wrapper } = createWrapper()
			const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

			wrapper.receivedMessage({ direction: 'response', callbackId: 0, success: true, payload: 1 })

			expect(consoleError).toHaveBeenCalled()
			consoleError.mockRestore()
		})
	})

	describe('replaceHandlers', () => {
		it('uses the replacement handler table for subsequent calls', async () => {
			const { wrapper, sendMessage } = createWrapper(makeHandlers({ add: async () => -1 }))

			wrapper.replaceHandlers(makeHandlers({ add: async (data) => data.a + data.b }))
			wrapper.receivedMessage({ direction: 'call', name: 'add', payload: { a: 4, b: 5 }, callbackId: 1 })
			await tick()

			expect(sendMessage).toHaveBeenCalledWith({ direction: 'response', callbackId: 1, success: true, payload: 9 })
		})
	})

	describe('end-to-end round trips', () => {
		it('resolves a request with the remote handler result', async () => {
			const { wrapperA } = createPair()

			await expect(wrapperA.sendWithCb('add', { a: 10, b: 5 })).resolves.toBe(15)
		})

		it('propagates a remote error with name, message and stitched stack', async () => {
			const { wrapperA } = createPair(
				makeHandlers({
					throwsError: async () => {
						const err = new Error('remote failure')
						err.name = 'CustomError'
						throw err
					},
				})
			)

			const err = await wrapperA.sendWithCb('throwsError').catch((e) => e)
			expect(err).toBeInstanceOf(Error)
			expect(err.name).toBe('CustomError')
			expect(err.message).toBe('remote failure')
			expect(err.stack).toContain('--- via IPC call ---')
		})

		it('delivers a fire-and-forget message to the remote handler', async () => {
			const received: string[] = []
			const { wrapperA } = createPair(
				makeHandlers({
					notify: async (msg) => {
						received.push(msg)
					},
				})
			)

			wrapperA.sendWithNoCb('notify', 'ping')
			await tick()

			expect(received).toEqual(['ping'])
		})

		it('aborts the remote handler when the caller aborts', async () => {
			const remoteSignals: AbortSignal[] = []
			const { wrapperA } = createPair(
				makeHandlers({
					slow: async (_data, signal) => {
						remoteSignals.push(signal)
						return new Promise<string>(() => {}) // never resolves
					},
				})
			)

			const controller = new AbortController()
			const promise = wrapperA.sendWithCb('slow', undefined, undefined, 0, controller.signal)
			promise.catch(() => {})
			await tick()

			controller.abort(new Error('caller aborted'))
			await tick()

			await expect(promise).rejects.toThrow('caller aborted')
			expect(remoteSignals).toHaveLength(1)
			expect(remoteSignals[0].aborted).toBe(true)
		})
	})
})

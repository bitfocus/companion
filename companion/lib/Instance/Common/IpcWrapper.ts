import { assertNever } from '@companion-app/shared/Util.js'

/**
 * This is based upon the IpcWrapper from companion-module/base, with ejson removed
 */

const MAX_CALLBACK_ID = 1 << 28

/**
 * Signature for the handler functions.
 * Handlers that want to support cancellation can accept the optional `signal` parameter.
 */
type HandlerFunction<T extends (...args: any) => any> =
	ReturnType<T> extends never
		? (data: Parameters<T>[0]) => Promise<void>
		: (data: Parameters<T>[0], signal: AbortSignal) => Promise<ReturnType<T>>

type HandlerFunctionOrNever<T> = T extends (...args: any) => any ? HandlerFunction<T> : never

/** Map of handler functions */
export type IpcEventHandlers<T extends object> = {
	[K in keyof T]: HandlerFunctionOrNever<T[K]>
}

type ParamsIfReturnIsNever<T extends (...args: any[]) => any> = ReturnType<T> extends never ? Parameters<T> : never
type ParamsIfReturnIsValid<T extends (...args: any[]) => any> = ReturnType<T> extends never ? never : Parameters<T>

export interface IpcCallMessagePacket {
	direction: 'call'
	name: string
	payload: unknown
	callbackId: number | undefined
}
export interface IpcResponseMessagePacket {
	direction: 'response'
	callbackId: number
	success: boolean
	payload: unknown
}
/**
 * Sent by the caller when a pending call is cancelled (timeout or AbortSignal).
 * The receiver should abort any in-progress work for that callbackId.
 */
export interface IpcCancelMessagePacket {
	direction: 'cancel'
	callbackId: number
}

export type IpcMessagePacket = IpcCallMessagePacket | IpcResponseMessagePacket | IpcCancelMessagePacket

interface PendingCallback {
	timeout: NodeJS.Timeout | undefined
	resolve: (v: any) => void
	reject: (e: any) => void
	signal: AbortSignal | undefined
	abortHandler: (() => void) | undefined
	/** Host-side call site, captured synchronously so a remote error can be stitched onto it */
	callstackError: Error
}

export class IpcWrapper<TOutbound extends { [key: string]: any }, TInbound extends { [key: string]: any }> {
	#handlers: IpcEventHandlers<TInbound>
	#sendMessage: (message: IpcMessagePacket) => void
	#defaultTimeout: number

	#nextCallbackId = 1
	#pendingCallbacks = new Map<number, PendingCallback>()
	#pendingInboundAbortControllers = new Map<number, AbortController>()

	constructor(
		handlers: IpcEventHandlers<TInbound>,
		sendMessage: (message: IpcMessagePacket) => void,
		defaultTimeout: number
	) {
		this.#handlers = handlers
		this.#sendMessage = sendMessage
		this.#defaultTimeout = defaultTimeout
	}

	/**
	 * Replace the inbound handler table. Used to swap to a different set of handlers once a
	 * connection has progressed past a restricted phase (e.g. after registration).
	 */
	replaceHandlers(handlers: IpcEventHandlers<TInbound>): void {
		this.#handlers = handlers
	}

	async sendWithCb<T extends keyof TOutbound>(
		name: T,
		msg: ParamsIfReturnIsValid<TOutbound[T]>[0],
		defaultResponse?: () => Error,
		timeout = 0,
		signal?: AbortSignal
	): Promise<ReturnType<TOutbound[T]>> {
		if (timeout <= 0) timeout = this.#defaultTimeout

		// If the signal is already aborted, reject immediately without sending anything
		signal?.throwIfAborted()

		const promise = Promise.withResolvers<ReturnType<TOutbound[T]>>()
		const callbacks: PendingCallback = {
			timeout: undefined,
			resolve: promise.resolve,
			reject: promise.reject,
			signal: signal,
			abortHandler: undefined,
			// Capture the host call site now, while the stack is meaningful, so a remote
			// failure can be stitched onto it in deserializeError()
			callstackError: new Error(`IPC call "${String(name)}" failed`),
		}

		// Reset the id when it gets really high
		if (this.#nextCallbackId > MAX_CALLBACK_ID) this.#nextCallbackId = 1

		const id = this.#nextCallbackId++
		this.#pendingCallbacks.set(id, callbacks)

		this.#sendMessage({
			direction: 'call',
			name: String(name),
			payload: msg,
			callbackId: id,
		})

		// Setup a timeout, creating the error in the call, so that the stack trace is useful
		const timeoutError = new Error('Call timed out')
		callbacks.timeout = setTimeout(() => {
			this.#rejectAndCancelPendingCallback(id, callbacks, defaultResponse ? defaultResponse() : timeoutError)
		}, timeout)

		if (signal) {
			callbacks.abortHandler = () => {
				this.#rejectAndCancelPendingCallback(id, callbacks, signal.reason ?? new Error('Call aborted'))
			}
			signal.addEventListener('abort', callbacks.abortHandler, { once: true })
		}

		return promise.promise
	}

	#rejectAndCancelPendingCallback(id: number, callbacks: PendingCallback, error: unknown): void {
		this.#pendingCallbacks.delete(id)
		clearTimeout(callbacks.timeout)
		if (callbacks.signal && callbacks.abortHandler) {
			callbacks.signal.removeEventListener('abort', callbacks.abortHandler)
		}

		this.#sendMessage({ direction: 'cancel', callbackId: id })
		callbacks.reject(error)
	}

	sendWithNoCb<T extends keyof TOutbound>(name: T, msg: ParamsIfReturnIsNever<TOutbound[T]>[0]): void {
		this.#sendMessage({
			direction: 'call',
			name: String(name),
			payload: msg,
			callbackId: undefined,
		})
	}

	receivedMessage(msg: IpcMessagePacket): void {
		const rawMsg = msg
		switch (msg.direction) {
			case 'call': {
				const handler = this.#handlers[msg.name]
				if (!handler) {
					if (msg.callbackId) {
						this.#sendMessage({
							direction: 'response',
							callbackId: msg.callbackId,
							success: false,
							payload: { message: `Unknown command "${msg.name}"` },
						})
					}
					return
				}

				// Create an AbortController so the handler can be cancelled by the caller
				const abortController = new AbortController()
				const callbackId = msg.callbackId
				if (callbackId) {
					this.#pendingInboundAbortControllers.set(callbackId, abortController)
				}

				// TODO - should anything be logged here?
				const data = msg.payload ? msg.payload : undefined
				handler(data, abortController.signal).then(
					(res) => {
						if (!callbackId) return

						this.#pendingInboundAbortControllers.delete(callbackId)

						if (abortController.signal.aborted) {
							// The call was aborted while the handler was still running, we should ignore the result
							return
						}

						this.#sendMessage({
							direction: 'response',
							callbackId: callbackId,
							success: true,
							payload: res,
						})
					},
					(err) => {
						if (!callbackId) return

						this.#pendingInboundAbortControllers.delete(callbackId)

						if (abortController.signal.aborted) {
							// The call was aborted while the handler was still running, we should ignore the result
							return
						}

						this.#sendMessage({
							direction: 'response',
							callbackId: callbackId,
							success: false,
							payload: serializeError(err),
						})
					}
				)

				break
			}
			case 'cancel': {
				const abortController = this.#pendingInboundAbortControllers.get(msg.callbackId)
				if (abortController) {
					this.#pendingInboundAbortControllers.delete(msg.callbackId)
					abortController.abort()
				}
				// No response is sent — the caller already cleaned up its pending callback
				break
			}
			case 'response': {
				if (!msg.callbackId) {
					console.error(`Ipc: Response message has no callbackId`)
					return
				}
				const callbacks = this.#pendingCallbacks.get(msg.callbackId)
				this.#pendingCallbacks.delete(msg.callbackId)
				if (!callbacks) {
					// Likely timed out or cancelled, we should ignore
					return
				}

				clearTimeout(callbacks.timeout)
				if (callbacks.signal && callbacks.abortHandler) {
					callbacks.signal.removeEventListener('abort', callbacks.abortHandler)
				}

				const data = msg.payload ? msg.payload : undefined
				if (msg.success) {
					callbacks.resolve(data)
				} else {
					callbacks.reject(deserializeError(data, callbacks.callstackError))
				}

				break
			}
			default:
				assertNever(msg)
				console.error(`Ipc: Message of unknown direction "${rawMsg.direction}"`)
				break
		}
	}
}

/**
 * Serialize a rejected value for transport over IPC. Errors become a structured object so the
 * receiver can faithfully reconstruct name/message/stack (plus any custom enumerable properties
 * the module attached); non-Error values are passed through untouched.
 */
function serializeError(err: unknown): unknown {
	if (!(err instanceof Error)) return err

	const out: Record<string, unknown> = {
		name: err.name,
		message: err.message,
		stack: err.stack,
	}
	// Preserve any extra own properties (e.g. error codes) that modules sometimes attach.
	const errProps = err as unknown as Record<string, unknown>
	for (const key of Object.keys(err)) {
		if (!(key in out)) out[key] = errProps[key]
	}
	return out
}

/**
 * Reconstruct an Error from an IPC error payload produced by serializeError() on the other end.
 * Errors arrive as structured objects; a module that threw a non-Error value (e.g. `throw 'boom'`)
 * arrives as that raw value, which we wrap so callers always reject with a real Error rather than a
 * bare string. Anything else is passed through untouched.
 *
 * The remote stack only shows where the error was thrown inside the child. `callstackError` carries
 * the host-side call site (captured synchronously in sendWithCb); we append its frames so the final
 * stack shows both the remote failure and the host call that triggered it.
 */
function deserializeError(data: unknown, callstackError: Error): unknown {
	let err: Error | undefined
	if (data && typeof data === 'object' && 'message' in data) {
		const errData = data as { name?: unknown; message?: unknown; stack?: unknown }
		err = new Error(String(errData.message))
		if (typeof errData.name === 'string') err.name = errData.name
		if (typeof errData.stack === 'string') err.stack = errData.stack
	} else if (typeof data === 'string') {
		err = new Error(data)
	}

	// Couldn't interpret the payload as an error — pass it through untouched.
	if (!err) return data

	// Strip the synthetic header line ("Error: IPC call ... failed") and keep just the host frames.
	const hostFrames = callstackError.stack?.replace(/^.*?\n/, '')
	if (hostFrames) {
		err.stack = `${err.stack ?? `${err.name}: ${err.message}`}\n    --- via IPC call ---\n${hostFrames}`
	}

	return err
}

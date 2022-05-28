import * as SocketIOClient from 'socket.io-client'
import { CompanionStaticUpgradeScript } from '../module-api/upgrade'
import { EncodeIsVisible } from '../host-api/api.js'
import { ResultCallback } from '../host-api/versions.js'
import { SomeCompanionInputField } from '../module-api/input'

/**
 * Signature for the handler functions
 */
type HandlerFunction<T extends (...args: any) => any> = (data: Parameters<T>[0]) => Promise<ReturnType<T>>

type HandlerFunctionOrNever<T> = T extends (...args: any) => any ? HandlerFunction<T> : never

/** Map of handler functions */
export type EventHandlers<T extends object> = {
	[K in keyof T]: HandlerFunctionOrNever<T[K]>
}

/** Subscribe to all the events defined in the handlers, and wrap with safety and logging */
export function listenToEvents<T extends object>(socket: SocketIOClient.Socket<T>, handlers: EventHandlers<T>): void {
	// const logger = createChildLogger(`module/${connectionId}`);

	for (const [event, handler] of Object.entries(handlers)) {
		socket.on(event as any, async (msg: any, cb: ResultCallback<any>) => {
			if (!msg || typeof msg !== 'object') {
				console.warn(`Received malformed message object "${event}"`)
				return // Ignore messages without correct structure
			}
			if (cb && typeof cb !== 'function') {
				console.warn(`Received malformed callback "${event}"`)
				return // Ignore messages without correct structure
			}

			try {
				// Run it
				const handler2 = handler as HandlerFunction<(msg: any) => any>
				const result = await handler2(msg)

				if (cb) cb(null, result)
			} catch (e: any) {
				console.error(`Command failed: ${e}`, e.stack)
				if (cb) cb(e?.toString() ?? JSON.stringify(e), undefined)
			}
		})
	}
}

export function serializeIsVisibleFn<T extends SomeCompanionInputField>(options: T[]): EncodeIsVisible<T>[] {
	return options.map((option) => {
		if ('isVisible' in option) {
			if (typeof option.isVisible === 'function') {
				return {
					...option,
					isVisibleFn: option.isVisible.toString(),
					isVisible: undefined,
				}
			}
		}

		// ignore any existing `isVisibleFn` to avoid code injection
		return {
			...option,
			isVisibleFn: undefined,
		}
	})
}

export interface InstanceBaseProps<TConfig> {
	id: string
	socket: SocketIOClient.Socket
	upgradeScripts: CompanionStaticUpgradeScript<TConfig>[]
}

export function isInstanceBaseProps<TConfig>(obj: unknown): obj is InstanceBaseProps<TConfig> {
	const obj2 = obj as InstanceBaseProps<TConfig>
	return typeof obj2 === 'object' && typeof obj2.id === 'string' && typeof obj2.socket === 'object'
}

import { afterAll, beforeAll } from 'vitest'
import LogController from '../lib/Log/Controller.js'
import type { TrpcContext } from '../lib/UI/TRPC.js'

export function SuppressLogging() {
	let originalLogLevel: string = 'silly'
	beforeAll(() => {
		originalLogLevel = LogController.getLogLevel()
		LogController.setLogLevel('error')
	})
	afterAll(() => {
		LogController.setLogLevel(originalLogLevel)
	})
}

/** Build a mock TrpcContext for tests, with sensible defaults that can be overridden. */
export function createMockTrpcContext(overrides?: Partial<TrpcContext>): TrpcContext {
	return {
		clientId: 'test-client',
		clientIp: '127.0.0.1',
		isLocalClient: () => true,
		...overrides,
	}
}

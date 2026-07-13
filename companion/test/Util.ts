import type { TrpcContext } from '../lib/UI/TRPC.js'

/** Build a mock TrpcContext for tests, with sensible defaults that can be overridden. */
export function createMockTrpcContext(overrides?: Partial<TrpcContext>): TrpcContext {
	return {
		clientId: 'test-client',
		clientIp: '127.0.0.1',
		isLocalClient: () => true,
		...overrides,
	}
}

import { initTRPC } from '@trpc/server'
import type { Registry } from '../Registry.js'
import type * as trpcExpress from '@trpc/server/adapters/express'
import type * as trpcWs from '@trpc/server/adapters/ws'
import { EventEmitter, on } from 'events'

export interface TrpcContext {
	val: null
}
// created for each request
export const createTrpcExpressContext = ({} /* req, res */ : trpcExpress.CreateExpressContextOptions): TrpcContext => ({
	val: null,
}) // no context
export const createTrpcWsContext = ({} /* req, res */ : trpcWs.CreateWSSContextFnOptions): TrpcContext => ({
	val: null,
}) // no context

/**
 * Initialization of tRPC backend
 * Should be done only once per backend!
 */
const t = initTRPC.context<TrpcContext>().create()

/**
 * Export reusable router and procedure helpers
 * that can be used throughout the router
 */
export const router = t.router
export const publicProcedure = t.procedure
export const protectedProcedure = t.procedure

/**
 * Create the root TRPC router
 * @param registry
 * @returns
 */
export function createTrpcRouter(registry: Registry) {
	return router({
		// ...

		userList: publicProcedure.query(async () => {
			return [1, 2, 3]
		}),

		appInfo: registry.ui.update.createTrpcRouter(),
	})
}

// Export type router type signature,
// NOT the router itself.
export type AppRouter = ReturnType<typeof createTrpcRouter>

export function toIterable<T extends Record<string, any[]>, TKey extends string & keyof T>(
	ee: EventEmitter<T>,
	key: TKey,
	signal: AbortSignal | undefined
): NodeJS.AsyncIterator<T[TKey]> {
	return on(ee as any, key, { signal }) as NodeJS.AsyncIterator<T[TKey]>
}

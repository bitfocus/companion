import { initTRPC } from '@trpc/server'
import type { Registry } from '../Registry.js'
import type * as trpcExpress from '@trpc/server/adapters/express'

// created for each request
export const createTrpcContext = ({} /* req, res */ : trpcExpress.CreateExpressContextOptions) => ({}) // no context
type Context = Awaited<ReturnType<typeof createTrpcContext>>

/**
 * Initialization of tRPC backend
 * Should be done only once per backend!
 */
const t = initTRPC.context<Context>().create()

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

import { initTRPC } from '@trpc/server'
import type { Registry } from '../Registry.js'
import type * as trpcExpress from '@trpc/server/adapters/express'
import type * as trpcWs from '@trpc/server/adapters/ws'
import { EventEmitter, on } from 'events'

export interface TrpcContext {
	val: null
}
// created for each request
export const createTrpcExpressContext = ({
	req: _req,
	res: _res,
}: trpcExpress.CreateExpressContextOptions): TrpcContext => ({
	val: null,
}) // no context
export const createTrpcWsContext = ({ req: _req, res: _res }: trpcWs.CreateWSSContextFnOptions): TrpcContext => ({
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
		appInfo: registry.ui.update.createTrpcRouter(),

		bonjour: registry.services.bonjourDiscovery.createTrpcRouter(),

		actionRecorder: registry.controls.actionRecorder.createTrpcRouter(),
		surfaces: registry.surfaces.createTrpcRouter(),
		surfaceDiscovery: registry.services.surfaceDiscovery.createTrpcRouter(),

		controls: registry.controls.createTrpcRouter(),

		customVariables: registry.variables.custom.createTrpcRouter(),
		pages: registry.page.createTrpcRouter(),

		connections: router({
			// Future: move this into the connections controller
			collections: registry.instance.collections.createTrpcRouter(),
			definitions: registry.instance.definitions.createTrpcRouter(),
		}),

		preview: router({
			graphics: registry.preview.createTrpcRouter(),
		}),
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

import { initTRPC } from '@trpc/server'
import type { Registry } from '../Registry.js'
import type * as trpcExpress from '@trpc/server/adapters/express'
import type * as trpcWs from '@trpc/server/adapters/ws'
import { EventEmitter, on } from 'events'
import type { ExportFullv6, ExportPageModelv6 } from '@companion-app/shared/Model/ExportModel.js'

export interface TrpcContext {
	val: null
	pendingImport?: {
		object: ExportFullv6 | ExportPageModelv6
		timeout: null
	}
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

		variables: registry.variables.createTrpcRouter(),
		customVariables: registry.variables.custom.createTrpcRouter(),
		pages: registry.page.createTrpcRouter(),
		importExport: registry.importExport.createTrpcRouter(),

		connections: router({
			// Future: move this into the connections controller
			collections: registry.instance.collections.createTrpcRouter(),
			definitions: registry.instance.definitions.createTrpcRouter(),

			modules: registry.instance.modules.createTrpcRouter(),
			modulesManager: registry.instance.userModulesManager.createTrpcRouter(),
			modulesStore: registry.instance.modulesStore.createTrpcRouter(),
		}),

		preview: router({
			graphics: registry.preview.createTrpcRouter(),
		}),
	})
}

// Export type router type signature,
// NOT the router itself.
export type AppRouter = ReturnType<typeof createTrpcRouter>

type TEventMap<TEmitter extends EventEmitter> = TEmitter extends EventEmitter<infer E> ? E : never

export function toIterable<TEmitter extends EventEmitter, TKey extends string & keyof TEventMap<TEmitter>>(
	ee: TEmitter,
	key: TKey,
	signal: AbortSignal | undefined
): NodeJS.AsyncIterator<TEventMap<TEmitter>[TKey]> {
	return on(ee as any, key, { signal }) as NodeJS.AsyncIterator<TEventMap<TEmitter>[TKey]>
}

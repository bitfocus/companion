import { inferRouterInputs, inferRouterOutputs, initTRPC } from '@trpc/server'
import type { Registry } from '../Registry.js'
import type * as trpcExpress from '@trpc/server/adapters/express'
import type * as trpcWs from '@trpc/server/adapters/ws'
import { EventEmitter, on } from 'events'
import type { ExportFullv6, ExportPageModelv6 } from '@companion-app/shared/Model/ExportModel.js'
import LogController from '../Log/Controller.js'
import { nanoid } from 'nanoid'

export interface TrpcContext {
	clientId: string
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
	clientId: nanoid(),
}) // no context
export const createTrpcWsContext = ({ req: _req, res: _res }: trpcWs.CreateWSSContextFnOptions): TrpcContext => ({
	clientId: nanoid(),
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
		logs: LogController.createTrpcRouter(),

		userConfig: registry.userconfig.createTrpcRouter(),
		connections: registry.instance.createTrpcRouter(),
		cloud: registry.cloud.createTrpcRouter(),

		preview: registry.preview.createTrpcRouter(),
		imageLibrary: registry.graphics.imageLibrary.createTrpcRouter(),
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

export type RouterInput = inferRouterInputs<AppRouter>
export type RouterOutput = inferRouterOutputs<AppRouter>

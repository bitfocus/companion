import { type inferRouterInputs, type inferRouterOutputs, initTRPC, TRPCError } from '@trpc/server'
import type { Registry } from '../Registry.js'
import type * as trpcExpress from '@trpc/server/adapters/express'
import type * as trpcWs from '@trpc/server/adapters/ws'
import { on, type EventEmitter } from 'node:events'
import type { ExportFullv6, ExportPageModelv6 } from '@companion-app/shared/Model/ExportModel.js'
import LogController from '../Log/Controller.js'
import { nanoid } from 'nanoid'
import { isPackaged } from '../Resources/Util.js'
import { trpcMiddleware as sentryTrpcMiddleware } from '@sentry/node'

export interface TrpcContext {
	clientId: string
	clientIp: string | undefined

	pendingImport?: {
		object: ExportFullv6 | ExportPageModelv6
		timeout: null
	}
}
// created for each request
export const createTrpcExpressContext = ({ req, res: _res }: trpcExpress.CreateExpressContextOptions): TrpcContext => ({
	clientId: nanoid(),
	clientIp: req.ip,
}) // no context
export const createTrpcWsContext = ({ req, res: _res }: trpcWs.CreateWSSContextFnOptions): TrpcContext => ({
	clientId: nanoid(),
	clientIp: req.socket.remoteAddress,
}) // no context

/**
 * Initialization of tRPC backend
 * Should be done only once per backend!
 */
const t = initTRPC.context<TrpcContext>().create()

const loggerMiddleware = t.middleware(async ({ ctx, next, path, type }) => {
	const start = Date.now()

	const result = await next()

	const end = Date.now()

	// TODO - putting this outside results in a 'before initialization' loop
	const trpcCallLogger = LogController.createLogger('TRPC/Call')

	// Log the request at varying levels depending on whether companion is packaged or not
	const logLine = `${ctx.clientIp ?? ''} - ${ctx.clientId ?? '-'} "${path}/${type}" ${result.ok ? 200 : result.error.code} in ${end - start}ms`
	if (isPackaged()) {
		trpcCallLogger.silly(logLine)
	} else {
		trpcCallLogger.debug(logLine)
	}

	return result
})

const tidyZodMiddleware = t.middleware(async ({ next, path, type }) => {
	const result = await next()

	if (!result.ok && result.error instanceof TRPCError && result.error.code === 'BAD_REQUEST') {
		throw new Error(`Invalid or malformed input provided for "${path}/${type}"`, {
			cause: result.error.cause,
		})
	}

	return result
})

const sentryMiddleware = t.middleware(
	sentryTrpcMiddleware({
		attachRpcInput: true,
	})
)

/**
 * Export reusable router and procedure helpers
 * that can be used throughout the router
 */
export const router = t.router

export const publicProcedure = t.procedure.use(sentryMiddleware).use(loggerMiddleware).use(tidyZodMiddleware)
// export const protectedProcedure = t.procedure

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

		controls: registry.controls.createTrpcRouter(),

		variables: registry.variables.createTrpcRouter(),
		customVariables: registry.variables.custom.createTrpcRouter(),
		pages: registry.page.createTrpcRouter(),
		importExport: registry.importExport.createTrpcRouter(),
		logs: LogController.createTrpcRouter(),

		userConfig: registry.userconfig.createTrpcRouter(),
		instances: registry.instance.createTrpcRouter(),
		cloud: registry.cloud.createTrpcRouter(),
		usageStatistics: registry.usageStatistics.createTrpcRouter(),

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

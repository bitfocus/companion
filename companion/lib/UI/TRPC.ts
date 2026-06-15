import { on, type EventEmitter } from 'node:events'
import os from 'node:os'
import { trpcMiddleware as sentryTrpcMiddleware } from '@sentry/node'
import { initTRPC, TRPCError, type inferRouterInputs, type inferRouterOutputs } from '@trpc/server'
import type * as trpcExpress from '@trpc/server/adapters/express'
import type * as trpcWs from '@trpc/server/adapters/ws'
import { nanoid } from 'nanoid'
import type { ExportFullv6, ExportPageModelv6 } from '@companion-app/shared/Model/ExportModel.js'
import LogController from '../Log/Controller.js'
import type { Registry } from '../Registry.js'
import { isPackaged } from '../Resources/Util.js'

export interface TrpcContext {
	clientId: string
	clientIp: string | undefined

	/**
	 * Whether this client is connecting from the same machine as Companion.
	 * Lazily evaluated and cached for the lifetime of the context.
	 * Note: This is not guaranteed to be 100% accurate at all times.
	 */
	isLocalClient: () => boolean

	pendingImport?: {
		object: ExportFullv6 | ExportPageModelv6
		timeout: null
	}
}
// created for each request
export const createTrpcExpressContext = ({ req, res: _res }: trpcExpress.CreateExpressContextOptions): TrpcContext => ({
	clientId: nanoid(),
	clientIp: req.ip,
	isLocalClient: makeIsLocalClient(req.ip),
}) // no context
export const createTrpcWsContext = ({ req, res: _res }: trpcWs.CreateWSSContextFnOptions): TrpcContext => ({
	clientId: nanoid(),
	clientIp: req.socket.remoteAddress,
	isLocalClient: makeIsLocalClient(req.socket.remoteAddress),
}) // no context

/**
 * Build a lazily-cached predicate for whether `clientIp` is on the same machine as Companion.
 * Returns true for loopback addresses and for any address belonging to one of this machine's own
 * network interfaces (so opening the UI on the host's LAN address still counts as local).
 */
function makeIsLocalClient(clientIp: string | undefined): () => boolean {
	let cached: boolean | undefined
	return () => {
		if (cached === undefined) cached = computeIsLocalClient(clientIp)
		return cached
	}
}
export function computeIsLocalClient(clientIp: string | undefined): boolean {
	if (!clientIp) return false

	try {
		const normalize = (ip: string) => ip.replace(/^::ffff:/, '').replace(/%.*$/, '')
		const normalized = normalize(clientIp)
		if (normalized === '127.0.0.1' || normalized === '::1') return true

		const interfaces = os.networkInterfaces()
		for (const addresses of Object.values(interfaces)) {
			if (!addresses) continue
			for (const addr of addresses) {
				if (normalize(addr.address) === normalized) return true
			}
		}
		return false
	} catch {
		// If we fail to get the network interfaces for some reason, assume it's not local.
		return false
	}
}

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

		actionRecorder: registry.instance.actionRecorder.createTrpcRouter(),
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
	return on(ee, key, { signal }) as NodeJS.AsyncIterator<TEventMap<TEmitter>[TKey]>
}

export type RouterInput = inferRouterInputs<AppRouter>
export type RouterOutput = inferRouterOutputs<AppRouter>

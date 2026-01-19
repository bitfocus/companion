import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query'
import type { AppRouter } from '../../../companion/lib/UI/TRPC.js' // Type only import the router
import { createTRPCClient, createWSClient, loggerLink, wsLink } from '@trpc/client'
import { makeAbsolutePath } from './util.js'
import {
	QueryClient,
	useMutation,
	type DefaultError,
	type UseMutationOptions,
	type UseMutationResult,
} from '@tanstack/react-query'
import { useMemo } from 'react'
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server'
import * as Sentry from '@sentry/react'

export type RouterInputs = inferRouterInputs<AppRouter>
export type RouterOutputs = inferRouterOutputs<AppRouter>

export const queryClient = new QueryClient()

// Build a full url. This is needed to support older chromium, modern browsers support simply /trpc
let trpcUrl = window.location.origin + makeAbsolutePath(`/trpc`)
if (trpcUrl.startsWith('http')) trpcUrl = 'ws' + trpcUrl.slice(4)

export const trpcWsClient = createWSClient({
	url: trpcUrl,
	keepAlive: {
		enabled: true,
	},
	onError: (error) => {
		// This is probably pretty noisy, but there are some issues around here that need debugging
		Sentry.captureException(error, { tags: { area: 'trpc-ws-client' } })
	},
})

// Close the WebSocket connection when the page is unloading to prevent wasteful reconnection attempts
window.addEventListener('beforeunload', () => {
	trpcWsClient.close().catch((err) => {
		console.error('Error closing TRPC WebSocket client on unload:', err)
	})
})

export const trpcClient = createTRPCClient<AppRouter>({
	links: [
		loggerLink(),
		wsLink({
			client: trpcWsClient,
		}),
		// httpBatchLink({
		// 	url: '/trpc',
		// 	// You can pass any HTTP headers you wish here
		// 	// async headers() {
		// 	// 	return {
		// 	// 		authorization: getAuthCookie(),
		// 	// 	}
		// 	// },
		// }),
	],
})

export const trpc = createTRPCOptionsProxy<AppRouter>({
	client: trpcClient,
	queryClient,
})

/**
 * A wrapper around `useMutation` that memoizes the returned values.
 * Without this it is very hard to use this in a useMemo or similar hook, due to the `useMutation` returning a new object on every render,
 * and eslint complaining about the dependency unless the mutation object is not destructured.
 * Note: this is intentionally minimal values so that it doesnt invalidate when the mutation is used
 */
export function useMutationExt<TData = unknown, TError = DefaultError, TVariables = void, TContext = unknown>(
	options: UseMutationOptions<TData, TError, TVariables, TContext>,
	queryClient?: QueryClient
): Pick<UseMutationResult<TData, TError, TVariables, TContext>, 'mutateAsync' | 'mutate'> {
	const rawUseMutation = useMutation(options, queryClient)

	return useMemo(
		() => ({
			mutateAsync: rawUseMutation.mutateAsync,
			mutate: rawUseMutation.mutate,
		}),
		[rawUseMutation.mutateAsync, rawUseMutation.mutate]
	)
}

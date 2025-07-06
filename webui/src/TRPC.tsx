import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query'
import type { AppRouter } from '../../companion/lib/UI/TRPC.js' // Type only import the router
import { createTRPCClient, createWSClient, loggerLink, wsLink } from '@trpc/client'
import { makeAbsolutePath } from './util.js'
import { DefaultError, QueryClient, useMutation, UseMutationOptions, UseMutationResult } from '@tanstack/react-query'
import { useMemo } from 'react'

export const queryClient = new QueryClient()

export const trpcWsClient = createWSClient({
	url: makeAbsolutePath(`/trpc`),
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
 * Without this it is very hard to use this in a memoized
 */
export function useMutationExt<TData = unknown, TError = DefaultError, TVariables = void, TContext = unknown>(
	options: UseMutationOptions<TData, TError, TVariables, TContext>,
	queryClient?: QueryClient
): Pick<UseMutationResult<TData, TError, TVariables, TContext>, 'mutateAsync' | 'mutate' | 'isPending'> {
	const rawUseMutation = useMutation(options, queryClient)

	return useMemo(
		() => ({
			mutateAsync: rawUseMutation.mutateAsync,
			mutate: rawUseMutation.mutate,
			isPending: rawUseMutation.isPending,
		}),
		[rawUseMutation.mutateAsync, rawUseMutation.mutate, rawUseMutation.isPending]
	)
}

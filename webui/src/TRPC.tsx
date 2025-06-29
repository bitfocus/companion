import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query'
import type { AppRouter } from '../../companion/lib/UI/TRPC.js' // Type only import the router
import { createTRPCClient, createWSClient, loggerLink, wsLink } from '@trpc/client'
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient()

export const trpcWsClient = createWSClient({
	url: `/trpc`,
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

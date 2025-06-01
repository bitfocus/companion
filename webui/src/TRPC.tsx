import { createTRPCContext } from '@trpc/tanstack-react-query'
import type { AppRouter } from '../../companion/lib/UI/TRPC.js' // Type only import the router
import { createTRPCClient, createWSClient, loggerLink, wsLink } from '@trpc/client'

export const { TRPCProvider, useTRPC, useTRPCClient } = createTRPCContext<AppRouter>()

const wsClient = createWSClient({
	url: `/trpc`,
})

export const trpcClient = createTRPCClient<AppRouter>({
	links: [
		loggerLink(),
		wsLink({
			client: wsClient,
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

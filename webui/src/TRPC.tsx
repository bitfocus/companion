// import { createTRPCClient, httpBatchLink } from '@trpc/client'
import { createTRPCReact } from '@trpc/react-query'
import type { AppRouter } from '../../companion/lib/UI/TRPC.js' // Type only import the router
import { createWSClient, httpBatchLink, loggerLink, wsLink } from '@trpc/client'
// const trpc = createTRPCClient<AppRouter>({
// 	links: [
// 		httpBatchLink({
// 			url: '/trpc',
// 		}),
// 	],
// })

export const trpc = createTRPCReact<AppRouter>()

const wsClient = createWSClient({
	url: `/trpc`,
})

export const trpcClient = trpc.createClient({
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

// export { trpc }

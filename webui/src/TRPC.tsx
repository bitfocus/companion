// import { createTRPCClient, httpBatchLink } from '@trpc/client'
import { createTRPCReact } from '@trpc/react-query'
import type { AppRouter } from '../../companion/lib/UI/TRPC.js' // Type only import the router
import { httpBatchLink } from '@trpc/client'
// const trpc = createTRPCClient<AppRouter>({
// 	links: [
// 		httpBatchLink({
// 			url: '/trpc',
// 		}),
// 	],
// })

export const trpc = createTRPCReact<AppRouter>()

export const trpcClient = trpc.createClient({
	links: [
		httpBatchLink({
			url: '/trpc',
			// You can pass any HTTP headers you wish here
			// async headers() {
			// 	return {
			// 		authorization: getAuthCookie(),
			// 	}
			// },
		}),
	],
})

// export { trpc }

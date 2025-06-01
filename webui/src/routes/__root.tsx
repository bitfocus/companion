import React, { Suspense } from 'react'
import { createRootRoute, Outlet } from '@tanstack/react-router'
import { ErrorFallback } from '~/util.js'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '../TRPC.js'

export const Route = createRootRoute({
	component: () => {
		return (
			<>
				<QueryClientProvider client={queryClient}>
					<Outlet />
					<Suspense>
						<TanStackRouterDevtools position="top-left" />
					</Suspense>
				</QueryClientProvider>
			</>
		)
	},
	errorComponent: ({ error, reset }) => {
		return <ErrorFallback error={error} resetErrorBoundary={reset} />
	},
})

const TanStackRouterDevtools =
	process.env.NODE_ENV === 'production'
		? () => null // Render nothing in production
		: React.lazy(async () =>
				// Lazy load in development
				import('@tanstack/react-router-devtools').then((res) => ({
					default: res.TanStackRouterDevtools,
					// For Embedded Mode
					// default: res.TanStackRouterDevtoolsPanel
				}))
			)

import React, { Suspense } from 'react'
import { createRootRoute, Outlet } from '@tanstack/react-router'
import { ErrorFallback } from '../util.js'

export const Route = createRootRoute({
	component: () => (
		<>
			<Outlet />
			<Suspense>
				<TanStackRouterDevtools position="top-left" />
			</Suspense>
		</>
	),
	errorComponent: ({ error, reset }) => {
		return <ErrorFallback error={error} resetErrorBoundary={reset} />
	},
})

const TanStackRouterDevtools =
	process.env.NODE_ENV === 'production'
		? () => null // Render nothing in production
		: React.lazy(() =>
				// Lazy load in development
				import('@tanstack/router-devtools').then((res) => ({
					default: res.TanStackRouterDevtools,
					// For Embedded Mode
					// default: res.TanStackRouterDevtoolsPanel
				}))
			)

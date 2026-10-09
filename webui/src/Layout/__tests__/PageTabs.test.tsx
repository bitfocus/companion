import { faDollarSign, faNetworkWired, faSquareRootVariable } from '@fortawesome/free-solid-svg-icons'
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { NavPage } from '../navRegistry.js'
import { PageTabs } from '../PageTabs'

const TABS: readonly NavPage[] = [
	{ id: 'connections', label: 'Connection Variables', path: '/variables', icon: faNetworkWired },
	{ id: 'custom', label: 'Custom Variables', path: '/variables/custom', icon: faDollarSign },
	{ id: 'expression', label: 'Expression Variables', path: '/variables/expression', icon: faSquareRootVariable },
]

function createTestRouter(initialUrl: string, activeTab: 'connections' | 'custom' | 'expression') {
	const rootRoute = createRootRoute({
		component: () => <PageTabs tabs={TABS} activeTab={activeTab} />,
	})
	const variablesRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: '/variables',
	})
	const customRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: '/variables/custom',
	})
	const expressionRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: '/variables/expression',
	})

	const routeTree = rootRoute.addChildren([variablesRoute, customRoute, expressionRoute])

	const history = createMemoryHistory({ initialEntries: [initialUrl] })
	return createRouter({ routeTree, history })
}

describe('PageTabs', () => {
	it('only highlights the active tab when on sub-routes like /variables/custom', async () => {
		const router = createTestRouter('/variables/custom', 'custom')
		render(<RouterProvider router={router} />)

		await waitFor(() => {
			expect(screen.getByText('Custom Variables')).toBeInTheDocument()
		})

		const connectionTab = screen.getByText('Connection Variables').closest('a')
		const customTab = screen.getByText('Custom Variables').closest('a')
		const expressionTab = screen.getByText('Expression Variables').closest('a')

		expect(customTab).toHaveClass('active')
		expect(connectionTab).not.toHaveClass('active')
		expect(expressionTab).not.toHaveClass('active')
	})
})

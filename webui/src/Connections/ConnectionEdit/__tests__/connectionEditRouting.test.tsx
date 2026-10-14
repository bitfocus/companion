import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Route as ConnectionDiagnosticsRoute } from '~/routes/_app/connections/$connectionId.diagnostics.js'
import { Route as ConnectionDocsRoute } from '~/routes/_app/connections/$connectionId.docs.js'
import { Route as ConnectionRoute } from '~/routes/_app/connections/$connectionId.js'
import { RootAppStoreContext, type RootAppStore } from '~/Stores/RootAppStore.js'
import type { ConnectionEditTab } from '../connectionEditTabs.js'

const mocks = vi.hoisted(() => ({ mountCount: 0 }))

vi.mock('../ConnectionEditPanel', async () => {
	const { useEffect } = await import('react')
	return {
		ConnectionEditPanel: function MockConnectionEditPanel({
			activeTab,
			setActiveTab,
		}: {
			activeTab: ConnectionEditTab
			setActiveTab: (tab: ConnectionEditTab) => void
		}) {
			useEffect(() => {
				mocks.mountCount++
			}, [])
			return (
				<div>
					<p>Active view: {activeTab}</p>
					{(['settings', 'docs', 'diagnostics'] as const).map((tab) => (
						<button key={tab} onClick={() => setActiveTab(tab)}>
							{tab}
						</button>
					))}
				</div>
			)
		},
	}
})

async function renderConnection(url: string) {
	const rootRoute = createRootRoute({ component: Outlet })
	const appRoute = createRoute({ getParentRoute: () => rootRoute, id: '_app', component: Outlet })
	const connectionsRoute = createRoute({ getParentRoute: () => appRoute, path: 'connections', component: Outlet })
	const connectionRoute = ConnectionRoute.update({
		id: '/$connectionId',
		path: '/$connectionId',
		getParentRoute: () => connectionsRoute,
	} as never)
	const docsRoute = ConnectionDocsRoute.update({
		id: '/docs',
		path: '/docs',
		getParentRoute: () => connectionRoute,
	} as never)
	const diagnosticsRoute = ConnectionDiagnosticsRoute.update({
		id: '/diagnostics',
		path: '/diagnostics',
		getParentRoute: () => connectionRoute,
	} as never)
	const history = createMemoryHistory({ initialEntries: [url] })
	const router = createRouter({
		routeTree: rootRoute.addChildren([
			appRoute.addChildren([
				connectionsRoute.addChildren([connectionRoute.addChildren([docsRoute, diagnosticsRoute])]),
			]),
		]),
		history,
	})
	const store = { connections: { connections: new Map([['example', {}]]) } } as unknown as RootAppStore
	await router.load()
	render(
		<RootAppStoreContext.Provider value={store}>
			<RouterProvider router={router} />
		</RootAppStoreContext.Provider>
	)
	return { history, router }
}

describe('Connection editor routing', () => {
	it('opens settings at the bare connection path', async () => {
		const { router } = await renderConnection('/connections/example')
		expect(await screen.findByText('Active view: settings')).toBeInTheDocument()
		expect(router.state.location.href).toBe('/connections/example')
	})

	it('opens Docs from a direct URL, switches tabs, and restores Docs on back', async () => {
		const user = userEvent.setup()
		const { history, router } = await renderConnection('/connections/example/docs')
		expect(await screen.findByText('Active view: docs')).toBeInTheDocument()
		await user.click(screen.getByRole('button', { name: 'diagnostics' }))
		expect(await screen.findByText('Active view: diagnostics')).toBeInTheDocument()
		expect(router.state.location.href).toBe('/connections/example/diagnostics')
		history.back()
		expect(await screen.findByText('Active view: docs')).toBeInTheDocument()
		await user.click(screen.getByRole('button', { name: 'settings' }))
		await waitFor(() => expect(router.state.location.href).toBe('/connections/example'))
		expect(screen.getByText('Active view: settings')).toBeInTheDocument()
	})

	it('keeps the editor mounted when switching tabs', async () => {
		const user = userEvent.setup()
		await renderConnection('/connections/example')
		expect(await screen.findByText('Active view: settings')).toBeInTheDocument()
		const mountsBefore = mocks.mountCount
		expect(mountsBefore).toBeGreaterThan(0)

		await user.click(screen.getByRole('button', { name: 'docs' }))
		expect(await screen.findByText('Active view: docs')).toBeInTheDocument()
		await user.click(screen.getByRole('button', { name: 'diagnostics' }))
		expect(await screen.findByText('Active view: diagnostics')).toBeInTheDocument()

		expect(mocks.mountCount).toBe(mountsBefore)
	})

	it('ignores the old tab search parameter', async () => {
		await renderConnection('/connections/example?tab=docs')
		expect(await screen.findByText('Active view: settings')).toBeInTheDocument()
	})
})

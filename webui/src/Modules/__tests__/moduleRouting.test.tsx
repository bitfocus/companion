import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Route as ModuleDocsVersionRoute } from '~/routes/_app/modules/$moduleType.$moduleId.docs.$docsVersion.js'
import { Route as ModuleDocsRoute } from '~/routes/_app/modules/$moduleType.$moduleId.docs.js'
import { Route as ModuleRoute } from '~/routes/_app/modules/$moduleType.$moduleId.js'
import { RootAppStoreContext, type RootAppStore } from '~/Stores/RootAppStore.js'

vi.mock('~/Modules/ModuleManagePanel.js', () => ({
	ModuleManagePanel: ({ tab, docsVersion }: { tab: 'docs' | undefined; docsVersion: string | undefined }) => (
		<p>
			Tab: {tab ?? 'overview'}, version: {docsVersion ?? 'default'}
		</p>
	),
}))

async function renderModule(url: string) {
	const rootRoute = createRootRoute({ component: Outlet })
	const appRoute = createRoute({ getParentRoute: () => rootRoute, id: '_app', component: Outlet })
	const modulesRoute = createRoute({ getParentRoute: () => appRoute, path: 'modules', component: Outlet })
	const moduleRoute = ModuleRoute.update({
		id: '/$moduleType/$moduleId',
		path: '/$moduleType/$moduleId',
		getParentRoute: () => modulesRoute,
	} as never)
	const docsRoute = ModuleDocsRoute.update({
		id: '/docs',
		path: '/docs',
		getParentRoute: () => moduleRoute,
	} as never)
	const docsVersionRoute = ModuleDocsVersionRoute.update({
		id: '/$docsVersion',
		path: '/$docsVersion',
		getParentRoute: () => docsRoute,
	} as never)
	const router = createRouter({
		routeTree: rootRoute.addChildren([
			appRoute.addChildren([
				modulesRoute.addChildren([moduleRoute.addChildren([docsRoute.addChildren([docsVersionRoute])])]),
			]),
		]),
		history: createMemoryHistory({ initialEntries: [url] }),
	})
	const store = {
		modules: { getModuleInfo: () => ({}), getStoreInfo: () => undefined },
	} as unknown as RootAppStore
	await router.load()
	render(
		<RootAppStoreContext.Provider value={store}>
			<RouterProvider router={router} />
		</RootAppStoreContext.Provider>
	)
}

describe('Module page routing', () => {
	it('opens the overview at the bare module path', async () => {
		await renderModule('/modules/connection/example')
		expect(await screen.findByText('Tab: overview, version: default')).toBeInTheDocument()
	})

	it('opens the docs for the default version', async () => {
		await renderModule('/modules/connection/example/docs')
		expect(await screen.findByText('Tab: docs, version: default')).toBeInTheDocument()
	})

	it('opens the docs for a specific version', async () => {
		await renderModule('/modules/connection/example/docs/1.2.3')
		expect(await screen.findByText('Tab: docs, version: 1.2.3')).toBeInTheDocument()
	})
})

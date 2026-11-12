import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'
import express from 'express'
import type { IPageStore } from '../Page/Store.js'
import { BUTTONS_API_BASE_PATH, createButtonsRouter, registerButtonPaths } from './ButtonsRestApi.js'
import type { SomeControl } from './IControlFragments.js'
import { createPagesRouter, PAGES_API_BASE_PATH, registerPagePaths } from './PagesRestApi.js'

export function createControlsRestApiRouter(
	controls: Pick<Map<string, SomeControl>, 'get'>,
	pageStore: IPageStore
): express.Router {
	const router = express.Router()

	router.use(PAGES_API_BASE_PATH, createPagesRouter({ controls, pageStore }))
	router.use(BUTTONS_API_BASE_PATH, createButtonsRouter({ controls, pageStore }))

	return router
}

export function registerControlsRestApiPaths(registry: OpenAPIRegistry): void {
	registerPagePaths(registry)
	registerButtonPaths(registry)
}

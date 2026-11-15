import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'
import express from 'express'
import type { InstanceDefinitions } from '../Instance/Definitions.js'
import type { IPageStore } from '../Page/Store.js'
import { BUTTONS_API_BASE_PATH, createButtonsRouter, registerButtonPaths } from './ButtonsRestApi.js'
import type { SomeControl } from './IControlFragments.js'

export function createControlsRestApiRouter(
	controls: Pick<Map<string, SomeControl>, 'get'>,
	pageStore: IPageStore,
	definitions: InstanceDefinitions
): express.Router {
	const router = express.Router()

	router.use(BUTTONS_API_BASE_PATH, createButtonsRouter({ controls, pageStore, definitions }))

	return router
}

export function registerControlsRestApiPaths(registry: OpenAPIRegistry): void {
	registerButtonPaths(registry)
}

import express from 'express'
import type { Logger } from '../Log/Controller.js'
import type { InstanceConfigStore } from './ConfigStore.js'
import {
	CONNECTIONS_API_BASE_PATH,
	createConnectionsRouter,
	registerConnectionPaths,
} from './Connection/ConnectionsRestApi.js'
import type { InstanceController } from './Controller.js'

export function createInstanceRestApiRouter(
	logger: Logger,
	instanceController: InstanceController,
	configStore: InstanceConfigStore
): express.Router {
	const router = express.Router()

	router.use(
		CONNECTIONS_API_BASE_PATH,
		createConnectionsRouter(logger.child({ source: 'connection/v1' }), instanceController, configStore)
	)

	return router
}

export function registerInstanceRestApiPaths(): void {
	registerConnectionPaths()
}

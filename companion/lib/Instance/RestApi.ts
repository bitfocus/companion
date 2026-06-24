import express from 'express'
import type { Logger } from '../Log/Controller.js'
import { createConnectionsRouter, registerConnectionPaths } from './Connection/ConnectionsRestApi.js'
import type { InstanceController } from './Controller.js'

export function createInstanceRestApiRouter(logger: Logger, instanceController: InstanceController): express.Router {
	const router = express.Router()

	router.use('/connections/v1', createConnectionsRouter(logger, instanceController))

	return router
}

export function registerInstanceRestApiPaths(): void {
	registerConnectionPaths()
}

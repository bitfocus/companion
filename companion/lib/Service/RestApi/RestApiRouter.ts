import Express from 'express'
import type { InstanceController } from '../../Instance/Controller.js'
import LogController from '../../Log/Controller.js'
import type { AppInfo } from '../../Registry.js'
import { restApiErrorHandler } from './middleware/errorHandler.js'
import { generateOpenApiDocument } from './openapi.js'
import { createAuthMiddleware, type ApiTokenStore } from './RestApiAuth.js'
import { createConnectionsRouter } from './routes/ConnectionsRouter.js'
import { createSwaggerUiRouter } from './SwaggerUi.js'

/**
 * Create the main REST API router.
 * Mounted at /api/ on the admin Express app.
 * Each resource type is versioned independently: /api/connections/v1/, /api/pages/v1/, etc.
 *
 * Only created when the REST API is enabled at startup (checked in RestApiService).
 */
export function createRestApiRouter(
	instanceController: InstanceController,
	tokenStore: ApiTokenStore,
	appInfo: Pick<AppInfo, 'appVersion'>
): Express.Router {
	const logger = LogController.createLogger('Service/RestApi')
	const router = Express.Router()

	// OpenAPI spec and Swagger UI — served without auth
	const openApiDocument = generateOpenApiDocument(appInfo)

	router.get('/openapi.json', (_req, res) => {
		res.json(openApiDocument)
	})

	router.use('/docs', createSwaggerUiRouter())

	// Mount resource routers — each versioned independently
	router.use(
		'/connections/v1',
		createAuthMiddleware(logger, tokenStore),
		createConnectionsRouter(logger, instanceController)
	)

	// Global error handler (unmatched routes fall through to the legacy /api router)
	router.use(restApiErrorHandler)

	return router
}

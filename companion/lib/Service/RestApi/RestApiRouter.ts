import cors from 'cors'
import Express from 'express'
import LogController from '../../Log/Controller.js'
import type { AppInfo, Registry } from '../../Registry.js'
import { RestApiError } from './errors.js'
import { restApiErrorHandler } from './middleware/errorHandler.js'
import { generateOpenApiDocument } from './openapi.js'
import { createAuthMiddleware, type ApiTokenStore } from './RestApiAuth.js'
import { createSwaggerUiRouter } from './SwaggerUi.js'

/**
 * Create the main REST API router.
 * Mounted at /api/v2/ on the admin Express app.
 * Each resource type is versioned independently: /api/v2/connections/v1/, /api/v2/pages/v1/, etc.
 *
 * Created and mounted while the REST API is enabled; unmounted when it is disabled (see RestApiService).
 */
export function createRestApiRouter(
	registry: Registry,
	tokenStore: ApiTokenStore,
	appInfo: Pick<AppInfo, 'appVersion'>
): Express.Router {
	const logger = LogController.createLogger('Service/Rest')
	const router = Express.Router()

	// OpenAPI spec and Swagger UI — served without auth
	const openApiDocument = generateOpenApiDocument(appInfo)

	router.get('/openapi.json', (_req, res) => {
		res.json(openApiDocument)
	})

	router.use('/docs', createSwaggerUiRouter())

	// CORS applies only to the data endpoints below, not the docs/spec above: the API is authenticated
	// by a bearer token (not cookies), so there is no CSRF risk and it is meant to be callable from
	// browsers on other origins. The docs UI and spec are viewed/fetched same-origin, so they are left
	// out. This also answers resource preflight (OPTIONS) requests before they reach auth.
	router.use(
		cors({
			origin: '*',
			methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
			allowedHeaders: ['Authorization', 'Content-Type'],
		})
	)

	// Mount resource routers — each versioned independently
	router.use(createAuthMiddleware(logger, tokenStore))
	router.use(registry.instance.createRestApiRouter(logger))
	router.use(registry.surfaces.createRestApiRouter(logger))

	// Do not allow unknown v2 routes to fall through into the legacy /api router.
	router.use((_req, _res, next) => next(RestApiError.notFound()))

	// Global error handler
	router.use(restApiErrorHandler)

	return router
}

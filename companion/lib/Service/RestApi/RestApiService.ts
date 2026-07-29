import type { DataUserConfig } from '../../Data/UserConfig.js'
import LogController from '../../Log/Controller.js'
import type { AppInfo, Registry } from '../../Registry.js'
import type { UIExpress } from '../../UI/Express.js'
import { REST_API_BASE_PATH } from './constants.js'
import { createRestApiRouter } from './RestApiRouter.js'
import { RestApiTokenStoreMemory } from './RestApiTokenStore.js'

/**
 * Service class that sets up and mounts the REST API.
 * Creates the token store, router, and mounts on the Express app at /api/v2/.
 * Each resource type is versioned independently (e.g. /api/v2/connections/v1/).
 *
 * The REST API is only mounted when `rest_api_enabled` is true at startup.
 * Changing the setting requires a restart of Companion.
 */
export class RestApiService {
	readonly #logger = LogController.createLogger('Service/RestApi')
	readonly tokenStore: RestApiTokenStoreMemory

	constructor(
		registry: Registry,
		_userconfigController: DataUserConfig,
		express: UIExpress,
		appInfo: Pick<AppInfo, 'appVersion'>
	) {
		this.tokenStore = new RestApiTokenStoreMemory()

		// Temporarily use an env var instead of the userconfig

		if (!process.env.EXPERIMENTAL_ENABLE_REST_API) {
			this.#logger.info('Experimental REST API is disabled')
			return
		}

		const restApiRouter = createRestApiRouter(registry, this.tokenStore, appInfo)

		// Mount the REST API router via the setter on UIExpress
		// This is registered at /api/v2 before the existing /api legacy routes
		express.restApiRouter = restApiRouter

		this.#logger.info(`Experimental REST API mounted at ${REST_API_BASE_PATH}/ (resources versioned independently)`)
	}
}

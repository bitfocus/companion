import type { DataUserConfig } from '../../Data/UserConfig.js'
import LogController from '../../Log/Controller.js'
import type { AppInfo, Registry } from '../../Registry.js'
import type { UIExpress } from '../../UI/Express.js'
import { createRestApiRouter } from './RestApiRouter.js'
import { RestApiTokenStoreMemory } from './RestApiTokenStore.js'

/**
 * Service class that sets up and mounts the REST API.
 * Creates the token store, router, and mounts on the Express app at /api/.
 * Each resource type is versioned independently (e.g. /api/connections/v1/).
 *
 * The REST API is only mounted when `rest_api_enabled` is true at startup.
 * Changing the setting requires a restart of Companion.
 */
export class RestApiService {
	readonly #logger = LogController.createLogger('Service/RestApi')
	readonly tokenStore: RestApiTokenStoreMemory

	constructor(
		registry: Registry,
		userconfigController: DataUserConfig,
		express: UIExpress,
		appInfo: Pick<AppInfo, 'appVersion'>
	) {
		this.tokenStore = new RestApiTokenStoreMemory()

		if (!userconfigController.getKey('rest_api_enabled')) {
			this.#logger.info('REST API is disabled (set rest_api_enabled and restart to enable)')
			return
		}

		const restApiRouter = createRestApiRouter(registry, this.tokenStore, appInfo)

		// Mount the REST API router via the setter on UIExpress
		// This is registered at /api before the existing /api legacy routes
		express.restApiRouter = restApiRouter

		this.#logger.info('REST API mounted at /api/ (resources versioned independently)')
	}
}

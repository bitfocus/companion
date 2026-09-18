import { z } from 'zod'
import { API_KEY_SCOPES } from '@companion-app/shared/Model/ApiKeys.js'
import type { DataUserConfig } from '../../Data/UserConfig.js'
import LogController from '../../Log/Controller.js'
import type { AppInfo, Registry } from '../../Registry.js'
import type { UIExpress } from '../../UI/Express.js'
import { publicProcedure, router } from '../../UI/TRPC.js'
import { REST_API_BASE_PATH } from './constants.js'
import { createRestApiRouter } from './RestApiRouter.js'
import { RestApiTokenStore } from './RestApiTokenStore.js'

/**
 * Service class that sets up and mounts the REST API.
 * Creates the token store, router, and mounts on the Express app at /api/v2/.
 * Each resource type is versioned independently (e.g. /api/v2/connections/v1/).
 *
 * The router is always mounted; it gates each request on `rest_api_enabled` internally, so toggling
 * the setting takes effect live without a restart (see createRestApiRouter).
 */
export class RestApiService {
	readonly #logger = LogController.createLogger('Service/RestApi')

	readonly tokenStore: RestApiTokenStore

	constructor(
		registry: Registry,
		userconfig: DataUserConfig,
		express: UIExpress,
		appInfo: Pick<AppInfo, 'appVersion'>
	) {
		this.tokenStore = new RestApiTokenStore(
			LogController.createLogger('Service/RestApi/Tokens'),
			registry.db.getTableView('api_keys')
		)

		express.restApiRouter = createRestApiRouter(registry, userconfig, this.tokenStore, appInfo)
		this.#logger.info(`REST API mounted at ${REST_API_BASE_PATH}/ (resources versioned independently)`)
	}

	createTrpcRouter() {
		const tokenStore = this.tokenStore
		return router({
			list: publicProcedure.query(() => tokenStore.list()),

			create: publicProcedure
				.input(
					z.object({
						name: z.string().min(1).max(100),
						scopes: z.array(z.enum(API_KEY_SCOPES)).min(1),
					})
				)
				.mutation(({ input }) => tokenStore.create(input.name, input.scopes)),

			update: publicProcedure
				.input(
					z.object({
						id: z.string(),
						name: z.string().min(1).max(100),
						scopes: z.array(z.enum(API_KEY_SCOPES)).min(1),
					})
				)
				.mutation(({ input }) => tokenStore.update(input.id, { name: input.name, scopes: input.scopes })),

			delete: publicProcedure.input(z.object({ id: z.string() })).mutation(({ input }) => {
				return tokenStore.delete(input.id)
			}),
		})
	}
}

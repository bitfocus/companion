import Express from 'express'
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
 * The REST API is mounted when `rest_api_enabled` is true. Toggling the setting mounts or unmounts
 * the router live, with no restart required.
 */
export class RestApiService {
	readonly #logger = LogController.createLogger('Service/RestApi')
	readonly #registry: Registry
	readonly #express: UIExpress
	readonly #appInfo: Pick<AppInfo, 'appVersion'>

	readonly tokenStore: RestApiTokenStore

	#mounted = false

	constructor(
		registry: Registry,
		userconfig: DataUserConfig,
		express: UIExpress,
		appInfo: Pick<AppInfo, 'appVersion'>
	) {
		this.#registry = registry
		this.#express = express
		this.#appInfo = appInfo

		this.tokenStore = new RestApiTokenStore(
			LogController.createLogger('Service/RestApi/Tokens'),
			registry.db.getTableView('api_keys')
		)

		this.#setMounted(!!userconfig.getKey('rest_api_enabled'))
	}

	/**
	 * React to a user config change. Mounts or unmounts the REST API router when `rest_api_enabled`
	 * toggles, so the setting takes effect without a restart.
	 */
	updateUserConfig(key: string, value: boolean | number | string): void {
		if (key !== 'rest_api_enabled') return
		this.#setMounted(!!value)
	}

	#setMounted(enabled: boolean): void {
		if (enabled === this.#mounted) return
		this.#mounted = enabled

		if (enabled) {
			this.#express.restApiRouter = createRestApiRouter(this.#registry, this.tokenStore, this.#appInfo)
			this.#logger.info(`REST API mounted at ${REST_API_BASE_PATH}/ (resources versioned independently)`)
		} else {
			// Replace with an empty router, matching UIExpress's default, so /api/v2 stops matching.
			this.#express.restApiRouter = Express.Router()
			this.#logger.info('REST API unmounted')
		}
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

import LogController from '../Log/Controller.js'
import type { ClientSocket, UIHandler } from '../UI/Handler.js'
import type {
	ModuleStoreListCacheEntry,
	ModuleStoreListCacheStore,
	ModuleStoreModuleInfoStore,
	ModuleStoreModuleInfoVersion,
} from '@companion-app/shared/Model/ModulesStore.js'
import type { DataCache } from '../Data/Cache.js'
import semver from 'semver'
import { isModuleApiVersionCompatible } from '@companion-app/shared/ModuleApiVersionCheck.js'
import createClient from 'openapi-fetch'
import type { paths as ModuleStoreOpenApiPaths } from '@companion-app/shared/OpenApi/ModuleStore.js'
import { Complete } from '@companion-module/base/dist/util.js'

const baseUrl = process.env.STAGING_MODULE_API
	? 'https://developer-staging.bitfocus.io/api'
	: 'https://developer.bitfocus.io/api'

const ModuleOpenApiClient = createClient<ModuleStoreOpenApiPaths>({ baseUrl })

const ModuleStoreListRoom = 'module-store:list'
const ModuleStoreInfoRoom = (moduleId: string) => `module-store:info:${moduleId}`

const CacheStoreListKey = 'module_store_list'
const CacheStoreModuleTable = 'module_store'

const SUBSCRIBE_REFRESH_INTERVAL = 1000 * 60 * 60 * 6 // Update when a user subscribes to the data, if older than 6 hours
const LATEST_MODULE_INFO_CACHE_DURATION = 1000 * 60 * 60 * 6 // Cache the latest module info for 6 hours

export class ModuleStoreService {
	readonly #logger = LogController.createLogger('Instance/ModuleStoreService')

	/**
	 */
	readonly #cacheStore: DataCache

	/**
	 * The core interface client
	 */
	readonly #io: UIHandler

	/**
	 */
	#listStore: ModuleStoreListCacheStore

	#infoStore = new Map<string, ModuleStoreModuleInfoStore>()

	constructor(io: UIHandler, cacheStore: DataCache) {
		this.#io = io
		this.#cacheStore = cacheStore

		this.#listStore = cacheStore.getKey(CacheStoreListKey, {
			lastUpdated: 0,
			lastUpdateAttempt: 0,
			updateWarning: null,

			modules: {},
		} satisfies ModuleStoreListCacheStore)

		// HACK: ensure the table exists
		const cloud = cacheStore.store.prepare(
			`CREATE TABLE IF NOT EXISTS ${CacheStoreModuleTable} (id STRING UNIQUE, value STRING);`
		)
		cloud.run()

		this.#infoStore = new Map(Object.entries(cacheStore.getTable(CacheStoreModuleTable) ?? {}))

		// If this is the first time we're running, refresh the store data now
		if (this.#listStore.lastUpdated === 0) {
			setImmediate(() => this.refreshStoreListData())
		}
		// TODO - setup some better interval stuff, so that we can notify the user of updates they can install
	}

	#getCacheEntryForModule(moduleId: string): ModuleStoreModuleInfoStore | null {
		// return this.#cacheStore.getTableKey(CacheStoreModuleTable, moduleId) ?? null
		return this.#infoStore.get(moduleId) ?? null
	}

	/**
	 * Setup a new socket client's events
	 */
	clientConnect(client: ClientSocket): void {
		client.onPromise('modules-store:list:refresh', async () => {
			this.refreshStoreListData()
		})

		client.onPromise('modules-store:list:subscribe', async () => {
			client.join(ModuleStoreListRoom)

			// Check if the data is stale enough to refresh
			if (this.#listStore.lastUpdated < Date.now() - SUBSCRIBE_REFRESH_INTERVAL) {
				this.refreshStoreListData()
			}

			return this.#listStore
		})

		client.onPromise('modules-store:list:unsubscribe', async () => {
			client.leave(ModuleStoreListRoom)
		})

		client.onPromise('modules-store:info:refresh', async (moduleId) => {
			this.#refreshStoreInfoData(moduleId).catch((e) => {
				this.#logger.error(`Failed to refresh store info for module "${moduleId}": ${e}`)
			})
		})

		client.onPromise('modules-store:info:subscribe', async (moduleId) => {
			client.join(ModuleStoreInfoRoom(moduleId))

			const data = this.#getCacheEntryForModule(moduleId)

			// Check if the data is stale enough to refresh
			if (!data || data.lastUpdated < Date.now() - SUBSCRIBE_REFRESH_INTERVAL) {
				this.#refreshStoreInfoData(moduleId).catch((e) => {
					this.#logger.error(`Failed to refresh store info for module "${moduleId}": ${e}`)
				})
			}

			return data
		})

		client.onPromise('modules-store:info:unsubscribe', async (moduleId) => {
			client.leave(ModuleStoreInfoRoom(moduleId))
		})
	}

	getCachedModuleVersionInfo(moduleId: string, versionId: string): ModuleStoreModuleInfoVersion | null {
		const moduleInfo = this.#getCacheEntryForModule(moduleId)

		if (!moduleInfo) return null

		return moduleInfo.versions.find((v) => v.id === versionId) ?? null
	}

	async fetchModuleVersionInfo(
		moduleId: string,
		versionId: string | null,
		onlyCompatible: boolean
	): Promise<ModuleStoreModuleInfoVersion | null> {
		// Use the cached module info
		let moduleInfo = this.#getCacheEntryForModule(moduleId)
		if (!moduleInfo || moduleInfo.lastUpdated < Date.now() - LATEST_MODULE_INFO_CACHE_DURATION) {
			// Assume nothing is cached, as there may be no versions
			moduleInfo = await this.#refreshStoreInfoData(moduleId)
			if (!moduleInfo) return null
		}

		if (versionId) {
			return moduleInfo.versions.find((v) => v.id === versionId) ?? null
		} else {
			return getLatestModuleVersionInfo(moduleInfo.versions, onlyCompatible)
		}
	}

	#isRefreshingStoreData = false
	refreshStoreListData(): void {
		if (this.#isRefreshingStoreData) {
			this.#logger.debug(`Skipping refreshing store module list, already in progress`)
			return
		}
		this.#isRefreshingStoreData = true

		this.#logger.debug(`Refreshing store module list`)

		Promise.resolve()
			.then(async () => {
				this.#io.emitToAll('modules-store:list:progress', 0)

				const { data, error } = await ModuleOpenApiClient.GET('/v1/companion/modules/{moduleType}', {
					params: {
						path: {
							moduleType: 'connection',
						},
					},
				})
				this.#io.emitToAll('modules-store:list:progress', 0.5)

				if (error) throw new Error(`Failed to fetch module list: ${JSON.stringify(error)}`)

				this.#listStore = {
					lastUpdated: Date.now(),
					lastUpdateAttempt: Date.now(),
					updateWarning: null,

					modules: Object.fromEntries(
						data.modules.map((data) => [
							data.id,
							{
								id: data.id,
								name: data.manufacturer + ': ' + data.products.join('; '),
								manufacturer: data.manufacturer,
								shortname: data.shortname,
								products: data.products,
								keywords: data.keywords,

								storeUrl: data.storeUrl,
								githubUrl: data.githubUrl ?? null,
								helpUrl: data.latestHelpUrl ?? null,

								legacyIds: data.legacyIds ?? [],
								deprecationReason: data.deprecationReason ?? null,
							} satisfies Complete<ModuleStoreListCacheEntry>, // Match what the on disk scanner generates
						])
					),
				}
			})
			.catch((e) => {
				// This could be on an always offline system

				this.#logger.warn(`Refreshing store module list failed: ${e?.message ?? e}`)

				this.#listStore.lastUpdateAttempt = Date.now()
				this.#listStore.updateWarning = 'Failed to update the module list from the store'
			})
			.finally(() => {
				this.#cacheStore.setKey(CacheStoreListKey, this.#listStore)

				// Update clients
				this.#io.emitToRoom(ModuleStoreListRoom, 'modules-store:list:data', this.#listStore)
				this.#io.emitToAll('modules-store:list:progress', 1)

				this.#isRefreshingStoreData = false

				this.#logger.debug(`Done refreshing store module list`)
			})
	}

	readonly #isRefreshingStoreInfo = new Set<string>()
	async #refreshStoreInfoData(moduleId: string): Promise<ModuleStoreModuleInfoStore | null> {
		if (this.#isRefreshingStoreInfo.has(moduleId)) {
			this.#logger.debug(`Skipping refreshing store info for module "${moduleId}", already in progress`)
			return null
		}
		// nocommit - create a promise using Promise.withResolvers, store it in the map and return it in the guard above
		this.#isRefreshingStoreInfo.add(moduleId)

		this.#logger.debug(`Refreshing store info for module "${moduleId}"`)

		let moduleData: ModuleStoreModuleInfoStore
		try {
			this.#io.emitToAll('modules-store:info:progress', moduleId, 0)

			const { data, error } = await ModuleOpenApiClient.GET('/v1/companion/modules/{moduleType}/{moduleName}', {
				params: {
					path: {
						moduleType: 'connection',
						moduleName: moduleId,
					},
				},
			})
			this.#io.emitToAll('modules-store:info:progress', moduleId, 0.5)

			if (error) throw new Error(`Failed to fetch module info: ${error?.error ?? JSON.stringify(error)}`)

			moduleData = {
				id: moduleId,
				lastUpdated: Date.now(),
				lastUpdateAttempt: Date.now(),
				updateWarning: null,

				versions: data.versions.map(
					(data) =>
						({
							id: data.id.startsWith('v') ? data.id.slice(1) : data.id,
							releaseChannel: data.isPrerelease ? 'beta' : 'stable',
							releasedAt: data.releasedAt,

							tarUrl: data.tarUrl ?? null,
							tarSha: data.tarSha ?? null,

							deprecationReason: data.deprecationReason ?? null,

							apiVersion: data.apiVersion,

							helpUrl: data.helpUrl ?? null,
						}) satisfies Complete<ModuleStoreModuleInfoVersion>
				),
			}
		} catch (e: any) {
			// This could be on an always offline system

			this.#logger.warn(`Refreshing store info for module "${moduleId}" failed: ${e?.message ?? e}`)

			moduleData = this.#infoStore.get(moduleId) ?? {
				id: moduleId,
				lastUpdated: 0,
				lastUpdateAttempt: Date.now(),
				updateWarning: null,

				versions: [],
			}

			moduleData.lastUpdateAttempt = Date.now()
			moduleData.updateWarning = 'Failed to update the module version list from the store'
		}

		// Store value and update the cache on disk
		this.#infoStore.set(moduleId, moduleData)
		this.#cacheStore.setTableKey(CacheStoreModuleTable, moduleId, moduleData)

		// Update clients
		this.#io.emitToRoom(ModuleStoreInfoRoom(moduleId), 'modules-store:info:data', moduleId, moduleData)
		this.#io.emitToAll('modules-store:info:progress', moduleId, 1)

		this.#isRefreshingStoreInfo.delete(moduleId)

		this.#logger.debug(`Done refreshing store info for module "${moduleId}"`)

		return moduleData
	}
}

function getLatestModuleVersionInfo(
	versions: ModuleStoreModuleInfoVersion[],
	onlyCompatible: boolean
): ModuleStoreModuleInfoVersion | null {
	return versions.reduce<ModuleStoreModuleInfoVersion | null>((latest, version) => {
		if (!version.tarUrl) return latest
		if (version.deprecationReason) return latest
		if (onlyCompatible && !isModuleApiVersionCompatible(version.apiVersion)) return latest
		if (!latest) return version
		if (semver.gt(version.id, latest.id)) return version
		return latest
	}, null)
}

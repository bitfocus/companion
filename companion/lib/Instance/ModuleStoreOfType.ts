import LogController, { Logger } from '../Log/Controller.js'
import type {
	ModuleStoreListCacheEntry,
	ModuleStoreListCacheStore,
	ModuleStoreModuleInfoStore,
	ModuleStoreModuleInfoVersion,
} from '@companion-app/shared/Model/ModulesStore.js'
import type { DataCache, DataCacheDefaultTable } from '../Data/Cache.js'
import semver from 'semver'
import createClient, { Client } from 'openapi-fetch'
import type { paths as ModuleStoreOpenApiPaths } from '@companion-app/shared/OpenApi/ModuleStore.js'
import { Complete } from '@companion-module/base/dist/util.js'
import EventEmitter from 'node:events'
import { DataStoreTableView } from '../Data/StoreBase.js'
import type { AppInfo } from '../Registry.js'
import { toIterable } from '../UI/TRPC.js'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'

const baseUrl = process.env.STAGING_MODULE_API
	? 'https://developer-staging.bitfocus.io/api'
	: 'https://developer.bitfocus.io/api'

const SUBSCRIBE_REFRESH_INTERVAL = 1000 * 60 * 60 * 6 // Update when a user subscribes to the data, if older than 6 hours
const LATEST_MODULE_INFO_CACHE_DURATION = 1000 * 60 * 60 * 6 // Cache the latest module info for 6 hours

export type ModuleStoreServiceEvents = {
	storeListUpdated: [data: ModuleStoreListCacheStore]
	refreshProgress: [moduleId: string | null, percent: number]
	[id: `update:${string}`]: [data: ModuleStoreModuleInfoStore | null]
}

type CacheStoreKey = 'module_store_list' // | 'surface_store_list'

export class ModuleStoreOfTypeService extends EventEmitter<ModuleStoreServiceEvents> {
	readonly #logger: Logger

	readonly #cacheStoreKey: CacheStoreKey
	readonly #cacheStore: DataStoreTableView<DataCacheDefaultTable>
	readonly #cacheTable: DataStoreTableView<Record<string, ModuleStoreModuleInfoStore>>

	readonly #openApiClient: Client<ModuleStoreOpenApiPaths>
	readonly #moduleApiVersion: string
	readonly #isModuleApiVersionCompatible: (version: string) => boolean
	readonly #moduleType: ModuleInstanceType

	/**
	 */
	#listStore: ModuleStoreListCacheStore

	#infoStore = new Map<string, ModuleStoreModuleInfoStore>()

	constructor(
		appInfo: AppInfo,
		cacheStore: DataCache,
		cacheStoreKey: CacheStoreKey,
		cacheTable: DataStoreTableView<Record<string, ModuleStoreModuleInfoStore>>,
		moduleApiVersion: string,
		isModuleApiVersionCompatible: (version: string) => boolean,
		moduleType: ModuleInstanceType
	) {
		super()
		this.setMaxListeners(0)

		this.#logger = LogController.createLogger(`Instance/ModuleStoreService/${moduleType}`)

		this.#cacheStoreKey = cacheStoreKey
		this.#cacheStore = cacheStore.defaultTableView
		this.#cacheTable = cacheTable

		this.#listStore = this.#cacheStore.getOrDefault(this.#cacheStoreKey, {
			lastUpdated: 0,
			lastUpdateAttempt: 0,
			updateWarning: null,

			moduleApiVersion: null,

			modules: {},
		} satisfies ModuleStoreListCacheStore)

		this.#infoStore = new Map(Object.entries(this.#cacheTable.all()))

		this.#openApiClient = createClient<ModuleStoreOpenApiPaths>({
			baseUrl,
			headers: {
				'User-Agent': `Companion ${appInfo.appVersion}`,
				'Companion-App-Build': appInfo.appBuild,
				'Companion-App-Version': appInfo.appVersion,
				'Companion-Machine-Id': appInfo.machineId,
			},
		})

		this.#moduleApiVersion = moduleApiVersion
		this.#isModuleApiVersionCompatible = isModuleApiVersionCompatible
		this.#moduleType = moduleType

		// If this is the first time we're running, refresh the store data now
		if (this.#listStore.lastUpdated === 0 || this.#listStore.moduleApiVersion !== moduleApiVersion) {
			setImmediate(() => this.refreshStoreListData())
		}
		// TODO - setup some better interval stuff, so that we can notify the user of updates they can install
	}

	#getCacheEntryForModule(moduleId: string): ModuleStoreModuleInfoStore | null {
		// return this.#cacheStore.getTableKey(CacheStoreModuleTable, moduleId) ?? null
		return this.#infoStore.get(moduleId) ?? null
	}

	getCachedStoreList(): Record<string, ModuleStoreListCacheEntry> {
		return this.#listStore.modules
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
			return this.getLatestModuleVersionInfo(moduleInfo.versions, onlyCompatible)
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
				this.emit('refreshProgress', null, 0)

				const { data, error } = await this.#openApiClient.GET('/v1/companion/modules/{moduleType}', {
					params: {
						path: {
							moduleType: this.#moduleType as 'connection',
						},
						query: {
							'module-api-version': this.#moduleApiVersion,
						},
					},
				})
				this.emit('refreshProgress', null, 0.5)

				if (error) throw new Error(`Failed to fetch module list: ${JSON.stringify(error)}`)

				this.#listStore = {
					lastUpdated: Date.now(),
					lastUpdateAttempt: Date.now(),
					updateWarning: null,

					moduleApiVersion: this.#moduleApiVersion,

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
				this.#cacheStore.set(this.#cacheStoreKey, this.#listStore)

				this.#isRefreshingStoreData = false

				// Update clients
				this.emit('storeListUpdated', this.#listStore)
				this.emit('refreshProgress', null, 1)

				this.#logger.debug(`Done refreshing store module list`)
			})
	}

	triggerRefreshStoreInfoData(moduleId: string): void {
		this.#refreshStoreInfoData(moduleId).catch((e) => {
			this.#logger.error(`Failed to refresh store info for module "${moduleId}": ${e}`)
		})
	}

	readonly #isRefreshingStoreInfo = new Map<string, Promise<ModuleStoreModuleInfoStore | null>>()
	async #refreshStoreInfoData(moduleId: string): Promise<ModuleStoreModuleInfoStore | null> {
		const inProgress = this.#isRefreshingStoreInfo.get(moduleId)
		if (inProgress) {
			this.#logger.debug(`Skipping refreshing store info for module "${moduleId}", already in progress`)
			return inProgress
		}

		// Create a new promise and store it, so that concurrent calls can wait for the same promise
		const { promise: completePromise, resolve } = Promise.withResolvers<ModuleStoreModuleInfoStore | null>()
		this.#isRefreshingStoreInfo.set(moduleId, completePromise)

		this.#logger.debug(`Refreshing store info for module "${moduleId}"`)

		let moduleData: ModuleStoreModuleInfoStore
		try {
			this.emit('refreshProgress', moduleId, 0)

			const { data, error, response } = await this.#openApiClient.GET(
				'/v1/companion/modules/{moduleType}/{moduleName}',
				{
					params: {
						path: {
							moduleType: this.#moduleType as 'connection',
							moduleName: moduleId,
						},
					},
				}
			)
			this.emit('refreshProgress', moduleId, 0.5)

			if (response.status === 404) {
				// If the store returns 404, then don't throw an error, this is normal
				moduleData = {
					id: moduleId,
					lastUpdated: Date.now(),
					lastUpdateAttempt: Date.now(),
					updateWarning: null,

					versions: [],
				}
			} else {
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
		this.#cacheTable.set(moduleId, moduleData)

		this.#isRefreshingStoreInfo.delete(moduleId)

		// Update clients
		this.emit(`update:${moduleId}`, moduleData)
		this.emit('refreshProgress', moduleId, 1)

		this.#logger.debug(`Done refreshing store info for module "${moduleId}"`)

		// Inform other listeners
		setImmediate(() => resolve(moduleData))

		return moduleData
	}

	getLatestModuleVersionInfo(
		versions: ModuleStoreModuleInfoVersion[],
		onlyCompatible: boolean
	): ModuleStoreModuleInfoVersion | null {
		return versions.reduce<ModuleStoreModuleInfoVersion | null>((latest, version) => {
			if (!version.tarUrl) return latest
			if (version.deprecationReason) return latest
			if (onlyCompatible && !this.#isModuleApiVersionCompatible(version.apiVersion)) return latest
			if (!latest) return version
			if (semver.gt(version.id, latest.id)) return version
			return latest
		}, null)
	}

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	trpcRouterMethods() {
		const self = this
		const selfEmitter: EventEmitter<ModuleStoreServiceEvents> = this

		return {
			watchList: async function* (signal: AbortSignal | undefined) {
				const changes = toIterable(selfEmitter, 'storeListUpdated', signal)

				yield self.#listStore // initial value

				// Check if the data is stale enough to refresh
				if (self.#listStore.lastUpdated < Date.now() - SUBSCRIBE_REFRESH_INTERVAL) {
					self.refreshStoreListData()
				}

				for await (const [change] of changes) {
					yield change
				}
			},

			watchRefreshProgress: async function* (signal: AbortSignal | undefined) {
				const changes = toIterable(selfEmitter, 'refreshProgress', signal)

				for await (const change of changes) {
					yield { moduleId: change[0], percent: change[1] }
				}
			},

			watchModuleInfo: async function* (signal: AbortSignal | undefined, input: { moduleId: string }) {
				const changes = toIterable(selfEmitter, `update:${input.moduleId}`, signal)

				const data = self.#getCacheEntryForModule(input.moduleId)

				// Check if the data is stale enough to refresh
				if (!data || data.lastUpdated < Date.now() - SUBSCRIBE_REFRESH_INTERVAL) {
					self.#refreshStoreInfoData(input.moduleId).catch((e) => {
						self.#logger.error(`Failed to refresh store info for module "${input.moduleId}": ${e}`)
					})
				}

				yield data // initial value

				for await (const [change] of changes) {
					yield change
				}
			},
		}
	}
}

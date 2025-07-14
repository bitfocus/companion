import LogController from '../Log/Controller.js'
import type {
	ModuleStoreListCacheEntry,
	ModuleStoreListCacheStore,
	ModuleStoreModuleInfoStore,
	ModuleStoreModuleInfoVersion,
} from '@companion-app/shared/Model/ModulesStore.js'
import type { DataCache, DataCacheDefaultTable } from '../Data/Cache.js'
import semver from 'semver'
import { isModuleApiVersionCompatible } from '@companion-app/shared/ModuleApiVersionCheck.js'
import createClient, { Client } from 'openapi-fetch'
import type { paths as ModuleStoreOpenApiPaths } from '@companion-app/shared/OpenApi/ModuleStore.js'
import { Complete } from '@companion-module/base/dist/util.js'
import EventEmitter from 'node:events'
import { DataStoreTableView } from '../Data/StoreBase.js'
import type { AppInfo } from '../Registry.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'
import z from 'zod'

const baseUrl = process.env.STAGING_MODULE_API
	? 'https://developer-staging.bitfocus.io/api'
	: 'https://developer.bitfocus.io/api'

const CacheStoreListKey = 'module_store_list'
const CacheStoreModuleTable = 'module_store'

const SUBSCRIBE_REFRESH_INTERVAL = 1000 * 60 * 60 * 6 // Update when a user subscribes to the data, if older than 6 hours
const LATEST_MODULE_INFO_CACHE_DURATION = 1000 * 60 * 60 * 6 // Cache the latest module info for 6 hours

export type ModuleStoreServiceEvents = {
	storeListUpdated: [data: ModuleStoreListCacheStore]
	refreshProgress: [moduleId: string | null, percent: number]
	[id: `update:${string}`]: [data: ModuleStoreModuleInfoStore | null]
}

export class ModuleStoreService extends EventEmitter<ModuleStoreServiceEvents> {
	readonly #logger = LogController.createLogger('Instance/ModuleStoreService')

	readonly #cacheStore: DataStoreTableView<DataCacheDefaultTable>
	readonly #cacheTable: DataStoreTableView<Record<string, ModuleStoreModuleInfoStore>>

	readonly #openApiClient: Client<ModuleStoreOpenApiPaths>

	/**
	 */
	#listStore: ModuleStoreListCacheStore

	#infoStore = new Map<string, ModuleStoreModuleInfoStore>()

	constructor(appInfo: AppInfo, cacheStore: DataCache) {
		super()

		this.#cacheStore = cacheStore.defaultTableView
		this.#cacheTable = cacheStore.getTableView(CacheStoreModuleTable)

		this.#listStore = this.#cacheStore.getOrDefault(CacheStoreListKey, {
			lastUpdated: 0,
			lastUpdateAttempt: 0,
			updateWarning: null,

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

	createTrpcRouter() {
		const self = this
		const selfEmitter: EventEmitter<ModuleStoreServiceEvents> = this

		return router({
			watchList: publicProcedure.subscription(async function* ({ signal }) {
				const changes = toIterable(selfEmitter, 'storeListUpdated', signal)

				yield self.#listStore // initial value

				// Check if the data is stale enough to refresh
				if (self.#listStore.lastUpdated < Date.now() - SUBSCRIBE_REFRESH_INTERVAL) {
					self.refreshStoreListData()
				}

				for await (const [change] of changes) {
					yield change
				}
			}),

			watchRefreshProgress: publicProcedure.subscription(async function* ({ signal }) {
				const changes = toIterable(selfEmitter, 'refreshProgress', signal)

				for await (const change of changes) {
					yield { moduleId: change[0], percent: change[1] }
				}
			}),

			watchModuleInfo: publicProcedure
				.input(
					z.object({
						moduleId: z.string(),
					})
				)
				.subscription(async function* ({ signal, input }) {
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
				}),

			refreshList: publicProcedure.mutation(() => {
				this.refreshStoreListData()
			}),

			refreshModuleInfo: publicProcedure
				.input(
					z.object({
						moduleId: z.string(),
					})
				)
				.mutation(async ({ input }) => {
					this.#refreshStoreInfoData(input.moduleId).catch((e) => {
						this.#logger.error(`Failed to refresh store info for module "${input.moduleId}": ${e}`)
					})
				}),
		})
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
				this.emit('refreshProgress', null, 0)

				const { data, error } = await this.#openApiClient.GET('/v1/companion/modules/{moduleType}', {
					params: {
						path: {
							moduleType: 'connection',
						},
					},
				})
				this.emit('refreshProgress', null, 0.5)

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
				this.#cacheStore.set(CacheStoreListKey, this.#listStore)

				this.#isRefreshingStoreData = false

				// Update clients
				this.emit('storeListUpdated', this.#listStore)
				this.emit('refreshProgress', null, 1)

				this.#logger.debug(`Done refreshing store module list`)
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
							moduleType: 'connection',
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

			console.log('err', e)

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

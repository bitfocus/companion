import LogController from '../Log/Controller.js'
import type { ClientSocket, UIHandler } from '../UI/Handler.js'
import type {
	ModuleStoreListCacheStore,
	ModuleStoreModuleInfoStore,
	ModuleStoreModuleInfoVersion,
} from '@companion-app/shared/Model/ModulesStore.js'
import type { DataCache } from '../Data/Cache.js'
import semver from 'semver'
import { isModuleApiVersionCompatible } from '@companion-app/shared/ModuleApiVersionCheck.js'

const ModuleApiBase = 'https://developer.bitfocus.io/api/v1/companion/modules/connection'

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

				// Simulate a delay
				// await new Promise((resolve) => setTimeout(resolve, 1000))
				this.#io.emitToAll('modules-store:list:progress', 0.2)
				const req = await fetch(ModuleApiBase)
				const jsonData: any = await req.json()
				this.#io.emitToAll('modules-store:list:progress', 0.6)

				// TODO - fetch and transform this from the api once it exists
				this.#listStore = {
					lastUpdated: Date.now(),
					lastUpdateAttempt: Date.now(),
					updateWarning: null,

					modules: Object.fromEntries(
						jsonData.modules.map((data: any) => [
							data.id,
							{ ...data, name: data.manufacturer + ': ' + data.products.join('; ') }, // Match what the on disk scanner generates
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

		let data: ModuleStoreModuleInfoStore
		try {
			this.#io.emitToAll('modules-store:info:progress', moduleId, 0)

			// Simulate a delay
			await new Promise((resolve) => setTimeout(resolve, 1000))
			this.#io.emitToAll('modules-store:info:progress', moduleId, 0.2)
			const req = await fetch(`${ModuleApiBase}/${moduleId}`)
			const jsonData: any = await req.json()
			this.#io.emitToAll('modules-store:info:progress', moduleId, 0.6)

			data = {
				id: moduleId,
				lastUpdated: Date.now(),
				lastUpdateAttempt: Date.now(),
				updateWarning: null,

				versions: jsonData.versions.map((data: any) => ({
					...data,
					id: data.id.startsWith('v') ? data.id.slice(1) : data.id,
				})),
			}
		} catch (e: any) {
			// This could be on an always offline system

			this.#logger.warn(`Refreshing store info for module "${moduleId}" failed: ${e?.message ?? e}`)

			data = this.#infoStore.get(moduleId) ?? {
				id: moduleId,
				lastUpdated: 0,
				lastUpdateAttempt: Date.now(),
				updateWarning: null,

				versions: [],
			}

			data.lastUpdateAttempt = Date.now()
			data.updateWarning = 'Failed to update the module version list from the store'
		}

		// Store value and update the cache on disk
		this.#infoStore.set(moduleId, data)
		this.#cacheStore.setTableKey(CacheStoreModuleTable, moduleId, data)

		// Update clients
		this.#io.emitToRoom(ModuleStoreInfoRoom(moduleId), 'modules-store:info:data', moduleId, data)
		this.#io.emitToAll('modules-store:info:progress', moduleId, 1)

		this.#isRefreshingStoreInfo.delete(moduleId)

		this.#logger.debug(`Done refreshing store info for module "${moduleId}"`)

		return data
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

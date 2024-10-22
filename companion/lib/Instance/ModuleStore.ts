import LogController from '../Log/Controller.js'
import type { ClientSocket, UIHandler } from '../UI/Handler.js'
import type {
	ModuleStoreListCacheEntry,
	ModuleStoreListCacheStore,
	ModuleStoreModuleInfoStore,
	ModuleStoreModuleInfoVersion,
} from '@companion-app/shared/Model/ModulesStore.js'
import type { DataCache } from '../Data/Cache.js'
import { cloneDeep } from 'lodash-es'
import semver from 'semver'

const ModuleStoreListRoom = 'module-store:list'
const ModuleStoreInfoRoom = (moduleId: string) => `module-store:info:${moduleId}`

const CacheStoreListKey = 'module_store_list'
const CacheStoreModuleTable = 'module_store'

const SUBSCRIBE_REFRESH_INTERVAL = 1000 * 60 * 60 * 6 // Update when a user subscribes to the data, if older than 6 hours

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

	async fetchLatestModuleVersionInfo(moduleId: string): Promise<ModuleStoreModuleInfoVersion | null> {
		// Get the cached module info
		const moduleInfo = this.#getCacheEntryForModule(moduleId)
		if (!moduleInfo) return null

		// Assume nothing is cached, as there may be no versions
		const versionData = await this.#refreshStoreInfoData(moduleId)
		if (!versionData) return null

		return getLatestModuleVersionInfo(versionData.versions)
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
				this.#io.emit('modules-store:list:progress', 0)

				// Simulate a delay
				await new Promise((resolve) => setTimeout(resolve, 1000))
				this.#io.emit('modules-store:list:progress', 0.2)
				await new Promise((resolve) => setTimeout(resolve, 2000))
				this.#io.emit('modules-store:list:progress', 0.6)
				await new Promise((resolve) => setTimeout(resolve, 2000))

				// TODO - fetch and transform this from the api once it exists
				this.#listStore = {
					lastUpdated: Date.now(),
					lastUpdateAttempt: Date.now(),
					updateWarning: null,

					modules: cloneDeep(tmpStoreListData),
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
				this.#io.emit('modules-store:list:progress', 1)

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
		this.#isRefreshingStoreInfo.add(moduleId)

		this.#logger.debug(`Refreshing store info for module "${moduleId}"`)

		let data: ModuleStoreModuleInfoStore
		try {
			this.#io.emit('modules-store:info:progress', moduleId, 0)

			// Simulate a delay
			await new Promise((resolve) => setTimeout(resolve, 1000))
			this.#io.emit('modules-store:info:progress', moduleId, 0.2)
			await new Promise((resolve) => setTimeout(resolve, 1000))

			data = {
				id: moduleId,
				lastUpdated: Date.now(),
				lastUpdateAttempt: Date.now(),
				updateWarning: null,

				versions: cloneDeep(tmpStoreVersionsData),
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
		this.#io.emit('modules-store:info:progress', moduleId, 1)

		this.#isRefreshingStoreInfo.delete(moduleId)

		this.#logger.debug(`Done refreshing store info for module "${moduleId}"`)

		return data
	}
}

function getLatestModuleVersionInfo(versions: ModuleStoreModuleInfoVersion[]): ModuleStoreModuleInfoVersion | null {
	return versions.reduce<ModuleStoreModuleInfoVersion | null>((latest, version) => {
		if (!version.tarUrl) return latest
		if (!latest) return version
		if (semver.gt(version.id, latest.id)) return version
		return latest
	}, null)
}

const tmpStoreListData: Record<string, ModuleStoreListCacheEntry> = {
	'bmd-atem': {
		id: 'bmd-atem',
		name: 'Blackmagic: ATEM',
		shortname: 'atem',
		manufacturer: 'Blackmagic Design',
		products: ['ATEM'],
		keywords: ['blackmagic', 'atem', 'switcher'],

		storeUrl: 'https://bitfocus.io/connections/bmd-atem',
		githubUrl: 'https://github.com/bitfocus/companion-module-bmd-atem',

		deprecationReason: null,
	},
}
for (let i = 0; i < 20; i++) {
	tmpStoreListData[`test-module-${i}`] = {
		id: `test-module-${i}`,
		name: `Test Module ${i}`,
		shortname: 'test',
		manufacturer: 'Test Manufacturer',
		products: ['Test Product'],
		keywords: ['test', 'module'],

		storeUrl: 'https://bitfocus.io/connections/test',
		githubUrl: null,

		deprecationReason: null,
	}
}

const tmpStoreVersionsData: ModuleStoreModuleInfoVersion[] = [
	{
		id: '5.4.3',
		isPrerelease: false,
		releasedAt: new Date('2021-01-01').getTime(),
		tarUrl: 'https://builds.julusian.dev/companion-builds/pkg%20(2).tgz',
		apiVersion: '2.0.0',
		deprecationReason: null,
	},
	{
		id: '5.4.2',
		isPrerelease: true,
		releasedAt: new Date('2021-01-01').getTime(),
		tarUrl: 'https://builds.julusian.dev/companion-builds/pkg%20(2).tgz',
		apiVersion: '1.12.0',
		deprecationReason: null,
	},
	{
		id: '5.4.1',
		isPrerelease: true,
		releasedAt: new Date('2021-01-01').getTime(),
		tarUrl: 'https://builds.julusian.dev/companion-builds/pkg%20(2).tgz',
		apiVersion: '1.11.1',
		deprecationReason: null,
	},
	{
		id: '3.14.0',
		isPrerelease: false,
		releasedAt: new Date('2021-01-02').getTime(),
		tarUrl: null,
		apiVersion: '1.0.0',
		deprecationReason: null,
	},
	{
		id: '3.14.1',
		isPrerelease: false,
		releasedAt: new Date('2021-01-02').getTime(),
		tarUrl: 'https://builds.julusian.dev/companion-builds/atem-test-3.14.1.tgz',
		apiVersion: '1.0.0',
		deprecationReason: null,
	},
	{
		id: '3.13.0',
		isPrerelease: false,
		releasedAt: new Date('2021-01-02').getTime(),
		tarUrl: null,
		apiVersion: '0.5.0',
		deprecationReason: null,
	},
]

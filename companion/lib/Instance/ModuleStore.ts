import type {
	ModuleStoreListCacheEntry,
	ModuleStoreListCacheStore,
	ModuleStoreModuleInfoVersion,
} from '@companion-app/shared/Model/ModulesStore.js'
import type { DataCache } from '../Data/Cache.js'
import { isModuleApiVersionCompatible, MODULE_BASE_VERSION } from '@companion-app/shared/ModuleApiVersionCheck.js'
import type { AppInfo } from '../Registry.js'
import { publicProcedure, router } from '../UI/TRPC.js'
import { ModuleInstanceType } from '@companion-app/shared/Model/Connections.js'
import { ModuleStoreOfTypeService } from './ModuleStoreOfType.js'
import EventEmitter from 'events'
import z from 'zod'

export type ModuleStoreServiceEvents = {
	storeListUpdated: [moduleType: ModuleInstanceType, data: ModuleStoreListCacheStore]
}

export class ModuleStoreService extends EventEmitter<ModuleStoreServiceEvents> {
	readonly #instances: Record<ModuleInstanceType, ModuleStoreOfTypeService>

	constructor(appInfo: AppInfo, cacheStore: DataCache) {
		super()
		this.setMaxListeners(0)

		this.#instances = {
			[ModuleInstanceType.Connection]: new ModuleStoreOfTypeService(
				appInfo,
				cacheStore,
				'module_store_list',
				cacheStore.getTableView('module_store'),
				MODULE_BASE_VERSION,
				isModuleApiVersionCompatible,
				ModuleInstanceType.Connection
			),
		}

		this.#instances.connection.on('storeListUpdated', (data) =>
			this.emit('storeListUpdated', ModuleInstanceType.Connection, data)
		)
	}

	#getInstanceForType(type: ModuleInstanceType): ModuleStoreOfTypeService {
		const instance = this.#instances[type]
		if (!instance) throw new Error(`Invalid module type: ${type}`)
		return instance
	}

	createTrpcRouter() {
		const self = this

		return router({
			watchList: publicProcedure
				.input(
					z.object({
						moduleType: z.enum(ModuleInstanceType),
					})
				)
				.subscription(async function* ({ signal, input }) {
					const store = self.#getInstanceForType(input.moduleType)

					yield* store.trpcRouterMethods().watchList(signal)
				}),

			watchRefreshProgress: publicProcedure
				.input(
					z.object({
						moduleType: z.enum(ModuleInstanceType),
					})
				)
				.subscription(async function* ({ signal, input }) {
					const store = self.#getInstanceForType(input.moduleType)

					yield* store.trpcRouterMethods().watchRefreshProgress(signal)
				}),

			watchModuleInfo: publicProcedure
				.input(
					z.object({
						moduleType: z.enum(ModuleInstanceType),
						moduleId: z.string(),
					})
				)
				.subscription(async function* ({ signal, input }) {
					const store = self.#getInstanceForType(input.moduleType)

					yield* store.trpcRouterMethods().watchModuleInfo(signal, input)
				}),

			refreshList: publicProcedure
				.input(
					z.object({
						moduleType: z.enum(ModuleInstanceType),
					})
				)
				.mutation(({ input }) => {
					const store = self.#getInstanceForType(input.moduleType)

					store.refreshStoreListData()
				}),

			refreshModuleInfo: publicProcedure
				.input(
					z.object({
						moduleType: z.enum(ModuleInstanceType),
						moduleId: z.string(),
					})
				)
				.mutation(async ({ input }) => {
					const store = self.#getInstanceForType(input.moduleType)

					store.triggerRefreshStoreInfoData(input.moduleId)
				}),
		})
	}

	getCachedStoreList(moduleType: ModuleInstanceType): Record<string, ModuleStoreListCacheEntry> {
		return this.#getInstanceForType(moduleType).getCachedStoreList()
	}

	getCachedModuleVersionInfo(
		moduleType: ModuleInstanceType,
		moduleId: string,
		versionId: string
	): ModuleStoreModuleInfoVersion | null {
		return this.#getInstanceForType(moduleType).getCachedModuleVersionInfo(moduleId, versionId)
	}

	async fetchModuleVersionInfo(
		moduleType: ModuleInstanceType,
		moduleId: string,
		versionId: string | null,
		onlyCompatible: boolean
	): Promise<ModuleStoreModuleInfoVersion | null> {
		return this.#getInstanceForType(moduleType).fetchModuleVersionInfo(moduleId, versionId, onlyCompatible)
	}
}

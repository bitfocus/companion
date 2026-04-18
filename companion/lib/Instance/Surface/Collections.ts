import type { InstanceConfigStore } from '../ConfigStore.js'
import type { DataDatabase } from '../../Data/Database.js'
import { CollectionsBaseController } from '../../Resources/CollectionsBase.js'
import { publicProcedure, router } from '../../UI/TRPC.js'
import z from 'zod'
import type {
	SurfaceInstanceCollection,
	SurfaceInstanceCollectionData,
} from '@companion-app/shared/Model/SurfaceInstance.js'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'

export class SurfaceInstanceCollections extends CollectionsBaseController<SurfaceInstanceCollectionData> {
	readonly #emitUpdated: () => void

	readonly #configStore: InstanceConfigStore

	constructor(db: DataDatabase, configStore: InstanceConfigStore, emitUpdated: () => void) {
		super(db.getTableView<Record<string, SurfaceInstanceCollection>>('surface_instance_collections'))

		this.#emitUpdated = emitUpdated
		this.#configStore = configStore
	}

	isCollectionEnabled(collectionId: string | null | undefined): boolean {
		if (!collectionId) return true

		const info = this.findCollectionAndParent(collectionId)
		return !!info?.collection.metaData.enabled
	}

	setCollectionEnabled(collectionId: string, enabled: boolean | 'toggle'): void {
		this.collectionModifyMetaData(collectionId, (collection) => {
			if (enabled === 'toggle') {
				collection.metaData.enabled = !collection.metaData.enabled
			} else {
				collection.metaData.enabled = enabled
			}
		})
	}

	/**
	 * Ensure that all collectionIds in surface integrations are valid collections
	 */
	override removeUnknownCollectionReferences(): void {
		this.#configStore.cleanUnknownCollectionIds(ModuleInstanceType.Surface, this.collectAllCollectionIds())
	}

	override emitUpdateUser(_rows: SurfaceInstanceCollection[]): void {
		// Emit event to trigger feedback updates for surface instance collection enabled states
		this.#emitUpdated()
	}

	public createTrpcRouter() {
		return router({
			...super.createTrpcRouterBase(),

			add: publicProcedure.input(z.object({ collectionName: z.string() })).mutation(async ({ input }) => {
				return this.collectionCreate(input.collectionName, {
					enabled: true,
				})
			}),

			setEnabled: publicProcedure
				.input(
					z.object({
						collectionId: z.string(),
						enabled: z.boolean(),
					})
				)
				.mutation(async ({ input }) => {
					this.collectionModifyMetaData(input.collectionId, (collection) => {
						collection.metaData.enabled = input.enabled
					})
				}),
		})
	}
}

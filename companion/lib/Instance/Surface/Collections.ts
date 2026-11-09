import z from 'zod'
import { EnabledCollectionSchema } from '@companion-app/shared/Model/Collections.js'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import type {
	SurfaceInstanceCollection,
	SurfaceInstanceCollectionData,
} from '@companion-app/shared/Model/SurfaceInstance.js'
import type { DataDatabase } from '../../Data/Database.js'
import { EnabledCollectionsBaseController } from '../../Resources/EnabledCollectionsBase.js'
import { publicProcedure, router } from '../../UI/TRPC.js'
import type { InstanceConfigStore } from '../ConfigStore.js'

export class SurfaceInstanceCollections extends EnabledCollectionsBaseController<SurfaceInstanceCollectionData> {
	readonly #emitUpdated: () => void

	readonly #configStore: InstanceConfigStore

	constructor(db: DataDatabase, configStore: InstanceConfigStore, emitUpdated: () => void) {
		super(db.getSchemaTableView('surface_instance_collections', EnabledCollectionSchema))

		this.#emitUpdated = emitUpdated
		this.#configStore = configStore
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
		})
	}
}

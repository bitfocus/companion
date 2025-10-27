import type { OutboundSurfaceCollection, OutboundSurfaceCollectionData } from '@companion-app/shared/Model/Surfaces.js'
import type { DataDatabase } from '../Data/Database.js'
import { EnabledCollectionsBaseController } from '../Resources/EnabledCollectionsBase.js'
import { publicProcedure, router } from '../UI/TRPC.js'
import z from 'zod'

export class OutboundSurfaceCollections extends EnabledCollectionsBaseController<OutboundSurfaceCollectionData> {
	readonly #cleanUnknownCollectionIds: (validCollectionIds: Set<string>) => void
	readonly #emitUpdated: () => void

	constructor(
		db: DataDatabase,
		cleanUnknownCollectionIds: (validCollectionIds: Set<string>) => void,
		emitUpdated: () => void
	) {
		super(db.getTableView<Record<string, OutboundSurfaceCollection>>('surfaces_remote_collections'))

		this.#emitUpdated = emitUpdated
		this.#cleanUnknownCollectionIds = cleanUnknownCollectionIds
	}

	/**
	 * Ensure that all collectionIds in connections are valid collections
	 */
	override removeUnknownCollectionReferences(): void {
		this.#cleanUnknownCollectionIds(this.collectAllCollectionIds())
	}

	override emitUpdateUser(_rows: OutboundSurfaceCollection[]): void {
		// Emit event to trigger feedback updates for connection collection enabled states
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

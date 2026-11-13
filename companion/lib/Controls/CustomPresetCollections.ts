import z from 'zod'
import { EmptyCollectionSchema } from '@companion-app/shared/Model/Collections.js'
import type { CustomPresetCollection } from '@companion-app/shared/Model/CustomPresetModel.js'
import type { DataDatabase } from '../Data/Database.js'
import { CollectionsBaseController } from '../Resources/CollectionsBase.js'
import { publicProcedure, router } from '../UI/TRPC.js'

export class CustomPresetCollections extends CollectionsBaseController<null> {
	readonly #cleanUnknownCollectionIds: (validCollectionIds: ReadonlySet<string>) => void
	readonly #collectionsChanged: () => void

	/**
	 * @param db The database
	 * @param cleanUnknownCollectionIds Removes the collectionId of the custom presets in a collection which is gone
	 * @param collectionsChanged Called when the collections change, as they are the sections of the custom presets
	 */
	constructor(
		db: DataDatabase,
		cleanUnknownCollectionIds: (validCollectionIds: ReadonlySet<string>) => void,
		collectionsChanged: () => void
	) {
		super(db.getSchemaTableView('customPresetCollections', EmptyCollectionSchema))

		this.#cleanUnknownCollectionIds = cleanUnknownCollectionIds
		this.#collectionsChanged = collectionsChanged
	}

	/**
	 * Ensure that all collectionIds in custom presets are valid collections
	 */
	override removeUnknownCollectionReferences(): void {
		this.#cleanUnknownCollectionIds(this.collectAllCollectionIds())
	}

	override emitUpdateUser(_rows: CustomPresetCollection[]): void {
		this.#collectionsChanged()
	}

	createTrpcRouter() {
		return router({
			...super.createTrpcRouterBase(),

			add: publicProcedure.input(z.object({ collectionName: z.string() })).mutation(async ({ input }) => {
				return this.collectionCreate(input.collectionName, null)
			}),
		})
	}
}

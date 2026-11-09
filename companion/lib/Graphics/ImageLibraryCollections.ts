import z from 'zod'
import { EmptyCollectionSchema } from '@companion-app/shared/Model/Collections.js'
import type { ImageLibraryCollection } from '@companion-app/shared/Model/ImageLibraryModel.js'
import type { DataDatabase } from '../Data/Database.js'
import { CollectionsBaseController } from '../Resources/CollectionsBase.js'
import { publicProcedure, router } from '../UI/TRPC.js'

export class ImageLibraryCollections extends CollectionsBaseController<null> {
	readonly #cleanUnknownCollectionIds: (validCollectionIds: ReadonlySet<string>) => void

	constructor(db: DataDatabase, cleanUnknownCollectionIds: (validCollectionIds: ReadonlySet<string>) => void) {
		super(db.getSchemaTableView('image_library_collections', EmptyCollectionSchema))

		this.#cleanUnknownCollectionIds = cleanUnknownCollectionIds
	}

	/**
	 * Ensure that all collectionIds in images are valid collections
	 */
	override removeUnknownCollectionReferences(): void {
		this.#cleanUnknownCollectionIds(this.collectAllCollectionIds())
	}

	override emitUpdateUser(_rows: ImageLibraryCollection[]): void {
		// No-op
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

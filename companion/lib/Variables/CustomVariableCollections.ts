import type { CustomVariableCollection } from '@companion-app/shared/Model/CustomVariableModel.js'
import type { DataDatabase } from '../Data/Database.js'
import { CollectionsBaseController } from '../Resources/CollectionsBase.js'
import { publicProcedure, router } from '../UI/TRPC.js'
import z from 'zod'

export class CustomVariableCollections extends CollectionsBaseController<null> {
	readonly #cleanUnknownCollectionIds: (validCollectionIds: ReadonlySet<string>) => void

	constructor(db: DataDatabase, cleanUnknownCollectionIds: (validCollectionIds: ReadonlySet<string>) => void) {
		super(db.getTableView<Record<string, CustomVariableCollection>>('custom_variable_collections'))

		this.#cleanUnknownCollectionIds = cleanUnknownCollectionIds
	}

	/**
	 * Ensure that all collectionIds in connections are valid collections
	 */
	override removeUnknownCollectionReferences(): void {
		this.#cleanUnknownCollectionIds(this.collectAllCollectionIds())
	}

	override emitUpdateUser(_rows: CustomVariableCollection[]): void {
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

import type { ConnectionCollection, ConnectionCollectionData } from '@companion-app/shared/Model/Connections.js'
import type { InstanceConfigStore } from './ConfigStore.js'
import type { DataDatabase } from '../Data/Database.js'
import { EnabledCollectionsBaseController } from '../Resources/EnabledCollectionsBase.js'
import { publicProcedure, router } from '../UI/TRPC.js'
import z from 'zod'

export class InstanceCollections extends EnabledCollectionsBaseController<ConnectionCollectionData> {
	readonly #emitUpdated: () => void

	readonly #configStore: InstanceConfigStore

	constructor(db: DataDatabase, configStore: InstanceConfigStore, emitUpdated: () => void) {
		super(db.getTableView<Record<string, ConnectionCollection>>('connection_collections'))

		this.#emitUpdated = emitUpdated
		this.#configStore = configStore

		// TODO: remove this soon - fixup existing data
		const fixupCollections = (collections: ConnectionCollection[]) => {
			for (const collection of collections) {
				if (collection.metaData === undefined) {
					collection.metaData = { enabled: true }
				}
				fixupCollections(collection.children || [])
			}
			return collections
		}
		fixupCollections(this.data)

		this.rebuildEnabledCollectionIds()
	}

	/**
	 * Ensure that all collectionIds in connections are valid collections
	 */
	override removeUnknownCollectionReferences(): void {
		this.#configStore.cleanUnknownCollectionIds(this.collectAllCollectionIds())
	}

	override emitUpdateUser(_rows: ConnectionCollection[]): void {
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

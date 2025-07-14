import type { ConnectionCollection, ConnectionCollectionData } from '@companion-app/shared/Model/Connections.js'
import type { ConnectionConfigStore } from './ConnectionConfigStore.js'
import type { DataDatabase } from '../Data/Database.js'
import { CollectionsBaseController } from '../Resources/CollectionsBase.js'
import { publicProcedure, router } from '../UI/TRPC.js'
import z from 'zod'

export class InstanceCollections extends CollectionsBaseController<ConnectionCollectionData> {
	readonly #emitUpdated: () => void

	readonly #configStore: ConnectionConfigStore

	constructor(db: DataDatabase, configStore: ConnectionConfigStore, emitUpdated: () => void) {
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

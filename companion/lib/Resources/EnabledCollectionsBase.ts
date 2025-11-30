import type { CollectionBase } from '@companion-app/shared/Model/Collections.js'
import { CollectionsBaseController } from './CollectionsBase.js'
import type { DataStoreTableView } from '../Data/StoreBase.js'
import { publicProcedure } from '../UI/TRPC.js'
import z from 'zod'

export abstract class EnabledCollectionsBaseController<
	TCollectionMetadata extends { enabled: boolean },
> extends CollectionsBaseController<TCollectionMetadata> {
	#enabledCollectionIds: ReadonlySet<string> = new Set()

	get enabledCollectionIds(): ReadonlySet<string> {
		return this.#enabledCollectionIds
	}

	constructor(dbTable: DataStoreTableView<Record<string, CollectionBase<TCollectionMetadata>>>) {
		super(dbTable)

		this.rebuildEnabledCollectionIds()
	}

	protected emitUpdate(rows: CollectionBase<TCollectionMetadata>[]): void {
		this.rebuildEnabledCollectionIds()

		super.emitUpdate(rows)
	}

	isCollectionEnabled(collectionId: string | null | undefined, onlyDirect = false): boolean {
		if (!collectionId) return true

		if (onlyDirect) {
			const info = this.findCollectionAndParent(collectionId)
			return !!info?.collection.metaData.enabled
		}

		return this.#enabledCollectionIds.has(collectionId)
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

	protected rebuildEnabledCollectionIds(): void {
		const newCollectionIdsSet = new Set<string>()

		const processCollections = (collections: CollectionBase<TCollectionMetadata>[]) => {
			for (const collection of collections) {
				if (collection.metaData?.enabled) {
					newCollectionIdsSet.add(collection.id)
					processCollections(collection.children || [])
				}
			}
		}
		processCollections(this.data)

		this.#enabledCollectionIds = newCollectionIdsSet
	}

	protected createTrpcRouterBase() {
		return {
			...super.createTrpcRouterBase(),

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
		}
	}
}

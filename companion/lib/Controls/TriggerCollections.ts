import type { DataDatabase } from '../Data/Database.js'
import { CollectionsBaseController } from '../Resources/CollectionsBase.js'
import type { TriggerCollection, TriggerCollectionData } from '@companion-app/shared/Model/TriggerModel.js'
import type { TriggerEvents } from './TriggerEvents.js'
import { publicProcedure, router } from '../UI/TRPC.js'
import z from 'zod'

export class TriggerCollections extends CollectionsBaseController<TriggerCollectionData> {
	readonly #events: TriggerEvents

	readonly #cleanUnknownCollectionIds: (validCollectionIds: Set<string>) => void
	readonly #recheckTriggersEnabled: (enabledCollectionIds: ReadonlySet<string>) => void

	#enabledCollectionIds: ReadonlySet<string> = new Set()

	constructor(
		db: DataDatabase,
		events: TriggerEvents,
		cleanUnknownCollectionIds: (validCollectionIds: Set<string>) => void,
		recheckTriggersEnabled: (enabledCollectionIds: ReadonlySet<string>) => void
	) {
		super(db.getTableView<Record<string, TriggerCollection>>('trigger_collections'))

		this.#events = events
		this.#cleanUnknownCollectionIds = cleanUnknownCollectionIds
		this.#recheckTriggersEnabled = recheckTriggersEnabled

		// TODO: remove this soon - fixup existing data
		const fixupCollections = (collections: TriggerCollection[]) => {
			for (const collection of collections) {
				if (collection.metaData === undefined) {
					collection.metaData = { enabled: true }
				}
				fixupCollections(collection.children || [])
			}
			return collections
		}
		fixupCollections(this.data)

		this.#rebuildEnabledCollectionIds()
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

	#rebuildEnabledCollectionIds(): void {
		const newCollectionIdsSet = new Set<string>()

		const processCollections = (collections: TriggerCollection[]) => {
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

	/**
	 * Ensure that all collectionIds in triggers are valid collections
	 */
	override removeUnknownCollectionReferences(): void {
		this.#cleanUnknownCollectionIds(this.collectAllCollectionIds())
	}

	override emitUpdateUser(_rows: TriggerCollection[]): void {
		// Intercept this changed event, to rebuild the enabledCollectionIds set and apply it to the triggers
		this.#rebuildEnabledCollectionIds()
		this.#events.emit('trigger_collections_enabled')
		this.#recheckTriggersEnabled(this.#enabledCollectionIds)
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

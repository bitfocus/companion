import type { DataDatabase } from '../Data/Database.js'
import type { TriggerCollection, TriggerCollectionData } from '@companion-app/shared/Model/TriggerModel.js'
import type { TriggerEvents } from './TriggerEvents.js'
import { publicProcedure, router } from '../UI/TRPC.js'
import z from 'zod'
import { EnabledCollectionsBaseController } from '../Resources/EnabledCollectionsBase.js'

export class TriggerCollections extends EnabledCollectionsBaseController<TriggerCollectionData> {
	readonly #events: TriggerEvents

	readonly #cleanUnknownCollectionIds: (validCollectionIds: Set<string>) => void
	readonly #recheckTriggersEnabled: (enabledCollectionIds: ReadonlySet<string>) => void

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

		this.rebuildEnabledCollectionIds()
	}

	/**
	 * Ensure that all collectionIds in triggers are valid collections
	 */
	override removeUnknownCollectionReferences(): void {
		this.#cleanUnknownCollectionIds(this.collectAllCollectionIds())
	}

	override emitUpdateUser(_rows: TriggerCollection[]): void {
		// Intercept this changed event, to rebuild the enabledCollectionIds set and apply it to the triggers
		this.#events.emit('trigger_collections_enabled')
		this.#recheckTriggersEnabled(this.enabledCollectionIds)
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

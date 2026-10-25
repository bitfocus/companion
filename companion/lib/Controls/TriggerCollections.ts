import z from 'zod'
import { createCollectionSchema, EnabledCollectionDataSchema } from '@companion-app/shared/Model/Collections.js'
import type { TriggerCollection, TriggerCollectionData } from '@companion-app/shared/Model/TriggerModel.js'
import type { DataDatabase } from '../Data/Database.js'
import { EnabledCollectionsBaseController } from '../Resources/EnabledCollectionsBase.js'
import { publicProcedure, router } from '../UI/TRPC.js'
import type { TriggerEvents } from './TriggerEvents.js'

const TriggerCollectionSchema = createCollectionSchema(EnabledCollectionDataSchema)

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
		super(db.getSchemaTableView('trigger_collections', TriggerCollectionSchema))

		this.#events = events
		this.#cleanUnknownCollectionIds = cleanUnknownCollectionIds
		this.#recheckTriggersEnabled = recheckTriggersEnabled
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

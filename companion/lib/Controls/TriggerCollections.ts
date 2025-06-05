import type { UIHandler, ClientSocket } from '../UI/Handler.js'
import type { DataDatabase } from '../Data/Database.js'
import { CollectionsBaseController } from '../Resources/CollectionsBase.js'
import type { TriggerCollection } from '@companion-app/shared/Model/TriggerModel.js'

const TriggerCollectionsRoom = 'trigger-collections'

export class TriggerCollections extends CollectionsBaseController<undefined> {
	readonly #io: UIHandler

	readonly #cleanUnknownCollectionIds: (validCollectionIds: Set<string>) => void

	constructor(io: UIHandler, db: DataDatabase, cleanUnknownCollectionIds: (validCollectionIds: Set<string>) => void) {
		super(db.getTableView<Record<string, TriggerCollection>>('trigger_collections'))

		this.#io = io
		this.#cleanUnknownCollectionIds = cleanUnknownCollectionIds
	}

	/**
	 * Ensure that all collectionIds in triggers are valid collections
	 */
	override removeUnknownCollectionReferences(): void {
		this.#cleanUnknownCollectionIds(this.collectAllCollectionIds())
	}

	override emitUpdate(rows: TriggerCollection[]): void {
		this.#io.emitToRoom(TriggerCollectionsRoom, 'trigger-collections:update', rows)
	}

	/**
	 * Setup a new socket client's events
	 */
	clientConnect(client: ClientSocket): void {
		client.onPromise('trigger-collections:subscribe', () => {
			client.join(TriggerCollectionsRoom)

			return this.data
		})

		client.onPromise('trigger-collections:unsubscribe', () => {
			client.leave(TriggerCollectionsRoom)
		})

		client.onPromise('trigger-collections:add', (collectionName: string) => {
			return this.collectionCreate(
				collectionName,
				undefined // No metadata for trigger collections
			)
		})

		client.onPromise('trigger-collections:remove', this.collectionRemove)
		client.onPromise('trigger-collections:set-name', this.collectionSetName)
		client.onPromise('trigger-collections:reorder', this.collectionMove)
	}
}

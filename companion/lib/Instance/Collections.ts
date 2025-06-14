import type { UIHandler, ClientSocket } from '../UI/Handler.js'
import type { ConnectionCollection } from '@companion-app/shared/Model/Connections.js'
import type { ConnectionConfigStore } from './ConnectionConfigStore.js'
import type { DataDatabase } from '../Data/Database.js'
import { CollectionsBaseController } from '../Resources/CollectionsBase.js'

const ConnectionCollectionsRoom = 'connection-collections'

export class InstanceCollections extends CollectionsBaseController<undefined> {
	readonly #io: UIHandler

	readonly #configStore: ConnectionConfigStore

	constructor(io: UIHandler, db: DataDatabase, configStore: ConnectionConfigStore) {
		super(db.getTableView<Record<string, ConnectionCollection>>('connection_collections'))

		this.#io = io
		this.#configStore = configStore
	}

	/**
	 * Ensure that all collectionIds in connections are valid collections
	 */
	override removeUnknownCollectionReferences(): void {
		this.#configStore.cleanUnknownCollectionIds(this.collectAllCollectionIds())
	}

	override emitUpdate(rows: ConnectionCollection[]): void {
		this.#io.emitToRoom(ConnectionCollectionsRoom, 'connection-collections:update', rows)
	}

	/**
	 * Setup a new socket client's events
	 */
	clientConnect(client: ClientSocket): void {
		client.onPromise('connection-collections:subscribe', () => {
			client.join(ConnectionCollectionsRoom)

			return this.data
		})

		client.onPromise('connection-collections:unsubscribe', () => {
			client.leave(ConnectionCollectionsRoom)
		})

		client.onPromise('connection-collections:add', (collectionName: string) => {
			return this.collectionCreate(
				collectionName,
				undefined // No metadata for connection collections
			)
		})

		client.onPromise('connection-collections:remove', this.collectionRemove)
		client.onPromise('connection-collections:set-name', this.collectionSetName)
		client.onPromise('connection-collections:reorder', this.collectionMove)
	}
}

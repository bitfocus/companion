import type { UIHandler, ClientSocket } from '../UI/Handler.js'
import type { ConnectionCollection } from '@companion-app/shared/Model/Connections.js'
import type { DataDatabase } from '../Data/Database.js'
import { CollectionsBaseController } from '../Resources/CollectionsBase.js'

const ConnectionCollectionsRoom = 'custom-variable-collections'

export class CustomVariableCollections extends CollectionsBaseController<undefined> {
	readonly #io: UIHandler

	readonly #cleanUnknownCollectionIds: (validCollectionIds: ReadonlySet<string>) => void

	constructor(
		io: UIHandler,
		db: DataDatabase,
		cleanUnknownCollectionIds: (validCollectionIds: ReadonlySet<string>) => void
	) {
		super(db.getTableView<Record<string, ConnectionCollection>>('custom_variable_collections'))

		this.#io = io
		this.#cleanUnknownCollectionIds = cleanUnknownCollectionIds
	}

	/**
	 * Ensure that all collectionIds in connections are valid collections
	 */
	override removeUnknownCollectionReferences(): void {
		this.#cleanUnknownCollectionIds(this.collectAllCollectionIds())
	}

	override emitUpdate(rows: ConnectionCollection[]): void {
		this.#io.emitToRoom(ConnectionCollectionsRoom, 'custom-variable-collections:update', rows)
	}

	/**
	 * Setup a new socket client's events
	 */
	clientConnect(client: ClientSocket): void {
		client.onPromise('custom-variable-collections:subscribe', () => {
			client.join(ConnectionCollectionsRoom)

			return this.data
		})

		client.onPromise('custom-variable-collections:unsubscribe', () => {
			client.leave(ConnectionCollectionsRoom)
		})

		client.onPromise('custom-variable-collections:add', (collectionName: string) => {
			return this.collectionCreate(
				collectionName,
				undefined // No metadata for connection collections
			)
		})

		client.onPromise('custom-variable-collections:remove', this.collectionRemove)
		client.onPromise('custom-variable-collections:set-name', this.collectionSetName)
		client.onPromise('custom-variable-collections:reorder', this.collectionMove)
	}
}

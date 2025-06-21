import type { UIHandler, ClientSocket } from '../UI/Handler.js'
import type { ConnectionCollection, ConnectionCollectionData } from '@companion-app/shared/Model/Connections.js'
import type { ConnectionConfigStore } from './ConnectionConfigStore.js'
import type { DataDatabase } from '../Data/Database.js'
import { CollectionsBaseController } from '../Resources/CollectionsBase.js'

const ConnectionCollectionsRoom = 'connection-collections'

export class InstanceCollections extends CollectionsBaseController<ConnectionCollectionData> {
	readonly #io: UIHandler
	readonly #emitUpdated: () => void

	readonly #configStore: ConnectionConfigStore

	constructor(io: UIHandler, db: DataDatabase, configStore: ConnectionConfigStore, emitUpdated: () => void) {
		super(db.getTableView<Record<string, ConnectionCollection>>('connection_collections'))

		this.#io = io
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

	override emitUpdate(rows: ConnectionCollection[]): void {
		this.#io.emitToRoom(ConnectionCollectionsRoom, 'connection-collections:update', rows)

		// Emit event to trigger feedback updates for connection collection enabled states
		this.#emitUpdated()
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
			return this.collectionCreate(collectionName, {
				enabled: true,
			})
		})

		client.onPromise('connection-collections:remove', this.collectionRemove)
		client.onPromise('connection-collections:set-name', this.collectionSetName)
		client.onPromise('connection-collections:reorder', this.collectionMove)
		client.onPromise('connection-collections:set-enabled', (collectionId: string, enabled: boolean) => {
			this.collectionModifyMetaData(collectionId, (collection) => {
				collection.metaData.enabled = enabled
			})
		})
	}
}

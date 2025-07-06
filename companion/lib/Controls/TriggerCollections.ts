import type { UIHandler, ClientSocket } from '../UI/Handler.js'
import type { DataDatabase } from '../Data/Database.js'
import { CollectionsBaseController } from '../Resources/CollectionsBase.js'
import type { TriggerCollection, TriggerCollectionData } from '@companion-app/shared/Model/TriggerModel.js'
import type { TriggerEvents } from './TriggerEvents.js'

const TriggerCollectionsRoom = 'trigger-collections'

export class TriggerCollections extends CollectionsBaseController<TriggerCollectionData> {
	readonly #io: UIHandler
	readonly #events: TriggerEvents

	readonly #cleanUnknownCollectionIds: (validCollectionIds: Set<string>) => void
	readonly #recheckTriggersEnabled: (enabledCollectionIds: ReadonlySet<string>) => void

	#enabledCollectionIds: ReadonlySet<string> = new Set()

	constructor(
		io: UIHandler,
		db: DataDatabase,
		events: TriggerEvents,
		cleanUnknownCollectionIds: (validCollectionIds: Set<string>) => void,
		recheckTriggersEnabled: (enabledCollectionIds: ReadonlySet<string>) => void
	) {
		super(db.getTableView<Record<string, TriggerCollection>>('trigger_collections'))

		this.#io = io
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

	override emitUpdateUser(rows: TriggerCollection[]): void {
		this.#io.emitToRoom(TriggerCollectionsRoom, 'trigger-collections:update', rows)

		// Intercept this changed event, to rebuild the enabledCollectionIds set and apply it to the triggers
		this.#rebuildEnabledCollectionIds()
		this.#events.emit('trigger_collections_enabled')
		this.#recheckTriggersEnabled(this.#enabledCollectionIds)
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
			return this.collectionCreate(collectionName, {
				enabled: true,
			})
		})

		client.onPromise('trigger-collections:remove', this.collectionRemove)
		client.onPromise('trigger-collections:set-name', this.collectionSetName)
		client.onPromise('trigger-collections:reorder', this.collectionMove)

		client.onPromise('trigger-collections:set-enabled', (collectionId: string, enabled: boolean) => {
			this.collectionModifyMetaData(collectionId, (collection) => {
				collection.metaData.enabled = enabled
			})
		})
	}
}

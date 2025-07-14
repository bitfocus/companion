import { observable, action } from 'mobx'
import { assertNever } from '~/util.js'
import type {
	ClientConnectionsUpdate,
	ClientConnectionConfig,
	ConnectionCollection,
	ConnectionCollectionData,
} from '@companion-app/shared/Model/Connections.js'
import type { GenericCollectionsStore } from './GenericCollectionsStore'

export class ConnectionsStore implements GenericCollectionsStore<ConnectionCollectionData> {
	readonly connections = observable.map<string, ClientConnectionConfig>()
	readonly collections = observable.map<string, ConnectionCollection>()

	public get count(): number {
		return this.connections.size
	}

	public get allCollectionIds(): string[] {
		const collectionIds: string[] = []

		const collectCollectionIDs = (collections: Iterable<ConnectionCollection>): void => {
			for (const collection of collections || []) {
				collectionIds.push(collection.id)
				collectCollectionIDs(collection.children)
			}
		}

		collectCollectionIDs(this.collections.values())

		return collectionIds
	}

	public rootCollections(): ConnectionCollection[] {
		return Array.from(this.collections.values()).sort((a, b) => a.sortOrder - b.sortOrder)
	}

	public getInfo(connectionId: string): ClientConnectionConfig | undefined {
		return this.connections.get(connectionId)
	}

	public getLabel(connectionId: string): string | undefined {
		return this.connections.get(connectionId)?.label
	}

	public getAllOfType(moduleType: string): [id: string, info: ClientConnectionConfig][] {
		return Array.from(this.connections.entries()).filter(([_id, info]) => info && info.instance_type === moduleType)
	}

	public updateConnections = action((changes: ClientConnectionsUpdate[] | null) => {
		if (!changes) {
			this.connections.clear()
			return
		}

		for (const change of changes) {
			const changeType = change.type
			switch (change.type) {
				case 'init':
					this.connections.replace(change.info)
					break
				case 'remove':
					this.connections.delete(change.id)
					break
				case 'update': {
					this.connections.set(change.id, change.info)
					break
				}
				default:
					console.error(`Unknown connection change: ${changeType}`)
					assertNever(change)
					break
			}
		}
	})

	public resetCollections = action((newData: ConnectionCollection[] | null) => {
		this.collections.clear()

		if (newData) {
			for (const collection of newData) {
				if (!collection) continue

				this.collections.set(collection.id, collection)
			}
		}
	})

	// public applyGroupsChange = action((changes: ConnectionGroupsUpdate[]) => {
	// 	for (const change of changes) {
	// 		const changeType = change.type
	// 		switch (change.type) {
	// 			case 'remove':
	// 				this.groups.delete(change.id)
	// 				break
	// 			case 'update': {
	// 				this.groups.set(change.id, change.info)
	// 				break
	// 			}
	// 			default:
	// 				console.error(`Unknown connection groups change: ${changeType}`)
	// 				assertNever(change)
	// 				break
	// 		}
	// 	}
	// })
}

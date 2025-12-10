import { observable, action } from 'mobx'
import { assertNever } from '~/Resources/util.js'
import type {
	ClientConnectionsUpdate,
	ClientConnectionConfig,
	ConnectionCollection,
	ConnectionCollectionData,
} from '@companion-app/shared/Model/Connections.js'
import type { GenericCollectionsStore } from './GenericCollectionsStore'
import { updateObjectInPlace } from './ApplyDiffToMap'

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

	public getAllOfModuleId(moduleId: string): [id: string, info: ClientConnectionConfig][] {
		return Array.from(this.connections.entries()).filter(([_id, info]) => info && info.moduleId === moduleId)
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
					const existing = this.connections.get(change.id)
					if (existing) {
						updateObjectInPlace(existing, change.info)
					} else {
						this.connections.set(change.id, change.info)
					}
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

				const existing = this.collections.get(collection.id)
				if (existing) {
					updateObjectInPlace(existing, collection)
				} else {
					this.collections.set(collection.id, collection)
				}
			}
		}
	})

	public sortedConnections(): ClientConnectionConfig[] {
		const sortedConnections = Array.from(this.connections.values())

		// Build an ordered list of collection ids following collection sortOrder
		const orderedCollectionIds: string[] = []
		const pushCollection = (col: any) => {
			orderedCollectionIds.push(col.id)
			if (col.children && col.children.length > 0) {
				const children = Array.from(col.children).sort((a: any, b: any) => a.sortOrder - b.sortOrder)
				for (const c of children) pushCollection(c)
			}
		}

		for (const root of this.rootCollections()) pushCollection(root)

		const collectionIndex = new Map(orderedCollectionIds.map((id, i) => [id, i]))

		// Sort by collection ordering, then by connection sortOrder, then by label/id
		sortedConnections.sort((aInfo, bInfo) => {
			const aColIdx = aInfo.collectionId
				? (collectionIndex.get(aInfo.collectionId) ?? Number.POSITIVE_INFINITY)
				: Number.POSITIVE_INFINITY
			const bColIdx = bInfo.collectionId
				? (collectionIndex.get(bInfo.collectionId) ?? Number.POSITIVE_INFINITY)
				: Number.POSITIVE_INFINITY
			if (aColIdx !== bColIdx) return aColIdx - bColIdx

			const aOrder = aInfo.sortOrder
			const bOrder = bInfo.sortOrder
			if (aOrder !== bOrder) return aOrder - bOrder

			const aLabel = aInfo.label || aInfo.id
			const bLabel = bInfo.label || bInfo.id
			return String(aLabel).localeCompare(String(bLabel))
		})

		return sortedConnections
	}
}

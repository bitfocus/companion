import { observable, action } from 'mobx'
import { assertNever } from '~/Resources/util.js'
import type { GenericCollectionsStore } from './GenericCollectionsStore'
import { updateObjectInPlace } from './ApplyDiffToMap'
import type {
	ClientSurfaceInstanceConfig,
	ClientSurfaceInstancesUpdate,
	SurfaceInstanceCollection,
	SurfaceInstanceCollectionData,
} from '@companion-app/shared/Model/SurfaceInstance.js'

export class SurfaceInstancesStore implements GenericCollectionsStore<SurfaceInstanceCollectionData> {
	readonly instances = observable.map<string, ClientSurfaceInstanceConfig>()
	readonly collections = observable.map<string, SurfaceInstanceCollection>()

	public get count(): number {
		return this.instances.size
	}

	public get allCollectionIds(): string[] {
		const collectionIds: string[] = []

		const collectCollectionIDs = (collections: Iterable<SurfaceInstanceCollection>): void => {
			for (const collection of collections || []) {
				collectionIds.push(collection.id)
				collectCollectionIDs(collection.children)
			}
		}

		collectCollectionIDs(this.collections.values())

		return collectionIds
	}

	public rootCollections(): SurfaceInstanceCollection[] {
		return Array.from(this.collections.values()).sort((a, b) => a.sortOrder - b.sortOrder)
	}

	public getInfo(instanceId: string): ClientSurfaceInstanceConfig | undefined {
		return this.instances.get(instanceId)
	}

	public getLabel(instanceId: string): string | undefined {
		return this.instances.get(instanceId)?.label
	}

	public getAllOfModuleId(moduleId: string): [id: string, info: ClientSurfaceInstanceConfig][] {
		return Array.from(this.instances.entries()).filter(([_id, info]) => info && info.moduleId === moduleId)
	}

	public updateInstances = action((changes: ClientSurfaceInstancesUpdate[] | null) => {
		if (!changes) {
			this.instances.clear()
			return
		}

		for (const change of changes) {
			const changeType = change.type
			switch (change.type) {
				case 'init':
					this.instances.replace(change.info)
					break
				case 'remove':
					this.instances.delete(change.id)
					break
				case 'update': {
					const existing = this.instances.get(change.id)
					if (existing) {
						updateObjectInPlace(existing, change.info)
					} else {
						this.instances.set(change.id, change.info)
					}
					break
				}
				default:
					console.error(`Unknown instance change: ${changeType}`)
					assertNever(change)
					break
			}
		}
	})

	public resetCollections = action((newData: SurfaceInstanceCollection[] | null) => {
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
}

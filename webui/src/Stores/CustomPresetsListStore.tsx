import { action, observable } from 'mobx'
import type { CustomPresetControlId } from '@companion-app/shared/ControlId.js'
import { applyObjectPatch } from '@companion-app/shared/Diff.js'
import type {
	ClientCustomPresetData,
	CustomPresetCollection,
	CustomPresetsUpdate,
} from '@companion-app/shared/Model/CustomPresetModel.js'
import { assertNever } from '~/Resources/util'

export class CustomPresetsListStore {
	readonly customPresets = observable.map<CustomPresetControlId, ClientCustomPresetData>()
	readonly collections = observable.map<string, CustomPresetCollection>()

	public updateDefinitions = action((change: CustomPresetsUpdate | null) => {
		if (!change) {
			this.customPresets.clear()
			return
		}

		const changeType = change.type
		switch (change.type) {
			case 'init':
				this.customPresets.replace(change.customPresets)
				break
			case 'add':
				this.customPresets.set(change.controlId, change.info)
				break
			case 'remove':
				this.customPresets.delete(change.controlId)
				break
			case 'update': {
				const oldObj = this.customPresets.get(change.controlId)
				if (!oldObj) throw new Error(`Got update for unknown custom preset: ${change.controlId}`)
				this.customPresets.set(change.controlId, applyObjectPatch(oldObj, change.patch))
				break
			}
			default:
				console.error(`Unknown custom preset change: ${changeType}`)
				assertNever(change)
				break
		}
	})

	public get allCollectionIds(): string[] {
		const collectionIds: string[] = []

		const collectCollectionIds = (collections: Iterable<CustomPresetCollection>): void => {
			for (const collection of collections || []) {
				collectionIds.push(collection.id)
				collectCollectionIds(collection.children)
			}
		}

		collectCollectionIds(this.collections.values())

		return collectionIds
	}

	public rootCollections(): CustomPresetCollection[] {
		return Array.from(this.collections.values()).sort((a, b) => a.sortOrder - b.sortOrder)
	}

	public resetCollections = action((newData: CustomPresetCollection[] | null) => {
		this.collections.clear()

		if (newData) {
			for (const collection of newData) {
				if (!collection) continue

				this.collections.set(collection.id, collection)
			}
		}
	})
}

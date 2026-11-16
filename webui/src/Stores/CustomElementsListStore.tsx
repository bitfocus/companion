import { action, observable } from 'mobx'
import type { CustomElementControlId } from '@companion-app/shared/ControlId.js'
import { applyObjectPatch } from '@companion-app/shared/Diff.js'
import type {
	ClientCustomElementData,
	CustomElementCollection,
	CustomElementsUpdate,
} from '@companion-app/shared/Model/CustomElementModel.js'
import { assertNever } from '~/Resources/util'

export class CustomElementsListStore {
	readonly customElements = observable.map<CustomElementControlId, ClientCustomElementData>()
	readonly collections = observable.map<string, CustomElementCollection>()

	public updateDefinitions = action((change: CustomElementsUpdate | null) => {
		if (!change) {
			this.customElements.clear()
			return
		}

		const changeType = change.type
		switch (change.type) {
			case 'init':
				this.customElements.replace(change.customElements)
				break
			case 'add':
				this.customElements.set(change.controlId, change.info)
				break
			case 'remove':
				this.customElements.delete(change.controlId)
				break
			case 'update': {
				const oldObj = this.customElements.get(change.controlId)
				if (!oldObj) throw new Error(`Got update for unknown custom element: ${change.controlId}`)
				this.customElements.set(change.controlId, applyObjectPatch(oldObj, change.patch))
				break
			}
			default:
				console.error(`Unknown custom element change: ${changeType}`)
				assertNever(change)
				break
		}
	})

	public get allCollectionIds(): string[] {
		const collectionIds: string[] = []

		const collectCollectionIds = (collections: Iterable<CustomElementCollection>): void => {
			for (const collection of collections || []) {
				collectionIds.push(collection.id)
				collectCollectionIds(collection.children)
			}
		}

		collectCollectionIds(this.collections.values())

		return collectionIds
	}

	public rootCollections(): CustomElementCollection[] {
		return Array.from(this.collections.values()).sort((a, b) => a.sortOrder - b.sortOrder)
	}

	public resetCollections = action((newData: CustomElementCollection[] | null) => {
		this.collections.clear()

		if (newData) {
			for (const collection of newData) {
				if (!collection) continue

				this.collections.set(collection.id, collection)
			}
		}
	})
}

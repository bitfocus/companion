import { applyPatch } from 'fast-json-patch'
import { action, observable } from 'mobx'
import type {
	ClientCustomActionData,
	CustomActionCollection,
	CustomActionsUpdate,
} from '@companion-app/shared/Model/CustomActionModel.js'
import { assertNever } from '~/Resources/util'

export class CustomActionsListStore {
	readonly customActions = observable.map<string, ClientCustomActionData>()
	readonly collections = observable.map<string, CustomActionCollection>()

	public updateDefinitions = action((change: CustomActionsUpdate | null) => {
		if (!change) {
			this.customActions.clear()
			return
		}

		const changeType = change.type
		switch (change.type) {
			case 'init':
				this.customActions.replace(change.customActions)
				break
			case 'add':
				this.customActions.set(change.controlId, change.info)
				break
			case 'remove':
				this.customActions.delete(change.controlId)
				break
			case 'update': {
				const oldObj = this.customActions.get(change.controlId)
				if (!oldObj) throw new Error(`Got update for unknown custom action: ${change.controlId}`)
				const newObj = applyPatch(oldObj, change.patch, false, true)
				this.customActions.set(change.controlId, newObj.newDocument)
				break
			}
			default:
				console.error(`Unknown custom action change: ${changeType}`)
				assertNever(change)
				break
		}
	})

	public get allCollectionIds(): string[] {
		const collectionIds: string[] = []

		const collectCollectionIds = (collections: Iterable<CustomActionCollection>): void => {
			for (const collection of collections || []) {
				collectionIds.push(collection.id)
				collectCollectionIds(collection.children)
			}
		}

		collectCollectionIds(this.collections.values())

		return collectionIds
	}

	public rootCollections(): CustomActionCollection[] {
		return Array.from(this.collections.values()).sort((a, b) => a.sortOrder - b.sortOrder)
	}

	public resetCollections = action((newData: CustomActionCollection[] | null) => {
		this.collections.clear()

		if (newData) {
			for (const collection of newData) {
				if (!collection) continue

				this.collections.set(collection.id, collection)
			}
		}
	})
}

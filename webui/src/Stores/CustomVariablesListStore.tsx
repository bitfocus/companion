import { action, observable } from 'mobx'
import { assertNever } from '~/util.js'
import { applyPatch } from 'fast-json-patch'
import { cloneDeep } from 'lodash-es'
import type {
	ClientCustomVariableData,
	CustomVariableCollection,
	CustomVariableUpdate2,
} from '@companion-app/shared/Model/CustomVariableModel.js'

export class CustomVariablesListStore {
	readonly customVariables = observable.map<string, ClientCustomVariableData>()
	readonly collections = observable.map<string, CustomVariableCollection>()

	public updateDefinitions = action((change: CustomVariableUpdate2 | null) => {
		if (!change) {
			this.customVariables.clear()
			return
		}

		const changeType = change.type
		switch (change.type) {
			case 'init':
				this.customVariables.replace(change.variables)
				break
			case 'add':
				this.customVariables.set(change.controlId, change.info)
				break
			case 'remove':
				this.customVariables.delete(change.controlId)
				break
			case 'update': {
				const oldObj = this.customVariables.get(change.controlId)
				if (!oldObj) throw new Error(`Got update for unknown CustomVariable: ${change.controlId}`)
				const newObj = applyPatch(cloneDeep(oldObj), change.patch)
				this.customVariables.set(change.controlId, newObj.newDocument)
				break
			}
			default:
				console.error(`Unknown CustomVariable change: ${changeType}`)
				assertNever(change)
				break
		}
	})

	public get allCollectionIds(): string[] {
		const collectionIds: string[] = []

		const collectCollectionIds = (collections: Iterable<CustomVariableCollection>): void => {
			for (const collection of collections || []) {
				collectionIds.push(collection.id)
				collectCollectionIds(collection.children)
			}
		}

		collectCollectionIds(this.collections.values())

		return collectionIds
	}

	public rootCollections(): CustomVariableCollection[] {
		return Array.from(this.collections.values()).sort((a, b) => a.sortOrder - b.sortOrder)
	}

	public resetCollections = action((newData: CustomVariableCollection[] | null) => {
		this.collections.clear()

		if (newData) {
			for (const collection of newData) {
				if (!collection) continue

				this.collections.set(collection.id, collection)
			}
		}
	})
}

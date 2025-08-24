import { action, observable } from 'mobx'
import { assertNever } from '~/Resources/util'
import { applyPatch } from 'fast-json-patch'
import { cloneDeep } from 'lodash-es'
import type {
	ClientComputedVariableData,
	ComputedVariableCollection,
	ComputedVariableUpdate,
} from '@companion-app/shared/Model/ComputedVariableModel.js'

export class ComputedVariablesListStore {
	readonly computedVariables = observable.map<string, ClientComputedVariableData>()
	readonly collections = observable.map<string, ComputedVariableCollection>()

	public updateDefinitions = action((change: ComputedVariableUpdate | null) => {
		if (!change) {
			this.computedVariables.clear()
			return
		}

		const changeType = change.type
		switch (change.type) {
			case 'init':
				this.computedVariables.replace(change.variables)
				break
			case 'add':
				this.computedVariables.set(change.controlId, change.info)
				break
			case 'remove':
				this.computedVariables.delete(change.controlId)
				break
			case 'update': {
				const oldObj = this.computedVariables.get(change.controlId)
				if (!oldObj) throw new Error(`Got update for unknown ComputedVariable: ${change.controlId}`)
				const newObj = applyPatch(cloneDeep(oldObj), change.patch)
				this.computedVariables.set(change.controlId, newObj.newDocument)
				break
			}
			default:
				console.error(`Unknown ComputedVariable change: ${changeType}`)
				assertNever(change)
				break
		}
	})

	public get allCollectionIds(): string[] {
		const collectionIds: string[] = []

		const collectCollectionIds = (collections: Iterable<ComputedVariableCollection>): void => {
			for (const collection of collections || []) {
				collectionIds.push(collection.id)
				collectCollectionIds(collection.children)
			}
		}

		collectCollectionIds(this.collections.values())

		return collectionIds
	}

	public rootCollections(): ComputedVariableCollection[] {
		return Array.from(this.collections.values()).sort((a, b) => a.sortOrder - b.sortOrder)
	}

	public resetCollections = action((newData: ComputedVariableCollection[] | null) => {
		this.collections.clear()

		if (newData) {
			for (const collection of newData) {
				if (!collection) continue

				this.collections.set(collection.id, collection)
			}
		}
	})
}

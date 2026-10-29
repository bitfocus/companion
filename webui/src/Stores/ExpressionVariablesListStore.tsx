import { action, observable } from 'mobx'
import { applyObjectPatch } from '@companion-app/shared/Diff.js'
import type {
	ClientExpressionVariableData,
	ExpressionVariableCollection,
	ExpressionVariableUpdate,
} from '@companion-app/shared/Model/ExpressionVariableModel.js'
import { assertNever } from '~/Resources/util'

export class ExpressionVariablesListStore {
	readonly expressionVariables = observable.map<string, ClientExpressionVariableData>()
	readonly collections = observable.map<string, ExpressionVariableCollection>()

	public updateDefinitions = action((change: ExpressionVariableUpdate | null) => {
		if (!change) {
			this.expressionVariables.clear()
			return
		}

		const changeType = change.type
		switch (change.type) {
			case 'init':
				this.expressionVariables.replace(change.variables)
				break
			case 'add':
				this.expressionVariables.set(change.controlId, change.info)
				break
			case 'remove':
				this.expressionVariables.delete(change.controlId)
				break
			case 'update': {
				const oldObj = this.expressionVariables.get(change.controlId)
				if (!oldObj) throw new Error(`Got update for unknown ExpressionVariable: ${change.controlId}`)
				this.expressionVariables.set(change.controlId, applyObjectPatch(oldObj, change.patch))
				break
			}
			default:
				console.error(`Unknown ExpressionVariable change: ${changeType}`)
				assertNever(change)
				break
		}
	})

	public get allCollectionIds(): string[] {
		const collectionIds: string[] = []

		const collectCollectionIds = (collections: Iterable<ExpressionVariableCollection>): void => {
			for (const collection of collections || []) {
				collectionIds.push(collection.id)
				collectCollectionIds(collection.children)
			}
		}

		collectCollectionIds(this.collections.values())

		return collectionIds
	}

	public rootCollections(): ExpressionVariableCollection[] {
		return Array.from(this.collections.values()).sort((a, b) => a.sortOrder - b.sortOrder)
	}

	public resetCollections = action((newData: ExpressionVariableCollection[] | null) => {
		this.collections.clear()

		if (newData) {
			for (const collection of newData) {
				if (!collection) continue

				this.collections.set(collection.id, collection)
			}
		}
	})
}

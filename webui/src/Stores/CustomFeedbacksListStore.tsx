import { action, observable } from 'mobx'
import { applyObjectPatch } from '@companion-app/shared/Diff.js'
import type {
	ClientCustomFeedbackData,
	CustomFeedbackCollection,
	CustomFeedbacksUpdate,
} from '@companion-app/shared/Model/CustomFeedbackModel.js'
import { assertNever } from '~/Resources/util'

export class CustomFeedbacksListStore {
	readonly customFeedbacks = observable.map<string, ClientCustomFeedbackData>()
	readonly collections = observable.map<string, CustomFeedbackCollection>()

	public updateDefinitions = action((change: CustomFeedbacksUpdate | null) => {
		if (!change) {
			this.customFeedbacks.clear()
			return
		}

		const changeType = change.type
		switch (change.type) {
			case 'init':
				this.customFeedbacks.replace(change.customFeedbacks)
				break
			case 'add':
				this.customFeedbacks.set(change.controlId, change.info)
				break
			case 'remove':
				this.customFeedbacks.delete(change.controlId)
				break
			case 'update': {
				const oldObj = this.customFeedbacks.get(change.controlId)
				if (!oldObj) throw new Error(`Got update for unknown custom feedback: ${change.controlId}`)
				this.customFeedbacks.set(change.controlId, applyObjectPatch(oldObj, change.patch))
				break
			}
			default:
				console.error(`Unknown custom feedback change: ${changeType}`)
				assertNever(change)
				break
		}
	})

	public get allCollectionIds(): string[] {
		const collectionIds: string[] = []

		const collectCollectionIds = (collections: Iterable<CustomFeedbackCollection>): void => {
			for (const collection of collections || []) {
				collectionIds.push(collection.id)
				collectCollectionIds(collection.children)
			}
		}

		collectCollectionIds(this.collections.values())

		return collectionIds
	}

	public rootCollections(): CustomFeedbackCollection[] {
		return Array.from(this.collections.values()).sort((a, b) => a.sortOrder - b.sortOrder)
	}

	public resetCollections = action((newData: CustomFeedbackCollection[] | null) => {
		this.collections.clear()

		if (newData) {
			for (const collection of newData) {
				if (!collection) continue

				this.collections.set(collection.id, collection)
			}
		}
	})
}

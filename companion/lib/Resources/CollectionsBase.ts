import type { DataStoreTableView } from '../Data/StoreBase.js'
import { nanoid } from 'nanoid'
import type { CollectionBase } from '@companion-app/shared/Model/Collections.js'

export abstract class CollectionsBaseController<TCollectionMetadata> {
	readonly #dbTable: DataStoreTableView<Record<string, CollectionBase<TCollectionMetadata>>>

	protected data: CollectionBase<TCollectionMetadata>[]

	constructor(dbTable: DataStoreTableView<Record<string, CollectionBase<TCollectionMetadata>>>) {
		this.#dbTable = dbTable

		// Note: Storing in the database like this is not optimal, but it is much simpler
		this.data = Object.values(this.#dbTable.all()).sort((a, b) => a.sortOrder - b.sortOrder)
		for (const data of this.data) {
			data.children = data.children || []
			data.children.sort((a, b) => a.sortOrder - b.sortOrder)
		}
	}

	/**
	 * Discard all collections and put all items back to be loose at the root
	 */
	discardAllCollections(): void {
		this.#dbTable.clear()

		this.data = []

		this.emitUpdate([])

		this.removeUnknownCollectionReferences()
	}

	protected abstract emitUpdate(rows: CollectionBase<TCollectionMetadata>[]): void

	/**
	 * Ensure that all collectionIds in the data are valid collections
	 */
	abstract removeUnknownCollectionReferences(): void

	/**
	 * Get a set of all the known collection ids
	 */
	public collectAllCollectionIds(): Set<string> {
		const collectionIds = new Set<string>()

		const collectCollectionIds = (collections: CollectionBase<TCollectionMetadata>[]) => {
			for (const collection of collections) {
				collectionIds.add(collection.id)
				collectCollectionIds(collection.children)
			}
		}

		collectCollectionIds(this.data)

		return collectionIds
	}

	/**
	 * Check if a collection contains another collection
	 * @param collection The collection to search
	 * @param otherCollectionId The collection id to search for
	 * @returns
	 */
	#doesCollectionContainOtherCollection(
		collection: CollectionBase<TCollectionMetadata>,
		otherCollectionId: string
	): boolean {
		if (collection.id === otherCollectionId) return true // Direct match

		// Check if any of the children contain the other collection
		for (const child of collection.children) {
			if (this.#doesCollectionContainOtherCollection(child, otherCollectionId)) {
				return true
			}
		}

		return false
	}

	/**
	 * Check if a collection id exists in the hierarchy
	 * @param collectionId The collection id to check
	 * @returns true if the collection id exists, false otherwise
	 */
	public doesCollectionIdExist(collectionId: string | null | undefined): boolean {
		if (!collectionId) return true
		return !!this.findCollectionAndParent(collectionId)
	}

	protected get collectionData(): CollectionBase<TCollectionMetadata>[] {
		return this.data
	}

	protected collectionCreate = (label: string, metaData: TCollectionMetadata) => {
		const lastCollection = this.data[this.data.length - 1] as CollectionBase<TCollectionMetadata> | undefined

		const newId = nanoid()
		const newCollection: CollectionBase<TCollectionMetadata> = {
			id: newId,
			label,
			sortOrder: lastCollection ? lastCollection.sortOrder + 1 : 0,
			children: [],
			metaData,
		}

		this.data.push(newCollection)
		this.#dbTable.set(newId, newCollection)

		this.emitUpdate(this.data)

		return newId
	}

	protected collectionRemove = (collectionId: string) => {
		const matchedCollection = this.findCollectionAndParent(collectionId)
		if (!matchedCollection) return

		if (!matchedCollection.parentCollection) {
			const collection = matchedCollection.collection

			const index = this.data.findIndex((child) => child.id === collection.id)
			if (index === -1) {
				throw new Error(`Collection ${collectionId} not found at root level`)
			}

			this.data.splice(index, 1, ...collection.children) // Remove the collection, and rehome its children
			this.data.forEach((child, i) => {
				child.sortOrder = i // Reset sortOrder for children
			})

			// Update the database
			this.#dbTable.delete(collectionId)
			for (const child of collection.children) {
				this.#dbTable.set(child.id, child)
			}
		} else {
			// The collection exists, depeer in the hierarchy
			const { rootCollection, parentCollection, collection } = matchedCollection

			const index = parentCollection.children.findIndex((child) => child.id === collection.id)
			if (index === -1) {
				throw new Error(`Collection ${collectionId} not found in parent ${parentCollection.id}`)
			}

			parentCollection.children.splice(index, 1, ...collection.children) // Remove the collection, and rehome its children
			parentCollection.children.forEach((child, i) => {
				child.sortOrder = i // Reset sortOrder for children
			})

			this.#dbTable.set(rootCollection.id, rootCollection)
		}

		// Inform the ui of the shuffle
		this.emitUpdate(this.data)

		// Ensure any items are moved back to the default collection
		this.removeUnknownCollectionReferences()
	}

	protected collectionSetName = (collectionId: string, collectionName: string) => {
		const matchedCollection = this.findCollectionAndParent(collectionId)
		if (!matchedCollection) throw new Error(`Collection ${collectionId} not found`)

		matchedCollection.collection.label = collectionName
		this.#dbTable.set(matchedCollection.rootCollection.id, matchedCollection.rootCollection)

		// Inform the ui of the patch
		this.emitUpdate(this.data)
	}

	protected collectionModifyMetaData = (
		collectionId: string,
		modifier: (collection: CollectionBase<TCollectionMetadata>) => void
	) => {
		const matchedCollection = this.findCollectionAndParent(collectionId)
		if (!matchedCollection) throw new Error(`Collection ${collectionId} not found`)

		modifier(matchedCollection.collection)
		this.#dbTable.set(matchedCollection.rootCollection.id, matchedCollection.rootCollection)

		// Inform the ui of the patch
		this.emitUpdate(this.data)
	}

	protected collectionMove = (collectionId: string, parentId: string | null, dropIndex: number) => {
		if (collectionId === parentId) {
			// Cannot move a collection into itself
			return
		}

		const matchedCollcetion = this.findCollectionAndParent(collectionId)
		if (!matchedCollcetion) throw new Error(`Collection ${collectionId} not found`)

		const newParentCollection = parentId ? this.findCollectionAndParent(parentId) : null
		if (parentId && !newParentCollection) {
			throw new Error(`Parent collection ${parentId} not found`)
		}

		if (parentId && this.#doesCollectionContainOtherCollection(matchedCollcetion.collection, parentId)) {
			// Can't move collection into its own child
			return
		}

		const currentParentArray = matchedCollcetion.parentCollection
			? matchedCollcetion.parentCollection.children
			: this.data

		const currentIndex = currentParentArray.findIndex((child) => child.id === collectionId)
		if (currentIndex === -1)
			throw new Error(
				`Collection ${collectionId} not found in parent ${matchedCollcetion.parentCollection?.id || 'root'}`
			)

		// Remove from the old position
		currentParentArray.splice(currentIndex, 1)
		currentParentArray.forEach((child, i) => {
			child.sortOrder = i // Reset sortOrder for children
		})

		const newParentArray = newParentCollection ? newParentCollection.collection.children : this.data
		newParentArray.splice(dropIndex, 0, matchedCollcetion.collection) // Insert at the new position
		newParentArray.forEach((child, i) => {
			child.sortOrder = i // Reset sortOrder for children
		})

		// Update the database
		// Note: this is being lazy, by writing every row, it could be optimized
		for (const row of this.data) {
			this.#dbTable.set(row.id, row)
		}

		// Inform the ui of the shuffle
		this.emitUpdate(this.data)

		// Future: perform side effects like updating enabled statuses
	}

	protected findCollectionAndParent(collectionId: string): {
		// The root level collection, that contains the collection (could be the same as parentCollection or collection)
		rootCollection: CollectionBase<TCollectionMetadata>
		// The direct parent collection of the collection we are looking for, or null if collection is at the root
		parentCollection: CollectionBase<TCollectionMetadata> | null
		// The collection we are looking for
		collection: CollectionBase<TCollectionMetadata>
	} | null {
		const findCollection = (
			parentCollection: CollectionBase<TCollectionMetadata>,
			candidate: CollectionBase<TCollectionMetadata>
		): [parent: CollectionBase<TCollectionMetadata>, collection: CollectionBase<TCollectionMetadata>] | null => {
			// Check if this candidate is the collection we are looking for
			if (candidate.id === collectionId) {
				return [parentCollection, candidate]
			}

			// Search through the children of this candidate
			for (const child of candidate.children) {
				const found = findCollection(candidate, child)
				if (found) return found
			}

			return null
		}

		for (const collection of this.data.values()) {
			const found = findCollection(collection, collection)
			if (!found) continue // Not the collection we are looking for

			if (found[0].id === found[1].id) {
				// This is the root collection
				// Return null for root collection parent
				return { rootCollection: collection, parentCollection: null, collection: found[1] }
			}

			// Found the collection and its parent
			return { rootCollection: collection, parentCollection: found[0], collection: found[1] }
		}

		return null
	}
}

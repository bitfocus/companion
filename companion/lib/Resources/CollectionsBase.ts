import type { DataStoreTableView } from '../Data/StoreBase.js'
import { nanoid } from 'nanoid'
import type { CollectionBase } from '@companion-app/shared/Model/Collections.js'
import { publicProcedure, toIterable } from '../UI/TRPC.js'
import EventEmitter from 'node:events'
import z from 'zod'

export abstract class CollectionsBaseController<TCollectionMetadata> {
	readonly #dbTable: DataStoreTableView<Record<string, CollectionBase<TCollectionMetadata>>>
	readonly #events = new EventEmitter<{ change: [rows: CollectionBase<TCollectionMetadata>[]] }>()

	protected data: CollectionBase<TCollectionMetadata>[]

	constructor(dbTable: DataStoreTableView<Record<string, CollectionBase<TCollectionMetadata>>>) {
		this.#dbTable = dbTable

		// Note: Storing in the database like this is not optimal, but it is much simpler
		this.data = Object.values(this.#dbTable.all()).sort((a, b) => a.sortOrder - b.sortOrder)

		for (const data of this.data) {
			this.#sortCollectionRecursively(data)
		}
	}

	/**
	 * Recursively ensure children arrays exist and are sorted at all levels
	 */
	#sortCollectionRecursively(collection: CollectionBase<TCollectionMetadata>): void {
		collection.children = collection.children || []
		collection.children.sort((a, b) => a.sortOrder - b.sortOrder)

		// Recursively sort children's children
		for (const child of collection.children) {
			this.#sortCollectionRecursively(child)
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

	/**
	 * Replace all collections with imported collections
	 */
	replaceCollections(collections: CollectionBase<TCollectionMetadata>[]): void {
		// Clear existing collections
		this.#dbTable.clear()
		this.data = []

		// Import new collections
		for (const collection of collections) {
			this.#sortCollectionRecursively(collection)
			this.data.push(collection)
			this.#dbTable.set(collection.id, collection)
		}

		// Sort root level collections
		this.data.sort((a, b) => a.sortOrder - b.sortOrder)

		this.emitUpdate(this.data)
		// remove collectionId fields from connection objects (i.e. this does not affect collection objects themselves)
		this.removeUnknownCollectionReferences()
	}

	/**
	 * Some of the collections have been modified in some way, emit an update to interested parties (eg the UI)
	 */
	protected emitUpdate(rows: CollectionBase<TCollectionMetadata>[]): void {
		this.#events.emit('change', rows)
		this.emitUpdateUser(rows)
	}

	protected abstract emitUpdateUser(rows: CollectionBase<TCollectionMetadata>[]): void

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

	/**
	 * Get a reference to the collections data
	 */
	get collectionData(): CollectionBase<TCollectionMetadata>[] {
		return [...this.data] // Return a shallow copy of the data
	}

	protected collectionCreate = (label: string, metaData: TCollectionMetadata): string => {
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

	protected collectionRemove = (collectionId: string): void => {
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

	protected collectionSetName = (collectionId: string, collectionName: string): void => {
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
	): void => {
		const matchedCollection = this.findCollectionAndParent(collectionId)
		if (!matchedCollection) throw new Error(`Collection ${collectionId} not found`)

		modifier(matchedCollection.collection)
		this.#dbTable.set(matchedCollection.rootCollection.id, matchedCollection.rootCollection)

		// Inform the ui of the patch
		this.emitUpdate(this.data)
	}

	protected collectionMove = (collectionId: string, parentId: string | null, dropIndex: number): void => {
		if (collectionId === parentId) {
			// Cannot move a collection into itself
			return
		}

		const matchedCollection = this.findCollectionAndParent(collectionId)
		if (!matchedCollection) throw new Error(`Collection ${collectionId} not found`)

		const newParentCollection = parentId ? this.findCollectionAndParent(parentId) : null
		if (parentId && !newParentCollection) {
			throw new Error(`Parent collection ${parentId} not found`)
		}

		if (parentId && this.#doesCollectionContainOtherCollection(matchedCollection.collection, parentId)) {
			// Can't move collection into its own child
			return
		}

		const currentParentArray = matchedCollection.parentCollection
			? matchedCollection.parentCollection.children
			: this.data

		const currentIndex = currentParentArray.findIndex((child) => child.id === collectionId)
		if (currentIndex === -1)
			throw new Error(
				`Collection ${collectionId} not found in parent ${matchedCollection.parentCollection?.id || 'root'}`
			)

		// Remove from the old position
		currentParentArray.splice(currentIndex, 1)
		currentParentArray.forEach((child, i) => {
			child.sortOrder = i // Reset sortOrder for children
		})

		const newParentArray = newParentCollection ? newParentCollection.collection.children : this.data
		newParentArray.splice(dropIndex, 0, matchedCollection.collection) // Insert at the new position
		newParentArray.forEach((child, i) => {
			child.sortOrder = i // Reset sortOrder for children
		})

		// Update the database
		// Note: this is being lazy, by writing every row, it could be optimized
		for (const row of this.data) {
			this.#dbTable.set(row.id, row)
		}

		// If the collection is being moved out of the root level, delete it from the db
		if (!matchedCollection.parentCollection && newParentCollection) {
			this.#dbTable.delete(collectionId)
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

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	protected createTrpcRouterBase() {
		const self = this
		return {
			watchQuery: publicProcedure.subscription(async function* (opts) {
				// Start the changes listener
				const changes = toIterable(self.#events, 'change', opts.signal)

				yield self.data // Initial data

				// Stream any changes
				for await (const [data] of changes) {
					yield data
				}
			}),

			// Note: add often requires some metadata, so is easier to define by the caller

			remove: publicProcedure.input(z.object({ collectionId: z.string() })).mutation(async (opts) => {
				const { collectionId } = opts.input
				self.collectionRemove(collectionId)
			}),

			setName: publicProcedure
				.input(z.object({ collectionId: z.string(), collectionName: z.string() }))
				.mutation(async (opts) => {
					const { collectionId, collectionName } = opts.input
					self.collectionSetName(collectionId, collectionName)
				}),

			reorder: publicProcedure
				.input(z.object({ collectionId: z.string(), parentId: z.string().nullable(), dropIndex: z.number() }))
				.mutation(async (opts) => {
					const { collectionId, parentId, dropIndex } = opts.input
					self.collectionMove(collectionId, parentId, dropIndex)
				}),
		}
	}
}

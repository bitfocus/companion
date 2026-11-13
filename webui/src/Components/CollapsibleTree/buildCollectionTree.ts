import type { CollectionBase } from '@companion-app/shared/Model/Collections.js'

/**
 * Sort items into a tree of collections, with a node for each collection which holds an item, itself or in a collection
 * inside it. Collections are in their sort order, and items in the order given.
 * @param rootCollections The top-level collections, in their sort order
 * @param items The items to sort into the collections
 * @param getCollectionId The id of the collection an item is in, or null for one in none
 * @param makeNode Make the node of a collection, from the nodes of the collections inside it and its own items
 * @returns The nodes of the top-level collections, and the items in no collection
 */
export function buildCollectionTree<TMeta, TItem, TNode>(
	rootCollections: readonly CollectionBase<TMeta>[],
	items: Iterable<TItem>,
	getCollectionId: (item: TItem) => string | null,
	makeNode: (collection: CollectionBase<TMeta>, childNodes: TNode[], items: TItem[]) => TNode
): { nodes: TNode[]; ungrouped: TItem[] } {
	const itemsByCollection = Map.groupBy(items, getCollectionId)

	const buildNodes = (collections: readonly CollectionBase<TMeta>[]): TNode[] => {
		const nodes: TNode[] = []
		for (const collection of collections) {
			const childNodes = buildNodes([...collection.children].sort((a, b) => a.sortOrder - b.sortOrder))
			const collectionItems = itemsByCollection.get(collection.id) ?? []
			if (childNodes.length === 0 && collectionItems.length === 0) continue

			nodes.push(makeNode(collection, childNodes, collectionItems))
		}
		return nodes
	}

	return { nodes: buildNodes(rootCollections), ungrouped: itemsByCollection.get(null) ?? [] }
}

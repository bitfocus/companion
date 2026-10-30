import type { CollectionBase } from '@companion-app/shared/Model/Collections.js'
import { useComputed } from '~/Resources/util.js'
import type { EntityLeafItem } from '~/Stores/EntityDefinitionsStore.js'
import type { CollapsibleTreeNode } from '../../Components/CollapsibleTree/CollapsibleTree.js'
import type { ConnectionTreeNodeMeta } from './useConnectionTreeNodes.js'

/**
 * The custom actions or feedbacks to show as a tree node
 */
export interface CustomEntitiesTreeSource {
	/** The connection id which provides them */
	readonly connectionId: string
	/** The label of the node */
	readonly label: string
	/** Get the collection of one of them, by its definition id */
	getCollectionId(definitionId: string): string | null
	/** Get the root collections */
	rootCollections(): CollectionBase<null>[]
}

/**
 * Build the tree node for the custom actions or feedbacks, with a child node for each of their collections
 * @param leaves The leaves for each of the custom entities
 * @param source Describes the custom entities
 * @returns The node, or null if there are no custom entities
 */
export function useCustomEntitiesTreeNode(
	leaves: EntityLeafItem[],
	source: CustomEntitiesTreeSource
): CollapsibleTreeNode<EntityLeafItem, ConnectionTreeNodeMeta> | null {
	return useComputed(() => {
		if (leaves.length === 0) return null

		// Group the leaves by their collection
		const leavesByCollection = new Map<string | null, EntityLeafItem[]>()
		for (const leaf of leaves) {
			const definitionId = leaf.fullId.slice(source.connectionId.length + 1)
			const collectionId = source.getCollectionId(definitionId)

			let list = leavesByCollection.get(collectionId)
			if (!list) {
				list = []
				leavesByCollection.set(collectionId, list)
			}
			list.push(leaf)
		}

		const buildCollectionNode = (
			collection: CollectionBase<null>
		): CollapsibleTreeNode<EntityLeafItem, ConnectionTreeNodeMeta> | null => {
			const children = [...collection.children]
				.sort((a, b) => a.sortOrder - b.sortOrder)
				.map(buildCollectionNode)
				.filter((node) => !!node)
			const collectionLeaves = leavesByCollection.get(collection.id) ?? []

			// Skip collections that have nothing anywhere in their subtree
			if (children.length === 0 && collectionLeaves.length === 0) return null

			return {
				id: `${source.connectionId}-collection:${collection.id}`,
				children,
				leaves: collectionLeaves,
				metadata: {
					type: 'connection',
					connectionId: source.connectionId,
					connectionLabel: collection.label,
					moduleDisplayName: source.label,
				},
			}
		}

		return {
			id: `connection:${source.connectionId}`,
			children: source
				.rootCollections()
				.map(buildCollectionNode)
				.filter((node) => !!node),
			leaves: leavesByCollection.get(null) ?? [],
			metadata: {
				type: 'connection',
				connectionId: source.connectionId,
				connectionLabel: source.label,
				moduleDisplayName: undefined,
			},
		}
	}, [leaves, source])
}

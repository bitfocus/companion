import type { CollectionBase } from '@companion-app/shared/Model/Collections.js'
import { buildCollectionTree } from '~/Components/CollapsibleTree/buildCollectionTree.js'
import { useComputed } from '~/Resources/util.js'
import type { EntityLeafItem } from '~/Stores/EntityDefinitionsStore.js'
import type { CollapsibleTreeNode } from '../../Components/CollapsibleTree/CollapsibleTree.js'
import type { ConnectionTreeNodeMeta } from './useConnectionTreeNodes.js'

/** The collections of a kind of entity the user makes themselves, such as custom actions */
export interface CustomEntityCollections {
	rootCollections(): CollectionBase<unknown>[]
	/** The collection of the entity with a definition id, or null when it is in none */
	getCollectionId(definitionId: string): string | null
}

/**
 * Build the tree node for a kind of entity the user makes themselves, with a child node for each of its collections
 * @param connectionId The connection the entities are offered by
 * @param label What to call the entities
 * @param collections The collections of the entities
 * @param getLeaves The leaves of a connection, which may leave some out
 * @returns The node, or null if there are no entities
 */
export function useCustomEntitiesTreeNode(
	connectionId: string,
	label: string,
	collections: CustomEntityCollections,
	getLeaves: (connectionId: string) => EntityLeafItem[]
): CollapsibleTreeNode<EntityLeafItem, ConnectionTreeNodeMeta> | null {
	return useComputed(() => {
		const leaves = getLeaves(connectionId)
		if (leaves.length === 0) return null

		const { nodes, ungrouped } = buildCollectionTree(
			collections.rootCollections(),
			leaves,
			(leaf) => collections.getCollectionId(leaf.definitionId),
			(collection, children, collectionLeaves): CollapsibleTreeNode<EntityLeafItem, ConnectionTreeNodeMeta> => ({
				id: `${connectionId}-collection:${collection.id}`,
				children,
				leaves: collectionLeaves,
				metadata: {
					type: 'connection',
					connectionId,
					connectionLabel: collection.label,
					moduleDisplayName: label,
				},
			})
		)

		return {
			id: `connection:${connectionId}`,
			children: nodes,
			leaves: ungrouped,
			metadata: {
				type: 'connection',
				connectionId,
				connectionLabel: label,
				moduleDisplayName: undefined,
			},
		}
	}, [connectionId, label, collections, getLeaves])
}

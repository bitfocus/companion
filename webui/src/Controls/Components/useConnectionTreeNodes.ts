import { useContext } from 'react'
import type { ClientConnectionConfig } from '@companion-app/shared/Model/Connections.js'
import { buildCollectionTree } from '~/Components/CollapsibleTree/buildCollectionTree.js'
import { useComputed } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import type { CollapsibleTreeNode } from '../../Components/CollapsibleTree/CollapsibleTree.js'

/**
 * Metadata for a collection group node in the tree.
 */
export interface CollectionNodeMeta {
	type: 'collection'
	label: string
}

/**
 * Metadata for a connection node in the tree.
 */
export interface ConnectionNodeMeta {
	type: 'connection'
	connectionId: string
	connectionLabel: string
	moduleDisplayName: string | undefined
}

/** Discriminated union of node metadata types in a connection tree */
export type ConnectionTreeNodeMeta = CollectionNodeMeta | ConnectionNodeMeta

/**
 * Builds a collapsible tree of connection collections and connections.
 *
 * Collections form intermediate group nodes. Connections become leaf-level
 * group nodes (they can be expanded to show their content). The consumer
 * provides a function that returns the leaf data for each connection.
 *
 * Empty collections and connections (those where getLeaves returns an empty
 * array) are omitted from the tree.
 *
 * @param getLeaves - returns leaf data for a given connection, or empty array to exclude it
 * @returns tree nodes, ungrouped connection nodes, and all node IDs for expansion control
 */
export function useConnectionTreeNodes<TLeafData>(
	getLeaves: (connectionId: string, connectionInfo: ClientConnectionConfig) => TLeafData[]
): {
	nodes: CollapsibleTreeNode<TLeafData, ConnectionTreeNodeMeta>[]
	ungroupedNodes: CollapsibleTreeNode<TLeafData, ConnectionTreeNodeMeta>[]
	allNodeIds: string[]
} {
	const { connections, modules } = useContext(RootAppStoreContext)

	return useComputed(() => {
		const allNodeIds: string[] = []

		const connectionNodes: Array<{
			collectionId: string | null
			node: CollapsibleTreeNode<TLeafData, ConnectionTreeNodeMeta>
		}> = []
		for (const [connectionId, connectionInfo] of connections.connections) {
			const leaves = getLeaves(connectionId, connectionInfo)
			if (leaves.length === 0) continue

			const node: CollapsibleTreeNode<TLeafData, ConnectionTreeNodeMeta> = {
				id: `connection:${connectionId}`,
				children: [],
				leaves,
				metadata: {
					type: 'connection',
					connectionId,
					connectionLabel: connectionInfo.label || connectionId,
					moduleDisplayName: modules.getModuleFriendlyName(connectionInfo.moduleType, connectionInfo.moduleId),
				},
			}
			allNodeIds.push(node.id)
			connectionNodes.push({ collectionId: connectionInfo.collectionId, node })
		}
		const { nodes, ungrouped } = buildCollectionTree(
			connections.rootCollections(),
			connectionNodes,
			(entry) => entry.collectionId,
			(collection, childNodes, connectionEntries): CollapsibleTreeNode<TLeafData, ConnectionTreeNodeMeta> => {
				const id = `collection:${collection.id}`
				allNodeIds.push(id)
				return {
					id,
					// Connection nodes go as children (sub-groups), not as leaves
					children: [...childNodes, ...connectionEntries.map((entry) => entry.node)],
					leaves: [],
					metadata: { type: 'collection', label: collection.label },
				}
			}
		)
		const ungroupedNodes = ungrouped.map((entry) => entry.node)

		return { nodes, ungroupedNodes, allNodeIds }
	}, [getLeaves, connections, modules])
}

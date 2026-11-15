import { useContext } from 'react'
import type { ClientConnectionConfig } from '@companion-app/shared/Model/Connections.js'
import { useComputed } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { buildCollectionTree } from './buildCollectionTree.js'
import type { CollapsibleTreeNode } from './CollapsibleTree.js'

/**
 * A connection leaf item in the tree.
 */
export interface ConnectionLeafItem {
	key: string
	connectionId: string
	connectionLabel: string
	moduleDisplayName: string | undefined
}

/** Metadata for a collection group node */
export interface CollectionGroupMeta {
	label: string
}

/**
 * Builds a collapsible tree of connection collections, with connections as leaf items.
 * Collections form group nodes, connections are the selectable leaf data.
 *
 * Filters connections using the provided predicate. Empty collections
 * (those with no matching connections in themselves or their descendants) are omitted.
 *
 * @param filterConnection - predicate to determine if a connection should be included
 * @returns tree nodes, ungrouped leaf items, and all node IDs for expansion control
 */
export function useConnectionLeafTree(
	filterConnection: (connectionId: string, connectionInfo: ClientConnectionConfig) => boolean
): {
	nodes: CollapsibleTreeNode<ConnectionLeafItem, CollectionGroupMeta>[]
	ungroupedLeaves: ConnectionLeafItem[]
	allNodeIds: string[]
} {
	const { connections, modules } = useContext(RootAppStoreContext)

	return useComputed(() => {
		const leaves: ConnectionLeafItem[] = []
		for (const [connectionId, connectionInfo] of connections.connections) {
			if (!filterConnection(connectionId, connectionInfo)) continue

			leaves.push({
				key: connectionId,
				connectionId,
				connectionLabel: connectionInfo.label || connectionId,
				moduleDisplayName: modules.getModuleFriendlyName(connectionInfo.moduleType, connectionInfo.moduleId),
			})
		}
		leaves.sort((a, b) => a.connectionLabel.localeCompare(b.connectionLabel))

		const allNodeIds: string[] = []
		const { nodes, ungrouped: ungroupedLeaves } = buildCollectionTree(
			connections.rootCollections(),
			leaves,
			(leaf) => connections.connections.get(leaf.connectionId)?.collectionId ?? null,
			(collection, children, collectionLeaves): CollapsibleTreeNode<ConnectionLeafItem, CollectionGroupMeta> => {
				const id = `collection:${collection.id}`
				allNodeIds.push(id)
				return { id, children, leaves: collectionLeaves, metadata: { label: collection.label } }
			}
		)

		return { nodes, ungroupedLeaves, allNodeIds }
	}, [filterConnection, connections, modules])
}

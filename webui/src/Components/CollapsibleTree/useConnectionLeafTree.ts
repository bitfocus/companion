import { useContext } from 'react'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { useComputed } from '~/Resources/util.js'
import type { CollapsibleTreeNode } from './CollapsibleTree.js'
import type { ConnectionCollection, ClientConnectionConfig } from '@companion-app/shared/Model/Connections.js'

/**
 * A connection leaf item in the tree.
 */
export interface ConnectionLeafItem {
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

	const rootCollections = useComputed(() => connections.rootCollections(), [connections.collections])

	const allConnections = useComputed(() => Array.from(connections.connections.entries()), [connections.connections])

	return useComputed(() => {
		// Build leaves for matching connections
		const matchingConnections = new Map<string, ConnectionLeafItem>()
		for (const [connectionId, connectionInfo] of allConnections) {
			if (!filterConnection(connectionId, connectionInfo)) continue

			matchingConnections.set(connectionId, {
				connectionId,
				connectionLabel: connectionInfo.label || connectionId,
				moduleDisplayName: modules.getModuleFriendlyName(connectionInfo.moduleType, connectionInfo.moduleId),
			})
		}

		// Group connections by collectionId
		const connectionsByCollection = new Map<string | null, ConnectionLeafItem[]>()
		for (const [connectionId, connectionInfo] of allConnections) {
			const leaf = matchingConnections.get(connectionId)
			if (!leaf) continue

			const collectionId = connectionInfo.collectionId
			let list = connectionsByCollection.get(collectionId)
			if (!list) {
				list = []
				connectionsByCollection.set(collectionId, list)
			}
			list.push(leaf)
		}

		// Sort connections within each collection by label
		for (const list of connectionsByCollection.values()) {
			list.sort((a, b) => a.connectionLabel.localeCompare(b.connectionLabel))
		}

		const allNodeIds: string[] = []

		// Recursively build collection tree nodes
		function buildCollectionNode(
			collection: ConnectionCollection
		): CollapsibleTreeNode<ConnectionLeafItem, CollectionGroupMeta> | null {
			const childNodes: CollapsibleTreeNode<ConnectionLeafItem, CollectionGroupMeta>[] = []
			const sortedChildren = [...collection.children].sort((a, b) => a.sortOrder - b.sortOrder)

			for (const child of sortedChildren) {
				const childNode = buildCollectionNode(child)
				if (childNode) childNodes.push(childNode)
			}

			const leaves = connectionsByCollection.get(collection.id) ?? []

			// Skip collections that have no matching connections in their subtree
			if (childNodes.length === 0 && leaves.length === 0) return null

			const nodeId = `collection:${collection.id}`
			allNodeIds.push(nodeId)

			return {
				id: nodeId,
				children: childNodes,
				leaves,
				metadata: {
					label: collection.label,
				},
			}
		}

		const nodes: CollapsibleTreeNode<ConnectionLeafItem, CollectionGroupMeta>[] = []
		for (const rootCollection of rootCollections) {
			const node = buildCollectionNode(rootCollection)
			if (node) nodes.push(node)
		}

		const ungroupedLeaves = connectionsByCollection.get(null) ?? []

		return { nodes, ungroupedLeaves, allNodeIds }
	}, [allConnections, rootCollections, filterConnection, modules])
}

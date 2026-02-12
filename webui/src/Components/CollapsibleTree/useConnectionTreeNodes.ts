import { useContext } from 'react'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { useComputed } from '~/Resources/util.js'
import type { CollapsibleTreeNode } from './CollapsibleTree.js'
import type { ConnectionCollection, ClientConnectionConfig } from '@companion-app/shared/Model/Connections.js'

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

	const rootCollections = useComputed(() => connections.rootCollections(), [connections.collections])

	const allConnections = useComputed(() => Array.from(connections.connections.entries()), [connections.connections])

	return useComputed(() => {
		// Build connection nodes for each connection that has leaves
		const connectionNodes = new Map<string, CollapsibleTreeNode<TLeafData, ConnectionTreeNodeMeta>>()
		for (const [connectionId, connectionInfo] of allConnections) {
			const leaves = getLeaves(connectionId, connectionInfo)
			if (leaves.length === 0) continue

			connectionNodes.set(connectionId, {
				id: `connection:${connectionId}`,
				children: [],
				leaves,
				metadata: {
					type: 'connection',
					connectionId,
					connectionLabel: connectionInfo.label || connectionId,
					moduleDisplayName: modules.getModuleFriendlyName(connectionInfo.moduleType, connectionInfo.moduleId),
				},
			})
		}

		// Group connection nodes by collectionId
		const connectionsByCollection = new Map<string | null, CollapsibleTreeNode<TLeafData, ConnectionTreeNodeMeta>[]>()
		for (const [connectionId, connectionInfo] of allConnections) {
			const connNode = connectionNodes.get(connectionId)
			if (!connNode) continue

			const collectionId = connectionInfo.collectionId
			let list = connectionsByCollection.get(collectionId)
			if (!list) {
				list = []
				connectionsByCollection.set(collectionId, list)
			}
			list.push(connNode)
		}

		const allNodeIds: string[] = []

		// Collect all connection node IDs
		for (const connNode of connectionNodes.values()) {
			allNodeIds.push(connNode.id)
		}

		// Recursively build collection tree nodes
		function buildCollectionNode(
			collection: ConnectionCollection
		): CollapsibleTreeNode<TLeafData, ConnectionTreeNodeMeta> | null {
			const childNodes: CollapsibleTreeNode<TLeafData, ConnectionTreeNodeMeta>[] = []
			const sortedChildren = [...collection.children].sort((a, b) => a.sortOrder - b.sortOrder)

			for (const child of sortedChildren) {
				const childNode = buildCollectionNode(child)
				if (childNode) childNodes.push(childNode)
			}

			const connNodes = connectionsByCollection.get(collection.id) ?? []

			// Skip collections that have no content anywhere in their subtree
			if (childNodes.length === 0 && connNodes.length === 0) return null

			const nodeId = `collection:${collection.id}`
			allNodeIds.push(nodeId)

			return {
				id: nodeId,
				// Connection nodes go as children (sub-groups), not as leaves
				children: [...childNodes, ...connNodes],
				leaves: [],
				metadata: {
					type: 'collection',
					label: collection.label,
				},
			}
		}

		const nodes: CollapsibleTreeNode<TLeafData, ConnectionTreeNodeMeta>[] = []
		for (const rootCollection of rootCollections) {
			const node = buildCollectionNode(rootCollection)
			if (node) nodes.push(node)
		}

		const ungroupedNodes = connectionsByCollection.get(null) ?? []

		return { nodes, ungroupedNodes, allNodeIds }
	}, [allConnections, rootCollections, getLeaves, modules])
}

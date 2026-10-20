import { useContext } from 'react'
import { CUSTOM_ACTIONS_CONNECTION_ID } from '@companion-app/shared/ConnectionId.js'
import { CreateCustomActionControlId } from '@companion-app/shared/ControlId.js'
import type { CustomActionCollection } from '@companion-app/shared/Model/CustomActionModel.js'
import { useComputed } from '~/Resources/util.js'
import type { EntityLeafItem } from '~/Stores/EntityDefinitionsStore.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import type { CollapsibleTreeNode } from '../../Components/CollapsibleTree/CollapsibleTree.js'
import type { ConnectionTreeNodeMeta } from './useConnectionTreeNodes.js'

/**
 * Build the tree node for the custom actions, with a child node for each collection of custom actions
 * @param leaves The leaves for each of the custom actions
 * @returns The node, or null if there are no custom actions
 */
export function useCustomActionsTreeNode(
	leaves: EntityLeafItem[]
): CollapsibleTreeNode<EntityLeafItem, ConnectionTreeNodeMeta> | null {
	const { customActionsList } = useContext(RootAppStoreContext)

	return useComputed(() => {
		if (leaves.length === 0) return null

		// Group the leaves by the collection of their custom action
		const leavesByCollection = new Map<string | null, EntityLeafItem[]>()
		for (const leaf of leaves) {
			const definitionId = leaf.fullId.slice(CUSTOM_ACTIONS_CONNECTION_ID.length + 1)
			const collectionId =
				customActionsList.customActions.get(CreateCustomActionControlId(definitionId))?.collectionId || null

			let list = leavesByCollection.get(collectionId)
			if (!list) {
				list = []
				leavesByCollection.set(collectionId, list)
			}
			list.push(leaf)
		}

		const buildCollectionNode = (
			collection: CustomActionCollection
		): CollapsibleTreeNode<EntityLeafItem, ConnectionTreeNodeMeta> | null => {
			const children = [...collection.children]
				.sort((a, b) => a.sortOrder - b.sortOrder)
				.map(buildCollectionNode)
				.filter((node) => !!node)
			const collectionLeaves = leavesByCollection.get(collection.id) ?? []

			// Skip collections that have no custom actions anywhere in their subtree
			if (children.length === 0 && collectionLeaves.length === 0) return null

			return {
				id: `custom-action-collection:${collection.id}`,
				children,
				leaves: collectionLeaves,
				metadata: {
					type: 'connection',
					connectionId: CUSTOM_ACTIONS_CONNECTION_ID,
					connectionLabel: collection.label,
					moduleDisplayName: 'Custom actions',
				},
			}
		}

		return {
			id: `connection:${CUSTOM_ACTIONS_CONNECTION_ID}`,
			children: customActionsList
				.rootCollections()
				.map(buildCollectionNode)
				.filter((node) => !!node),
			leaves: leavesByCollection.get(null) ?? [],
			metadata: {
				type: 'connection',
				connectionId: CUSTOM_ACTIONS_CONNECTION_ID,
				connectionLabel: 'Custom actions',
				moduleDisplayName: undefined,
			},
		}
	}, [leaves, customActionsList])
}

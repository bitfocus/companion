import { CButton, CFormInput, CModalBody, CModalFooter, CModalHeader } from '@coreui/react'
import React, { forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { capitalize } from 'lodash-es'
import { CModalExt } from '~/Components/CModalExt.js'
import { go as fuzzySearch } from 'fuzzysort'
import type { EntityModelType, FeedbackEntitySubType } from '@companion-app/shared/Model/EntityModel.js'
import { canAddEntityToFeedbackList } from '@companion-app/shared/Entity.js'
import {
	CollapsibleTree,
	CollapsibleTreeNesting,
	type CollapsibleTreeNode,
} from '~/Components/CollapsibleTree.js'
import { useCollapsibleTreeExpansion } from '~/Components/useCollapsibleTreeExpansion.js'
import {
	useConnectionTreeNodes,
	type ConnectionTreeNodeMeta,
} from '~/Components/useConnectionTreeNodes.js'
import type { ClientConnectionConfig } from '@companion-app/shared/Model/Connections.js'

interface AddEntitiesModalProps {
	addEntity: (connectionId: string, definitionId: string) => void
	feedbackListType: FeedbackEntitySubType | null
	entityType: EntityModelType
	entityTypeLabel: string
}
export interface AddEntitiesModalRef {
	show(): void
}

export const AddEntitiesModal = observer(
	forwardRef<AddEntitiesModalRef, AddEntitiesModalProps>(function AddFeedbacksModal(
		{ addEntity, feedbackListType, entityType, entityTypeLabel },
		ref
	) {
		const { entityDefinitions } = useContext(RootAppStoreContext)

		const definitions = entityDefinitions.getEntityDefinitionsStore(entityType)
		const recentlyUsed = entityDefinitions.getRecentlyUsedEntityDefinitionsStore(entityType)

		const [show, setShow] = useState(false)
		const [filter, setFilter] = useState('')

		const doClose = useCallback(() => setShow(false), [])
		const onClosed = useCallback(() => {
			setFilter('')
		}, [])

		useImperativeHandle(
			ref,
			() => ({
				show() {
					setShow(true)
					setFilter('')
				},
			}),
			[]
		)

		// Collection tree expand/collapse state (auto-expand when filtering)
		const collectionExpansion = useCollapsibleTreeExpansion(!!filter)

		const addAndTrackRecentUsage = useCallback(
			(connectionAndDefinitionId: string) => {
				recentlyUsed.trackId(connectionAndDefinitionId)

				const [connectionId, definitionId] = connectionAndDefinitionId.split(':', 2)
				addEntity(connectionId, definitionId)
			},
			[recentlyUsed, addEntity]
		)

		// Filter to only connections that have entity definitions matching our entity type + feedback filter
		const getEntityLeafs = useCallback(
			(connectionId: string, _connectionInfo: ClientConnectionConfig): EntityLeafItem[] => {
				const items = definitions.connections.get(connectionId)
				if (!items || items.size === 0) return []

				const leafs: EntityLeafItem[] = []
				for (const [id, info] of items.entries()) {
					if (!info || !info.label) continue
					if (!canAddEntityToFeedbackList(feedbackListType, info)) continue

					leafs.push({
						fullId: `${connectionId}:${id}`,
						label: info.label,
						description: info.description,
					})
				}
				return leafs
			},
			[definitions.connections, feedbackListType]
		)

		const { nodes, ungroupedNodes, allNodeIds } = useConnectionTreeNodes(getEntityLeafs)

		// Build internal connection node if it has matching entities
		const internalNode = useMemo((): CollapsibleTreeNode<EntityLeafItem, ConnectionTreeNodeMeta> | null => {
			const internalItems = definitions.connections.get('internal')
			if (!internalItems || internalItems.size === 0) return null

			const leafs: EntityLeafItem[] = []
			for (const [id, info] of internalItems.entries()) {
				if (!info || !info.label) continue
				if (!canAddEntityToFeedbackList(feedbackListType, info)) continue
				leafs.push({
					fullId: `internal:${id}`,
					label: info.label,
					description: info.description,
				})
			}

			if (leafs.length === 0) return null

			return {
				id: 'connection:internal',
				children: [],
				leafs,
				metadata: {
					type: 'connection',
					connectionId: 'internal',
					connectionLabel: 'Internal',
					moduleDisplayName: undefined,
				},
			}
		}, [definitions.connections, feedbackListType])

		// Expand all collection nodes by default on first mount
		useEffect(() => {
			if (allNodeIds.length > 0) {
				collectionExpansion.expandAll(allNodeIds)
			}
			// Only run on first load to expand everything by default
			// eslint-disable-next-line react-hooks/exhaustive-deps
		}, [])

		const renderGroupHeader = useCallback(
			(node: CollapsibleTreeNode<EntityLeafItem, ConnectionTreeNodeMeta>) => {
				const meta = node.metadata
				if (meta.type === 'connection') {
					return (
						<span>
							{meta.connectionLabel}
							{meta.moduleDisplayName && (
								<small className="collapsible-tree-connection-module">{meta.moduleDisplayName}</small>
							)}
						</span>
					)
				}
				return <span>{meta.label}</span>
			},
			[]
		)

		const renderLeaf = useCallback(
			(leaf: EntityLeafItem, nestingLevel: number) => {
				return (
					<div
						className="collapsible-tree-leaf-row"
						onClick={() => addAndTrackRecentUsage(leaf.fullId)}
					>
						<CollapsibleTreeNesting nestingLevel={nestingLevel}>
							<span className="collapsible-tree-leaf-label">{leaf.label}</span>
							{leaf.description && (
								<>
									<br />
									<span className="collapsible-tree-leaf-description">{leaf.description}</span>
								</>
							)}
						</CollapsibleTreeNesting>
					</div>
				)
			},
			[addAndTrackRecentUsage]
		)

		// When filtering, apply fuzzy search to leaf items in each node
		const filteredNodes = useMemo(() => {
			if (!filter) return { nodes: internalNode ? [internalNode, ...nodes] : nodes, ungroupedNodes }
			return filterTreeNodes(filter, internalNode ? [internalNode, ...nodes] : nodes, ungroupedNodes)
		}, [filter, nodes, ungroupedNodes, internalNode])

		return (
			<CModalExt visible={show} onClose={doClose} onClosed={onClosed} size="lg" scrollable={true}>
				<CModalHeader closeButton>
					<h5>Browse {capitalize(entityTypeLabel)}s</h5>
				</CModalHeader>
				<CModalHeader closeButton={false}>
					<CFormInput
						type="text"
						placeholder="Search ..."
						onChange={(e) => setFilter(e.currentTarget.value)}
						value={filter}
						style={{ fontSize: '1.2em' }}
					/>
				</CModalHeader>
				<CModalBody>
					<CollapsibleTree
						nodes={filteredNodes.nodes}
						ungroupedNodes={filteredNodes.ungroupedNodes}
						ungroupedLabel="Ungrouped Connections"
						expandedNodeIds={collectionExpansion.expandedNodeIds}
						toggleNodeExpanded={collectionExpansion.toggleNodeExpanded}
						renderGroupHeader={renderGroupHeader}
						renderLeaf={renderLeaf}
					/>
				</CModalBody>
				<CModalFooter>
					<CButton color="secondary" onClick={doClose}>
						Done
					</CButton>
				</CModalFooter>
			</CModalExt>
		)
	})
)

interface EntityLeafItem {
	fullId: string
	label: string
	description: string | undefined
}

/**
 * Filter tree nodes by applying fuzzy search to leaf items.
 * Removes nodes with no matching leafs (unless they have children with matches).
 * Preserves the tree structure.
 */
function filterTreeNodes(
	filter: string,
	nodes: CollapsibleTreeNode<EntityLeafItem, ConnectionTreeNodeMeta>[],
	ungroupedNodes: CollapsibleTreeNode<EntityLeafItem, ConnectionTreeNodeMeta>[]
): {
	nodes: CollapsibleTreeNode<EntityLeafItem, ConnectionTreeNodeMeta>[]
	ungroupedNodes: CollapsibleTreeNode<EntityLeafItem, ConnectionTreeNodeMeta>[]
} {
	function filterNode(
		node: CollapsibleTreeNode<EntityLeafItem, ConnectionTreeNodeMeta>
	): CollapsibleTreeNode<EntityLeafItem, ConnectionTreeNodeMeta> | null {
		const filteredChildren = node.children.map(filterNode).filter((n) => n !== null)

		const filteredLeafs =
			node.leafs.length > 0
				? fuzzySearch(filter, node.leafs, {
						keys: ['label'],
						threshold: -10_000,
					}).map((x) => x.obj)
				: []

		if (filteredChildren.length === 0 && filteredLeafs.length === 0) return null

		return {
			...node,
			children: filteredChildren,
			leafs: filteredLeafs,
		}
	}

	return {
		nodes: nodes.map(filterNode).filter((n) => n !== null),
		ungroupedNodes: ungroupedNodes.map(filterNode).filter((n) => n !== null),
	}
}


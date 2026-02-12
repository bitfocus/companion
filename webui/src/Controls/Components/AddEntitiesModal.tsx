import { CButton, CFormInput, CModalBody, CModalFooter, CModalHeader } from '@coreui/react'
import React, { forwardRef, useCallback, useContext, useImperativeHandle, useMemo, useState } from 'react'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { capitalize } from 'lodash-es'
import { CModalExt } from '~/Components/CModalExt.js'
import { go as fuzzySearch } from 'fuzzysort'
import type { EntityModelType, FeedbackEntitySubType } from '@companion-app/shared/Model/EntityModel.js'
import { canAddEntityToFeedbackList } from '@companion-app/shared/Entity.js'
import {
	CollapsibleTree,
	type CollapsibleTreeNode,
	type CollapsibleTreeHeaderProps,
} from '~/Components/CollapsibleTree/CollapsibleTree.js'
import { usePanelCollapseHelper } from '~/Helpers/CollapseHelper.js'
import { useConnectionTreeNodes, type ConnectionTreeNodeMeta } from '~/Controls/Components/useConnectionTreeNodes.js'
import type { ClientConnectionConfig } from '@companion-app/shared/Model/Connections.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faSearch } from '@fortawesome/free-solid-svg-icons'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { useComputed } from '~/Resources/util'

const AddEntityGroupHeader = observer(function AddEntityGroupHeader({
	node,
}: CollapsibleTreeHeaderProps<EntityLeafItem, ConnectionTreeNodeMeta>) {
	const entityTypeLabelContext = useContext(EntityTypeLabelContext)

	const meta = node.metadata
	if (meta.type === 'connection') {
		const itemCount = node.leaves.length
		const itemLabel = itemCount === 1 ? entityTypeLabelContext : `${entityTypeLabelContext}s`
		return (
			<span className="collapsible-tree-connection-header">
				<span>
					{meta.connectionLabel}
					{meta.moduleDisplayName && (
						<small className="collapsible-tree-connection-module">{meta.moduleDisplayName}</small>
					)}
				</span>
				<small className="collapsible-tree-connection-count">
					{itemCount} {itemLabel}
				</small>
			</span>
		)
	}
	return <span>{meta.label}</span>
})

interface AddEntitiesModalProps {
	addEntity: (connectionId: string, definitionId: string) => void
	feedbackListType: FeedbackEntitySubType | null
	entityType: EntityModelType
	entityTypeLabel: string
}
const EntityTypeLabelContext = React.createContext<string>('')

export interface AddEntitiesModalRef {
	show(): void
}

interface EntityLeafItem {
	fullId: string
	label: string
	description: string | undefined
}

const AddEntityLeaf = observer(function AddEntityLeaf({ leaf }: { leaf: EntityLeafItem }) {
	return (
		<>
			<div className="collapsible-tree-leaf-text">
				<span className="collapsible-tree-leaf-label">{leaf.label}</span>
				{leaf.description && (
					<>
						<span className="collapsible-tree-leaf-description">{leaf.description}</span>
					</>
				)}
			</div>
			<FontAwesomeIcon icon={faPlus} className="collapsible-tree-leaf-add-icon" />
		</>
	)
})

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

		const addAndTrackRecentUsage = useCallback(
			(connectionAndDefinitionId: string) => {
				recentlyUsed.trackId(connectionAndDefinitionId)

				const [connectionId, definitionId] = connectionAndDefinitionId.split(':', 2)
				addEntity(connectionId, definitionId)
			},
			[recentlyUsed, addEntity]
		)

		// Filter to only connections that have entity definitions matching our entity type + feedback filter
		const getEntityLeaves = useCallback(
			(connectionId: string, _connectionInfo: ClientConnectionConfig): EntityLeafItem[] => {
				const items = definitions.connections.get(connectionId)
				if (!items || items.size === 0) return []

				const leaves: EntityLeafItem[] = []
				for (const [id, info] of items.entries()) {
					if (!info || !info.label) continue
					if (!canAddEntityToFeedbackList(feedbackListType, info)) continue

					leaves.push({
						fullId: `${connectionId}:${id}`,
						label: info.label,
						description: info.description,
					})
				}
				return leaves
			},
			[definitions.connections, feedbackListType]
		)

		const { nodes, ungroupedNodes } = useConnectionTreeNodes(getEntityLeaves)

		// Build internal connection node if it has matching entities
		const internalNode = useMemo((): CollapsibleTreeNode<EntityLeafItem, ConnectionTreeNodeMeta> | null => {
			const internalItems = definitions.connections.get('internal')
			if (!internalItems || internalItems.size === 0) return null

			const leaves: EntityLeafItem[] = []
			for (const [id, info] of internalItems.entries()) {
				if (!info || !info.label) continue
				if (!canAddEntityToFeedbackList(feedbackListType, info)) continue
				leaves.push({
					fullId: `internal:${id}`,
					label: info.label,
					description: info.description,
				})
			}

			if (leaves.length === 0) return null

			return {
				id: 'connection:internal',
				children: [],
				leaves,
				metadata: {
					type: 'connection',
					connectionId: 'internal',
					connectionLabel: 'Internal',
					moduleDisplayName: undefined,
				},
			}
		}, [definitions.connections, feedbackListType])

		// Collections default expanded, connections default collapsed (no localStorage persistence for modals)
		const defaultCollapsedFn = useCallback((panelId: string) => !panelId.startsWith('collection:'), [])
		const collapseHelper = usePanelCollapseHelper(null, [], defaultCollapsedFn)

		// When filtering, apply fuzzy search to leaf items in each node
		const filteredNodes = useComputed(() => {
			const rawNodes = internalNode ? [internalNode, ...nodes] : nodes

			const res = !filter ? { nodes: rawNodes, ungroupedNodes } : filterTreeNodes(filter, rawNodes, ungroupedNodes)

			// If there are no collections visible, merge ungrouped nodes into the main list
			// This hides the "Ungrouped Connections" header
			const hasCollections = res.nodes.some((n) => n.metadata.type === 'collection')
			if (!hasCollections && res.ungroupedNodes.length > 0) {
				return {
					nodes: [...res.nodes, ...res.ungroupedNodes],
					ungroupedNodes: [],
				}
			}

			return res
		}, [filter, nodes, ungroupedNodes, internalNode])

		const noResultsContent = useMemo(
			() => <NonIdealState icon={faSearch} text={`No ${entityTypeLabel}s match your search.`} />,
			[entityTypeLabel]
		)

		return (
			<EntityTypeLabelContext.Provider value={entityTypeLabel}>
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
							collapseHelper={filter ? null : collapseHelper}
							HeaderComponent={AddEntityGroupHeader}
							LeafComponent={AddEntityLeaf}
							onLeafClick={(leaf) => addAndTrackRecentUsage(leaf.fullId)}
							noContent={filter ? noResultsContent : undefined}
						/>
					</CModalBody>
					<CModalFooter>
						<CButton color="secondary" onClick={doClose}>
							Done
						</CButton>
					</CModalFooter>
				</CModalExt>
			</EntityTypeLabelContext.Provider>
		)
	})
)

/**
 * Filter tree nodes by applying fuzzy search to leaf items.
 * Removes nodes with no matching leaves (unless they have children with matches).
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

		const filteredLeaves =
			node.leaves.length > 0
				? fuzzySearch(filter, node.leaves, {
						keys: ['label'],
						threshold: -10_000,
					}).map((x) => x.obj)
				: []

		if (filteredChildren.length === 0 && filteredLeaves.length === 0) return null

		return {
			...node,
			children: filteredChildren,
			leaves: filteredLeaves,
		}
	}

	return {
		nodes: nodes.map(filterNode).filter((n) => n !== null),
		ungroupedNodes: ungroupedNodes.map(filterNode).filter((n) => n !== null),
	}
}

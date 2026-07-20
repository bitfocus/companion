import { faFolderOpen, faPlus, faSearch } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { go as fuzzySearch } from 'fuzzysort'
import { observer } from 'mobx-react-lite'
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { EntityModelType, FeedbackEntitySubType } from '@companion-app/shared/Model/EntityModel.js'
import { capitalize } from '@companion-app/shared/Util.js'
import {
	CollapsibleTree,
	type CollapsibleTreeHeaderProps,
	type CollapsibleTreeNode,
} from '~/Components/CollapsibleTree/CollapsibleTree.js'
import { Modal } from '~/Components/Modal'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { SearchBox } from '~/Components/SearchBox'
import { useConnectionTreeNodes, type ConnectionTreeNodeMeta } from '~/Controls/Components/useConnectionTreeNodes.js'
import { usePanelCollapseHelper } from '~/Helpers/CollapseHelper.js'
import { useComputed } from '~/Resources/util'
import { type EntityLeafItem } from '~/Stores/EntityDefinitionsStore.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

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
	disabled: boolean
}
const EntityTypeLabelContext = createContext<string>('')

const AddEntityLeaf = observer(function AddEntityLeaf({ leaf }: { leaf: EntityLeafItem }) {
	return (
		<>
			<div className="collapsible-tree-leaf-text">
				<span className="collapsible-tree-leaf-label fw-semibold">{leaf.label}</span>
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

export const AddEntitiesModal = observer(function AddEntitiesModal({
	addEntity,
	feedbackListType,
	entityType,
	entityTypeLabel,
	disabled,
}: AddEntitiesModalProps) {
	const { entityDefinitions } = useContext(RootAppStoreContext)

	const definitions = entityDefinitions.getEntityDefinitionsStore(entityType)
	const recentlyUsed = entityDefinitions.getRecentlyUsedEntityDefinitionsStore(entityType)

	const [show, setShow] = useState(false)
	const [filter, setFilter] = useState('')

	const onOpenChangeComplete = useCallback(() => {
		setFilter('')
	}, [])

	const addAndTrackRecentUsage = useCallback(
		(connectionAndDefinitionId: string) => {
			recentlyUsed.trackId(connectionAndDefinitionId)

			const [connectionId, definitionId] = connectionAndDefinitionId.split(':', 2)
			addEntity(connectionId, definitionId)
		},
		[recentlyUsed, addEntity]
	)

	const getEntityLeaves = useCallback(
		(connectionId: string): EntityLeafItem[] => definitions.buildConnectionLeaves(connectionId, feedbackListType),
		[definitions, feedbackListType]
	)

	const { nodes, ungroupedNodes } = useConnectionTreeNodes(getEntityLeaves)

	const internalLeaves = definitions.buildConnectionLeaves('internal', feedbackListType)
	const internalNode = useMemo((): CollapsibleTreeNode<EntityLeafItem, ConnectionTreeNodeMeta> | null => {
		if (internalLeaves.length === 0) return null
		return {
			id: 'connection:internal',
			children: [],
			leaves: internalLeaves,
			metadata: {
				type: 'connection',
				connectionId: 'internal',
				connectionLabel: 'Internal',
				moduleDisplayName: undefined,
			},
		}
	}, [internalLeaves])

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
		<Modal.Root open={show} onOpenChange={setShow} onOpenChangeComplete={onOpenChangeComplete}>
			<Modal.Trigger
				color="primary"
				className="rounded-start-0"
				disabled={disabled}
				aria-label={`Browse ${capitalize(entityTypeLabel)}s`}
				title={`Browse ${capitalize(entityTypeLabel)}s`}
			>
				<FontAwesomeIcon icon={faFolderOpen} />
			</Modal.Trigger>

			<Modal.Portal>
				<Modal.Backdrop />
				<Modal.Viewport>
					<Modal.Popup size="lg" scrollable>
						<Modal.Header closeButton>
							<Modal.Title>Browse {capitalize(entityTypeLabel)}s</Modal.Title>
						</Modal.Header>
						<Modal.Header>
							<SearchBox filter={filter} setFilter={setFilter} className="mb-2" />
						</Modal.Header>
						<Modal.Body>
							<EntityTypeLabelContext.Provider value={entityTypeLabel}>
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
							</EntityTypeLabelContext.Provider>
						</Modal.Body>
					</Modal.Popup>
				</Modal.Viewport>
			</Modal.Portal>
		</Modal.Root>
	)
})

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
						keys: ['searchLabel'],
						threshold: 0.5, // relatively strict.
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

import { faClockRotateLeft, faFolderOpen, faPlus, faSearch } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { go as fuzzySearch } from 'fuzzysort'
import { observer } from 'mobx-react-lite'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { EntityModelType, FeedbackEntitySubType } from '@companion-app/shared/Model/EntityModel.js'
import { capitalize } from '@companion-app/shared/Util.js'
import { Button } from '~/Components/Button.js'
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
import './AddEntitiesModal.css'

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

interface EntitySearchResult {
	leaf: EntityLeafItem
	connectionLabel: string
	moduleDisplayName: string | undefined
	searchText: string
}

function EntityResultRow({
	result,
	active,
	id,
	onActivate,
	onSelect,
}: {
	result: EntitySearchResult
	active?: boolean
	id?: string
	onActivate?: () => void
	onSelect: () => void
}): React.JSX.Element {
	return (
		<div
			id={id}
			className={`add-entity-search-result${active ? ' active' : ''}`}
			role="option"
			aria-selected={active}
			tabIndex={active === undefined ? 0 : undefined}
			onMouseEnter={onActivate}
			onMouseDown={(event) => event.preventDefault()}
			onKeyDown={(event) => {
				if (event.key === 'Enter' || event.key === ' ') {
					event.preventDefault()
					onSelect()
				}
			}}
			onClick={onSelect}
		>
			<div className="add-entity-search-result-text">
				<span className="font-semibold">{result.leaf.label}</span>
				{result.leaf.description && <small>{result.leaf.description}</small>}
			</div>
			<div className="add-entity-search-result-meta">
				<span className="add-entity-search-result-badge">{result.connectionLabel}</span>
				{result.moduleDisplayName && (
					<span className="add-entity-search-result-module">{result.moduleDisplayName}</span>
				)}
			</div>
			<FontAwesomeIcon icon={faPlus} className="add-entity-search-result-add" />
		</div>
	)
}

const AddEntityLeaf = observer(function AddEntityLeaf({ leaf }: { leaf: EntityLeafItem }) {
	return (
		<>
			<div className="collapsible-tree-leaf-text">
				<span className="collapsible-tree-leaf-label font-semibold">{leaf.label}</span>
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
	const [activeResultIndex, setActiveResultIndex] = useState(0)

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

	// Collections default expanded, connections default collapsed. Persisted per entity type so the
	// user's expand/collapse choices survive switching between controls. `null` known-ids = never prune,
	// since the visible collections/connections are only ever a subset of what may be stored.
	const defaultCollapsedFn = useCallback((panelId: string) => !panelId.startsWith('collection:'), [])
	const collapseHelper = usePanelCollapseHelper(`add_entities_${entityType}`, null, defaultCollapsedFn)

	const browseNodes = useComputed(() => {
		const rawNodes = internalNode ? [internalNode, ...nodes] : nodes

		// If there are no collections visible, merge ungrouped nodes into the main list
		// This hides the "Ungrouped Connections" header
		const hasCollections = rawNodes.some((n) => n.metadata.type === 'collection')
		if (!hasCollections && ungroupedNodes.length > 0) {
			return {
				nodes: [...rawNodes, ...ungroupedNodes],
				ungroupedNodes: [],
			}
		}

		return { nodes: rawNodes, ungroupedNodes }
	}, [nodes, ungroupedNodes, internalNode])

	const allEntityResults = useComputed(() => {
		const results: EntitySearchResult[] = []
		const collectResults = (node: CollapsibleTreeNode<EntityLeafItem, ConnectionTreeNodeMeta>) => {
			if (node.metadata.type === 'connection') {
				for (const leaf of node.leaves) {
					results.push({
						leaf,
						connectionLabel: node.metadata.connectionLabel,
						moduleDisplayName: node.metadata.moduleDisplayName,
						searchText: `${node.metadata.connectionLabel} ${node.metadata.moduleDisplayName ?? ''} ${leaf.searchLabel} ${leaf.description ?? ''}`,
					})
				}
			}
			for (const child of node.children) collectResults(child)
		}

		for (const node of [...browseNodes.nodes, ...browseNodes.ungroupedNodes]) collectResults(node)
		return results
	}, [browseNodes])

	const recentResults = useComputed(() => {
		const resultsById = new Map(allEntityResults.map((result) => [result.leaf.fullId, result]))
		return recentlyUsed.recentIds
			.map((id) => resultsById.get(id))
			.filter((result): result is EntitySearchResult => result !== undefined)
			.slice(0, 6)
	}, [allEntityResults, recentlyUsed.recentIds])

	const searchResults = useComputed(() => {
		if (!filter) return []

		return fuzzySearch(filter, allEntityResults, {
			key: 'searchText',
			threshold: 0.5,
		}).map((match) => match.obj)
	}, [filter, allEntityResults])

	useEffect(() => {
		setActiveResultIndex(0)
	}, [filter])

	useEffect(() => {
		if (!filter) return
		document.getElementById(`add-entity-search-result-${activeResultIndex}`)?.scrollIntoView({ block: 'nearest' })
	}, [filter, activeResultIndex])

	const handleSearchKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLInputElement>) => {
			if (!filter || searchResults.length === 0) return

			if (event.key === 'ArrowDown') {
				event.preventDefault()
				setActiveResultIndex((index) => Math.min(index + 1, searchResults.length - 1))
			} else if (event.key === 'ArrowUp') {
				event.preventDefault()
				setActiveResultIndex((index) => Math.max(index - 1, 0))
			} else if (event.key === 'Enter') {
				event.preventDefault()
				const result = searchResults[activeResultIndex]
				if (result) addAndTrackRecentUsage(result.leaf.fullId)
			}
		},
		[filter, searchResults, activeResultIndex, addAndTrackRecentUsage]
	)

	const noResultsContent = useMemo(
		() => (
			<NonIdealState icon={faSearch} text={`No ${entityTypeLabel}s match your search.`}>
				<Button color="primary" variant="outline" size="sm" onClick={() => setFilter('')}>
					Clear search
				</Button>
			</NonIdealState>
		),
		[entityTypeLabel]
	)

	return (
		<Modal.Root open={show} onOpenChange={setShow} onOpenChangeComplete={onOpenChangeComplete}>
			<Modal.Trigger
				color="primary"
				className="rounded-s-none"
				disabled={disabled}
				aria-label={`Browse ${capitalize(entityTypeLabel)}s`}
				title={`Browse ${capitalize(entityTypeLabel)}s`}
			>
				<FontAwesomeIcon icon={faFolderOpen} />
			</Modal.Trigger>

			<Modal.Portal>
				<Modal.Backdrop />
				<Modal.Viewport>
					<Modal.Popup size="lg" scrollable className="add-entities-modal">
						<Modal.Header closeButton className="add-entities-modal-header">
							<div className="add-entities-modal-header-content">
								<div className="add-entities-modal-title-row">
									<Modal.Title>Browse {capitalize(entityTypeLabel)}s</Modal.Title>
									{filter && (
										<span className="add-entities-modal-result-count" aria-live="polite">
											{searchResults.length} {searchResults.length === 1 ? 'result' : 'results'}
										</span>
									)}
								</div>
								<SearchBox
									filter={filter}
									setFilter={setFilter}
									className="w-full"
									placeholder={`Search ${entityTypeLabel}s...`}
									autoFocus
									onKeyDown={handleSearchKeyDown}
									ariaControls={filter ? 'add-entity-search-results' : undefined}
									ariaActiveDescendant={filter ? `add-entity-search-result-${activeResultIndex}` : undefined}
								/>
							</div>
						</Modal.Header>
						<Modal.Body>
							<EntityTypeLabelContext.Provider value={entityTypeLabel}>
								{filter ? (
									searchResults.length > 0 ? (
										<div id="add-entity-search-results" className="add-entity-search-results" role="listbox">
											{searchResults.map((result, index) => (
												<EntityResultRow
													key={result.leaf.fullId}
													id={`add-entity-search-result-${index}`}
													result={result}
													active={index === activeResultIndex}
													onActivate={() => setActiveResultIndex(index)}
													onSelect={() => addAndTrackRecentUsage(result.leaf.fullId)}
												/>
											))}
										</div>
									) : (
										noResultsContent
									)
								) : (
									<>
										{recentResults.length > 0 && (
											<section className="add-entity-recent-section" aria-labelledby="add-entity-recent-title">
												<h3 id="add-entity-recent-title">
													<FontAwesomeIcon icon={faClockRotateLeft} /> Recently used
												</h3>
												<div className="add-entity-search-results" role="listbox">
													{recentResults.map((result) => (
														<EntityResultRow
															key={result.leaf.fullId}
															result={result}
															onSelect={() => addAndTrackRecentUsage(result.leaf.fullId)}
														/>
													))}
												</div>
											</section>
										)}
										<CollapsibleTree
											nodes={browseNodes.nodes}
											ungroupedNodes={browseNodes.ungroupedNodes}
											ungroupedLabel="Ungrouped Connections"
											collapseHelper={collapseHelper}
											selectedLeafKey={null}
											HeaderComponent={AddEntityGroupHeader}
											LeafComponent={AddEntityLeaf}
											onLeafClick={(leaf) => addAndTrackRecentUsage(leaf.fullId)}
										/>
									</>
								)}
							</EntityTypeLabelContext.Provider>
						</Modal.Body>
					</Modal.Popup>
				</Modal.Viewport>
			</Modal.Portal>
		</Modal.Root>
	)
})

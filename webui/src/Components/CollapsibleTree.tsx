import React, { useCallback } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCaretRight, faCaretDown } from '@fortawesome/free-solid-svg-icons'
import classNames from 'classnames'

/**
 * A node in the collapsible tree. Nodes can have children (making them collapsible groups)
 * and/or be leaf nodes with no children.
 */
export interface CollapsibleTreeNode<TLeafData = unknown, TNodeMeta = unknown> {
	/** Unique identifier for the node */
	id: string
	/** Nodes that appear as collapsible sub-groups */
	children: CollapsibleTreeNode<TLeafData, TNodeMeta>[]
	/** Leaf items that appear inside this node when expanded */
	leafs: TLeafData[]
	/** Arbitrary metadata for the consumer to distinguish node types */
	metadata: TNodeMeta
}

interface CollapsibleTreeProps<TLeafData, TNodeMeta> {
	/** The root-level tree nodes to render */
	nodes: CollapsibleTreeNode<TLeafData, TNodeMeta>[]
	/** Ungrouped nodes to render at the bottom (shown under a header) */
	ungroupedNodes?: CollapsibleTreeNode<TLeafData, TNodeMeta>[]
	/** Ungrouped leaf items to render at the bottom */
	ungroupedLeafs?: TLeafData[]
	/** Label for the ungrouped section header */
	ungroupedLabel?: string
	/** Set of node IDs that are currently expanded */
	expandedNodeIds: ReadonlySet<string>
	/** Callback to toggle the expanded state of a node */
	toggleNodeExpanded: (nodeId: string) => void
	/** Renders the header content for a group node */
	renderGroupHeader: (node: CollapsibleTreeNode<TLeafData, TNodeMeta>, nestingLevel: number) => React.ReactNode
	/** Renders a single leaf item */
	renderLeaf: (leaf: TLeafData, nestingLevel: number) => React.ReactNode
	/** Optional extra class name for the root element */
	className?: string
}

/**
 * A lightweight, read-only collapsible tree component.
 *
 * Unlike CollectionsNestingTable, this does not support drag-and-drop or
 * localStorage persistence. It is intended for read-only selection UIs
 * like modals and connection pickers.
 */
export function CollapsibleTree<TLeafData, TNodeMeta>({
	nodes,
	ungroupedNodes,
	ungroupedLeafs,
	ungroupedLabel,
	expandedNodeIds,
	toggleNodeExpanded,
	renderGroupHeader,
	renderLeaf,
	className,
}: CollapsibleTreeProps<TLeafData, TNodeMeta>): React.JSX.Element {
	const hasUngrouped = (ungroupedNodes && ungroupedNodes.length > 0) || (ungroupedLeafs && ungroupedLeafs.length > 0)

	return (
		<div className={classNames('collapsible-tree', className)}>
			<CollapsibleTreeNodeList
				nodes={nodes}
				expandedNodeIds={expandedNodeIds}
				toggleNodeExpanded={toggleNodeExpanded}
				renderGroupHeader={renderGroupHeader}
				renderLeaf={renderLeaf}
				nestingLevel={0}
			/>

			{hasUngrouped && nodes.length > 0 && (
				<div className="collapsible-tree-ungrouped-header">
					<span>{ungroupedLabel ?? 'Ungrouped'}</span>
				</div>
			)}

			{ungroupedNodes && (
				<CollapsibleTreeNodeList
					nodes={ungroupedNodes}
					expandedNodeIds={expandedNodeIds}
					toggleNodeExpanded={toggleNodeExpanded}
					renderGroupHeader={renderGroupHeader}
					renderLeaf={renderLeaf}
					nestingLevel={0}
				/>
			)}

			{ungroupedLeafs?.map((leaf, index) => (
				<React.Fragment key={index}>{renderLeaf(leaf, 0)}</React.Fragment>
			))}
		</div>
	)
}

interface CollapsibleTreeNodeListProps<TLeafData, TNodeMeta> {
	nodes: CollapsibleTreeNode<TLeafData, TNodeMeta>[]
	expandedNodeIds: ReadonlySet<string>
	toggleNodeExpanded: (nodeId: string) => void
	renderGroupHeader: (node: CollapsibleTreeNode<TLeafData, TNodeMeta>, nestingLevel: number) => React.ReactNode
	renderLeaf: (leaf: TLeafData, nestingLevel: number) => React.ReactNode
	nestingLevel: number
}

function CollapsibleTreeNodeList<TLeafData, TNodeMeta>({
	nodes,
	expandedNodeIds,
	toggleNodeExpanded,
	renderGroupHeader,
	renderLeaf,
	nestingLevel,
}: CollapsibleTreeNodeListProps<TLeafData, TNodeMeta>): React.JSX.Element {
	return (
		<>
			{nodes.map((node) => (
				<CollapsibleTreeNodeSingle
					key={node.id}
					node={node}
					expandedNodeIds={expandedNodeIds}
					toggleNodeExpanded={toggleNodeExpanded}
					renderGroupHeader={renderGroupHeader}
					renderLeaf={renderLeaf}
					nestingLevel={nestingLevel}
				/>
			))}
		</>
	)
}

interface CollapsibleTreeNodeSingleProps<TLeafData, TNodeMeta> {
	node: CollapsibleTreeNode<TLeafData, TNodeMeta>
	expandedNodeIds: ReadonlySet<string>
	toggleNodeExpanded: (nodeId: string) => void
	renderGroupHeader: (node: CollapsibleTreeNode<TLeafData, TNodeMeta>, nestingLevel: number) => React.ReactNode
	renderLeaf: (leaf: TLeafData, nestingLevel: number) => React.ReactNode
	nestingLevel: number
}

function CollapsibleTreeNodeSingle<TLeafData, TNodeMeta>({
	node,
	expandedNodeIds,
	toggleNodeExpanded,
	renderGroupHeader,
	renderLeaf,
	nestingLevel,
}: CollapsibleTreeNodeSingleProps<TLeafData, TNodeMeta>): React.JSX.Element {
	const isExpanded = expandedNodeIds.has(node.id)
	const doToggle = useCallback(() => toggleNodeExpanded(node.id), [toggleNodeExpanded, node.id])

	return (
		<>
			<div className="collapsible-tree-group-row" onClick={doToggle}>
				<CollapsibleTreeNesting nestingLevel={nestingLevel}>
					<FontAwesomeIcon icon={isExpanded ? faCaretDown : faCaretRight} className="collapsible-tree-caret" />
					{renderGroupHeader(node, nestingLevel)}
				</CollapsibleTreeNesting>
			</div>

			{isExpanded && (
				<>
					<CollapsibleTreeNodeList
						nodes={node.children}
						expandedNodeIds={expandedNodeIds}
						toggleNodeExpanded={toggleNodeExpanded}
						renderGroupHeader={renderGroupHeader}
						renderLeaf={renderLeaf}
						nestingLevel={nestingLevel + 1}
					/>

					{node.leafs.map((leaf, index) => (
						<React.Fragment key={index}>{renderLeaf(leaf, nestingLevel + 1)}</React.Fragment>
					))}
				</>
			)}
		</>
	)
}

export function CollapsibleTreeNesting({
	nestingLevel,
	className,
	children,
}: React.PropsWithChildren<{ nestingLevel: number; className?: string }>): React.JSX.Element {
	return (
		<div
			style={{
				'--collapsible-tree-nesting-level': nestingLevel,
			} as React.CSSProperties}
			className={classNames(className, {
				'collapsible-tree-nesting': nestingLevel > 0,
			})}
		>
			{children}
		</div>
	)
}

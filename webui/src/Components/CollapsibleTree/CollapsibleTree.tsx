import React, { useCallback } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCaretRight, faCaretDown } from '@fortawesome/free-solid-svg-icons'
import classNames from 'classnames'
import type { PanelCollapseHelper } from '~/Helpers/CollapseHelper.js'
import { observer } from 'mobx-react-lite'

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
	/** Static leaf items to show at the top (always visible, above everything else) */
	staticLeafs?: TLeafData[]
	/** Ungrouped nodes to render at the bottom (shown under a header) */
	ungroupedNodes?: CollapsibleTreeNode<TLeafData, TNodeMeta>[]
	/** Ungrouped leaf items to render at the bottom */
	ungroupedLeafs?: TLeafData[]
	/** Label for the ungrouped section header */
	ungroupedLabel?: string
	/** Collapse helper (handles expand/collapse state). Pass `null` to force all nodes expanded (e.g. during search). */
	collapseHelper: PanelCollapseHelper | null
	/** Renders the header content for a group node */
	renderGroupHeader: (node: CollapsibleTreeNode<TLeafData, TNodeMeta>, nestingLevel: number) => React.ReactNode
	/** Renders a single leaf item */
	renderLeaf: (leaf: TLeafData) => React.ReactNode
	/** Callback for when a leaf item row is clicked */
	onLeafClick?: (leaf: TLeafData) => void
	/** Content to show when the tree has no nodes or leafs at all */
	noContent?: React.ReactNode
	/** Optional extra class name for the root element */
	className?: string
}

/**
 * A lightweight, read-only collapsible tree component.
 *
 * Unlike CollectionsNestingTable, this does not support drag-and-drop.
 * It is intended for read-only selection UIs like modals and connection pickers.
 */
export const CollapsibleTree = observer(function CollapsibleTree<TLeafData, TNodeMeta>({
	nodes,
	staticLeafs,
	ungroupedNodes,
	ungroupedLeafs,
	ungroupedLabel,
	collapseHelper,
	renderGroupHeader,
	renderLeaf,
	onLeafClick,
	noContent,
	className,
}: CollapsibleTreeProps<TLeafData, TNodeMeta>): React.JSX.Element {
	const hasUngrouped = (ungroupedNodes && ungroupedNodes.length > 0) || (ungroupedLeafs && ungroupedLeafs.length > 0)
	const hasContent = nodes.length > 0 || hasUngrouped || (staticLeafs && staticLeafs.length > 0)

	if (!hasContent && noContent) {
		return <>{noContent}</>
	}

	return (
		<div className={classNames('collapsible-tree', className)}>
			{staticLeafs &&
				staticLeafs.map((leaf, index) => (
					<CollapsibleTreeLeafWrapper
						key={index}
						leaf={leaf}
						nestingLevel={0}
						renderLeaf={renderLeaf}
						onLeafClick={onLeafClick}
					/>
				))}

			<CollapsibleTreeNodeList
				nodes={nodes}
				collapseHelper={collapseHelper}
				renderGroupHeader={renderGroupHeader}
				renderLeaf={renderLeaf}
				onLeafClick={onLeafClick}
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
					collapseHelper={collapseHelper}
					renderGroupHeader={renderGroupHeader}
					renderLeaf={renderLeaf}
					onLeafClick={onLeafClick}
					nestingLevel={0}
				/>
			)}

			{ungroupedLeafs?.map((leaf, index) => (
				<CollapsibleTreeLeafWrapper
					key={index}
					leaf={leaf}
					nestingLevel={0}
					renderLeaf={renderLeaf}
					onLeafClick={onLeafClick}
				/>
			))}
		</div>
	)
})

interface CollapsibleTreeLeafWrapperProps<TLeafData> {
	leaf: TLeafData
	nestingLevel: number
	renderLeaf: (leaf: TLeafData) => React.ReactNode
	onLeafClick?: (leaf: TLeafData) => void
}

function CollapsibleTreeLeafWrapper<TLeafData>({
	leaf,
	nestingLevel,
	renderLeaf,
	onLeafClick,
}: CollapsibleTreeLeafWrapperProps<TLeafData>) {
	return (
		<div className="collapsible-tree-leaf-row" onClick={onLeafClick ? () => onLeafClick(leaf) : undefined}>
			<CollapsibleTreeNesting nestingLevel={nestingLevel} className="collapsible-tree-leaf-content">
				{renderLeaf(leaf)}
			</CollapsibleTreeNesting>
		</div>
	)
}

interface CollapsibleTreeNodeListProps<TLeafData, TNodeMeta> {
	nodes: CollapsibleTreeNode<TLeafData, TNodeMeta>[]
	collapseHelper: PanelCollapseHelper | null
	renderGroupHeader: (node: CollapsibleTreeNode<TLeafData, TNodeMeta>, nestingLevel: number) => React.ReactNode
	renderLeaf: (leaf: TLeafData) => React.ReactNode
	onLeafClick?: (leaf: TLeafData) => void
	nestingLevel: number
}

const CollapsibleTreeNodeList = observer(function CollapsibleTreeNodeList<TLeafData, TNodeMeta>({
	nodes,
	collapseHelper,
	renderGroupHeader,
	renderLeaf,
	onLeafClick,
	nestingLevel,
}: CollapsibleTreeNodeListProps<TLeafData, TNodeMeta>): React.JSX.Element {
	return (
		<>
			{nodes.map((node) => (
				<CollapsibleTreeNodeSingle
					key={node.id}
					node={node}
					collapseHelper={collapseHelper}
					renderGroupHeader={renderGroupHeader}
					renderLeaf={renderLeaf}
					onLeafClick={onLeafClick}
					nestingLevel={nestingLevel}
				/>
			))}
		</>
	)
})

interface CollapsibleTreeNodeSingleProps<TLeafData, TNodeMeta> {
	node: CollapsibleTreeNode<TLeafData, TNodeMeta>
	collapseHelper: PanelCollapseHelper | null
	renderGroupHeader: (node: CollapsibleTreeNode<TLeafData, TNodeMeta>, nestingLevel: number) => React.ReactNode
	renderLeaf: (leaf: TLeafData) => React.ReactNode
	onLeafClick?: (leaf: TLeafData) => void
	nestingLevel: number
}

const CollapsibleTreeNodeSingle = observer(function CollapsibleTreeNodeSingle<TLeafData, TNodeMeta>({
	node,
	collapseHelper,
	renderGroupHeader,
	renderLeaf,
	onLeafClick,
	nestingLevel,
}: CollapsibleTreeNodeSingleProps<TLeafData, TNodeMeta>): React.JSX.Element {
	// If collapseHelper is null, all nodes are force-expanded (e.g. during search)
	const isExpanded = collapseHelper ? !collapseHelper.isPanelCollapsed(null, node.id) : true
	const doToggle = useCallback(() => collapseHelper?.togglePanelCollapsed(null, node.id), [collapseHelper, node.id])

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
						collapseHelper={collapseHelper}
						renderGroupHeader={renderGroupHeader}
						renderLeaf={renderLeaf}
						onLeafClick={onLeafClick}
						nestingLevel={nestingLevel + 1}
					/>

					{node.leafs.map((leaf, index) => (
						<CollapsibleTreeLeafWrapper
							key={index}
							leaf={leaf}
							nestingLevel={nestingLevel + 1}
							renderLeaf={renderLeaf}
							onLeafClick={onLeafClick}
						/>
					))}
				</>
			)}
		</>
	)
})

export function CollapsibleTreeNesting({
	nestingLevel,
	className,
	children,
}: React.PropsWithChildren<{ nestingLevel: number; className?: string }>): React.JSX.Element {
	return (
		<div
			style={
				{
					'--collapsible-tree-nesting-level': nestingLevel,
				} as React.CSSProperties
			}
			className={classNames(className, {
				'collapsible-tree-nesting': nestingLevel > 0,
			})}
		>
			{children}
		</div>
	)
}

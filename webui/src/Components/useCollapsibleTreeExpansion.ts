import { useState, useCallback, useMemo } from 'react'

interface CollapsibleTreeExpansionState {
	/** Set of currently expanded node IDs */
	expandedNodeIds: ReadonlySet<string>
	/** Toggle the expanded state of a single node */
	toggleNodeExpanded: (nodeId: string) => void
	/** Expand all provided node IDs */
	expandAll: (nodeIds: string[]) => void
	/** Collapse all nodes */
	collapseAll: () => void
}

/**
 * Manages the expand/collapse state for a CollapsibleTree.
 * Does not persist to localStorage - state resets when the component unmounts.
 *
 * @param forceExpanded - when true, all nodes are treated as expanded regardless of state
 *                        (useful for search/filter mode)
 */
export function useCollapsibleTreeExpansion(forceExpanded: boolean): CollapsibleTreeExpansionState {
	const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(new Set())

	const toggleNodeExpanded = useCallback((nodeId: string) => {
		setExpandedIds((prev) => {
			const next = new Set(prev)
			if (next.has(nodeId)) {
				next.delete(nodeId)
			} else {
				next.add(nodeId)
			}
			return next
		})
	}, [])

	const expandAll = useCallback((nodeIds: string[]) => {
		setExpandedIds(new Set(nodeIds))
	}, [])

	const collapseAll = useCallback(() => {
		setExpandedIds(new Set())
	}, [])

	// When forceExpanded is true, return infinite set that always has every id
	const effectiveExpandedIds = useMemo(() => {
		if (!forceExpanded) return expandedIds

		return new Proxy(new Set<string>(), {
			get(target, prop) {
				if (prop === 'has') return () => true
				return Reflect.get(target, prop)
			},
		}) as ReadonlySet<string>
	}, [forceExpanded, expandedIds])

	return {
		expandedNodeIds: effectiveExpandedIds,
		toggleNodeExpanded,
		expandAll,
		collapseAll,
	}
}

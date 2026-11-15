import type { CollapsibleTreeNode } from './CollapsibleTree.js'

/** How many leaves a node holds, including those of the nodes inside it */
export function countTreeLeaves(node: CollapsibleTreeNode<unknown, unknown>): number {
	return node.leaves.length + node.children.reduce((count, child) => count + countTreeLeaves(child), 0)
}

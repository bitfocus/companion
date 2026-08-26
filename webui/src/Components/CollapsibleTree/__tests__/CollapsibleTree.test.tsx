import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePanelCollapseHelper, type PanelCollapseDefaultCollapsed } from '~/Helpers/CollapseHelper.js'
import {
	CollapsibleTree,
	type CollapsibleTreeHeaderProps,
	type CollapsibleTreeLeafProps,
	type CollapsibleTreeNode,
} from '../CollapsibleTree.js'

// ---------------------------------------------------------------------------
// Fixtures & helpers
// ---------------------------------------------------------------------------

interface Leaf {
	key: string
	label: string
}
type Meta = { label: string }
type Node = CollapsibleTreeNode<Leaf, Meta>

function leaf(label: string): Leaf {
	return { key: label, label }
}

/** Build a group node. `leaves` are label strings, `children` are nested nodes. */
function node(id: string, label: string, leaves: string[] = [], children: Node[] = []): Node {
	return {
		id,
		children,
		leaves: leaves.map(leaf),
		metadata: { label },
	}
}

function Header({ node }: CollapsibleTreeHeaderProps<Leaf, Meta>) {
	return <span>{node.metadata.label}</span>
}

function LeafComp({ leaf }: CollapsibleTreeLeafProps<Leaf>) {
	return <span>{leaf.label}</span>
}

type RenderProps = {
	nodes?: Node[]
	staticLeaves?: Leaf[]
	ungroupedNodes?: Node[]
	ungroupedLeaves?: Leaf[]
	ungroupedLabel?: string
	onLeafClick?: (leaf: Leaf) => void
	noContent?: React.ReactNode
	className?: string
	// harness-only knobs
	storageId?: string | null
	defaultCollapsed?: PanelCollapseDefaultCollapsed
	forceNullHelper?: boolean
}

function renderTree(props: RenderProps = {}) {
	function Harness() {
		const helper = usePanelCollapseHelper(props.storageId ?? null, null, props.defaultCollapsed ?? false)
		return (
			<CollapsibleTree
				nodes={props.nodes ?? []}
				staticLeaves={props.staticLeaves}
				ungroupedNodes={props.ungroupedNodes}
				ungroupedLeaves={props.ungroupedLeaves}
				ungroupedLabel={props.ungroupedLabel}
				collapseHelper={props.forceNullHelper ? null : helper}
				HeaderComponent={Header}
				LeafComponent={LeafComp}
				onLeafClick={props.onLeafClick}
				noContent={props.noContent}
				className={props.className}
			/>
		)
	}
	return render(<Harness />)
}

/** A group header row, identified by its label (accessible name). */
function groupRow(label: string): HTMLElement {
	return screen.getByRole('button', { name: label })
}

const THREE_GROUPS = [
	node('a', 'Group A', ['a-leaf']),
	node('b', 'Group B', ['b-leaf']),
	node('c', 'Group C', ['c-leaf']),
]

// jsdom (opaque origin) provides no localStorage; install a fresh in-memory stub per test so the
// persistence tests have somewhere to read/write.
class LocalStorageStub {
	#store = new Map<string, string>()
	getItem(key: string): string | null {
		return this.#store.has(key) ? this.#store.get(key)! : null
	}
	setItem(key: string, value: string): void {
		this.#store.set(key, String(value))
	}
	removeItem(key: string): void {
		this.#store.delete(key)
	}
	clear(): void {
		this.#store.clear()
	}
	key(index: number): string | null {
		return [...this.#store.keys()][index] ?? null
	}
	get length(): number {
		return this.#store.size
	}
}

beforeEach(() => {
	Object.defineProperty(window, 'localStorage', { configurable: true, value: new LocalStorageStub() })
})

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe('CollapsibleTree', () => {
	describe('Rendering', () => {
		it('renders each group header and its leaves (expanded by default)', () => {
			renderTree({ nodes: THREE_GROUPS })
			expect(groupRow('Group A')).toBeInTheDocument()
			expect(screen.getByText('a-leaf')).toBeInTheDocument()
			expect(screen.getByText('b-leaf')).toBeInTheDocument()
			expect(screen.getByText('c-leaf')).toBeInTheDocument()
		})

		it('renders static leaves at the top, always visible', () => {
			renderTree({ nodes: THREE_GROUPS, staticLeaves: [leaf('pinned')] })
			expect(screen.getByText('pinned')).toBeInTheDocument()
		})

		it('renders nested children indented one level deeper', () => {
			const nodes = [node('p', 'Parent', [], [node('c1', 'Child 1', ['deep-leaf'])])]
			const { container } = renderTree({ nodes })
			expect(groupRow('Parent')).toBeInTheDocument()
			expect(groupRow('Child 1')).toBeInTheDocument()
			expect(screen.getByText('deep-leaf')).toBeInTheDocument()
			// the deep leaf sits at nesting level 2
			const deep = screen.getByText('deep-leaf').closest('.collapsible-tree-nesting') as HTMLElement
			expect(deep.style.getPropertyValue('--collapsible-tree-nesting-level')).toBe('2')
			expect(container.querySelector('.collapsible-tree')).toBeTruthy()
		})

		it('renders ungrouped nodes and leaves below a header when there are grouped nodes', () => {
			renderTree({
				nodes: THREE_GROUPS,
				ungroupedNodes: [node('u', 'Ungrouped Group', ['u-leaf'])],
				ungroupedLeaves: [leaf('loose-leaf')],
			})
			expect(screen.getByText('Ungrouped')).toBeInTheDocument() // default label
			expect(screen.getByText('u-leaf')).toBeInTheDocument()
			expect(screen.getByText('loose-leaf')).toBeInTheDocument()
		})

		it('uses a custom ungrouped label', () => {
			renderTree({
				nodes: THREE_GROUPS,
				ungroupedNodes: [node('u', 'Ungrouped Group', ['u-leaf'])],
				ungroupedLabel: 'Ungrouped Connections',
			})
			expect(screen.getByText('Ungrouped Connections')).toBeInTheDocument()
		})

		it('does not render the ungrouped header when there are no grouped nodes', () => {
			renderTree({ nodes: [], ungroupedNodes: [node('u', 'Ungrouped Group', ['u-leaf'])] })
			expect(screen.queryByText('Ungrouped')).toBeNull()
			// but the ungrouped content is still shown
			expect(screen.getByText('u-leaf')).toBeInTheDocument()
		})

		it('applies an extra className to the root', () => {
			const { container } = renderTree({ nodes: THREE_GROUPS, className: 'my-extra-class' })
			expect(container.querySelector('.collapsible-tree.my-extra-class')).toBeTruthy()
		})

		it('shows noContent when the tree is completely empty', () => {
			renderTree({ nodes: [], noContent: <div>Nothing here</div> })
			expect(screen.getByText('Nothing here')).toBeInTheDocument()
		})

		it('does not show noContent when there is any content', () => {
			renderTree({ nodes: THREE_GROUPS, noContent: <div>Nothing here</div> })
			expect(screen.queryByText('Nothing here')).toBeNull()
		})

		it('renders an empty tree (no crash) when empty and no noContent given', () => {
			const { container } = renderTree({ nodes: [] })
			expect(container.querySelector('.collapsible-tree')).toBeTruthy()
			expect(screen.queryByRole('button')).toBeNull()
		})
	})

	// ---------------------------------------------------------------------------
	// Expand / collapse
	// ---------------------------------------------------------------------------

	describe('Expand/collapse', () => {
		it('clicking a header collapses only that group', async () => {
			const user = userEvent.setup()
			renderTree({ nodes: THREE_GROUPS })
			await user.click(groupRow('Group B'))
			expect(screen.queryByText('b-leaf')).toBeNull()
			expect(screen.getByText('a-leaf')).toBeInTheDocument()
			expect(screen.getByText('c-leaf')).toBeInTheDocument()
		})

		it('clicking a collapsed header expands it again', async () => {
			const user = userEvent.setup()
			renderTree({ nodes: THREE_GROUPS })
			await user.click(groupRow('Group B'))
			expect(screen.queryByText('b-leaf')).toBeNull()
			await user.click(groupRow('Group B'))
			expect(screen.getByText('b-leaf')).toBeInTheDocument()
		})

		it('groups start collapsed when defaultCollapsed is true', () => {
			renderTree({ nodes: THREE_GROUPS, defaultCollapsed: true })
			expect(screen.queryByText('a-leaf')).toBeNull()
			expect(groupRow('Group A')).toHaveAttribute('aria-expanded', 'false')
		})

		it('supports a per-panel defaultCollapsed function', () => {
			// collapse everything except Group B
			renderTree({ nodes: THREE_GROUPS, defaultCollapsed: (id) => id !== 'b' })
			expect(screen.queryByText('a-leaf')).toBeNull()
			expect(screen.getByText('b-leaf')).toBeInTheDocument()
			expect(screen.queryByText('c-leaf')).toBeNull()
		})

		it('reflects expanded state in aria-expanded and the caret icon', async () => {
			const user = userEvent.setup()
			renderTree({ nodes: THREE_GROUPS })
			const row = groupRow('Group A')
			expect(row).toHaveAttribute('aria-expanded', 'true')
			expect(row.querySelector('[data-icon="caret-down"]')).toBeTruthy()

			await user.click(row)
			expect(groupRow('Group A')).toHaveAttribute('aria-expanded', 'false')
			expect(groupRow('Group A').querySelector('[data-icon="caret-right"]')).toBeTruthy()
		})

		it('toggles via the Enter and Space keys', () => {
			renderTree({ nodes: THREE_GROUPS })
			fireEvent.keyDown(groupRow('Group A'), { key: 'Enter' })
			expect(screen.queryByText('a-leaf')).toBeNull()
			fireEvent.keyDown(groupRow('Group A'), { key: ' ' })
			expect(screen.getByText('a-leaf')).toBeInTheDocument()
		})

		it('ignores other keys', () => {
			renderTree({ nodes: THREE_GROUPS })
			fireEvent.keyDown(groupRow('Group A'), { key: 'a' })
			expect(screen.getByText('a-leaf')).toBeInTheDocument()
		})
	})

	// ---------------------------------------------------------------------------
	// Alt+click — toggle the whole level
	// ---------------------------------------------------------------------------

	describe('Alt+click toggles the whole level', () => {
		it('collapses every sibling when alt+clicking an expanded header', () => {
			renderTree({ nodes: THREE_GROUPS })
			fireEvent.click(groupRow('Group A'), { altKey: true })
			expect(screen.queryByText('a-leaf')).toBeNull()
			expect(screen.queryByText('b-leaf')).toBeNull()
			expect(screen.queryByText('c-leaf')).toBeNull()
		})

		it('expands every sibling when alt+clicking a collapsed header', async () => {
			const user = userEvent.setup()
			renderTree({ nodes: THREE_GROUPS })
			await user.click(groupRow('Group A'))
			await user.click(groupRow('Group B'))
			await user.click(groupRow('Group C'))
			expect(screen.queryByText('a-leaf')).toBeNull()

			fireEvent.click(groupRow('Group A'), { altKey: true })
			expect(screen.getByText('a-leaf')).toBeInTheDocument()
			expect(screen.getByText('b-leaf')).toBeInTheDocument()
			expect(screen.getByText('c-leaf')).toBeInTheDocument()
		})

		it('only affects siblings within the same parent', () => {
			const nodes = [
				node('p', 'Parent', [], [node('c1', 'Child 1', ['c1-leaf']), node('c2', 'Child 2', ['c2-leaf'])]),
				node('q', 'Other', ['q-leaf']),
			]
			renderTree({ nodes })
			// alt+click a child collapses its siblings, but not the unrelated top-level group
			fireEvent.click(groupRow('Child 1'), { altKey: true })
			expect(screen.queryByText('c1-leaf')).toBeNull()
			expect(screen.queryByText('c2-leaf')).toBeNull()
			expect(screen.getByText('q-leaf')).toBeInTheDocument()
			// the child headers themselves remain (parent is still expanded)
			expect(groupRow('Child 1')).toBeInTheDocument()
			expect(groupRow('Child 2')).toBeInTheDocument()
		})

		it('works from the keyboard with the Alt modifier held', () => {
			renderTree({ nodes: THREE_GROUPS })
			fireEvent.keyDown(groupRow('Group A'), { key: 'Enter', altKey: true })
			expect(screen.queryByText('a-leaf')).toBeNull()
			expect(screen.queryByText('b-leaf')).toBeNull()
			expect(screen.queryByText('c-leaf')).toBeNull()
		})

		it('behaves as a normal single toggle when the node has no siblings', () => {
			const nodes = [node('p', 'Parent', [], [node('c1', 'Only Child', ['only-leaf'])])]
			renderTree({ nodes })
			// alt+click on the sole child just toggles itself, parent stays put
			fireEvent.click(groupRow('Only Child'), { altKey: true })
			expect(screen.queryByText('only-leaf')).toBeNull()
			expect(groupRow('Only Child')).toBeInTheDocument()
		})

		it('exposes the alt+click hint via title only when there are siblings', () => {
			const nodes = [node('p', 'Parent', [], [node('c1', 'Only Child', ['only-leaf'])])]
			renderTree({ nodes })
			expect(groupRow('Parent').getAttribute('title')).toBeNull()
			expect(groupRow('Only Child').getAttribute('title')).toBeNull()
		})

		it('shows the alt+click hint title when there are siblings', () => {
			renderTree({ nodes: THREE_GROUPS })
			expect(groupRow('Group A')).toHaveAttribute('title', 'Alt+click to expand/collapse all at this level')
		})
	})

	// ---------------------------------------------------------------------------
	// Leaf interaction
	// ---------------------------------------------------------------------------

	describe('Leaf interaction', () => {
		it('calls onLeafClick when a leaf is clicked', async () => {
			const onLeafClick = vi.fn()
			const user = userEvent.setup()
			renderTree({ nodes: THREE_GROUPS, onLeafClick })
			await user.click(screen.getByText('a-leaf'))
			expect(onLeafClick).toHaveBeenCalledWith(expect.objectContaining({ key: 'a-leaf' }))
		})

		it('activates a leaf via Enter and Space', () => {
			const onLeafClick = vi.fn()
			renderTree({ nodes: THREE_GROUPS, onLeafClick })
			const row = screen.getByRole('button', { name: 'a-leaf' })
			fireEvent.keyDown(row, { key: 'Enter' })
			fireEvent.keyDown(row, { key: ' ' })
			expect(onLeafClick).toHaveBeenCalledTimes(2)
		})

		it('fires onLeafClick for static and ungrouped leaves', async () => {
			const onLeafClick = vi.fn()
			const user = userEvent.setup()
			renderTree({
				nodes: THREE_GROUPS,
				staticLeaves: [leaf('pinned')],
				ungroupedLeaves: [leaf('loose-leaf')],
				onLeafClick,
			})
			await user.click(screen.getByText('pinned'))
			await user.click(screen.getByText('loose-leaf'))
			expect(onLeafClick).toHaveBeenCalledWith(expect.objectContaining({ key: 'pinned' }))
			expect(onLeafClick).toHaveBeenCalledWith(expect.objectContaining({ key: 'loose-leaf' }))
		})

		it('leaf rows are not interactive when onLeafClick is omitted', () => {
			renderTree({ nodes: THREE_GROUPS })
			// only the three group headers are buttons; leaves are not
			expect(screen.getAllByRole('button')).toHaveLength(3)
			const leafRow = screen.getByText('a-leaf').closest('.collapsible-tree-leaf-row') as HTMLElement
			expect(leafRow).not.toHaveAttribute('role')
			expect(leafRow).not.toHaveAttribute('tabindex')
		})
	})

	// ---------------------------------------------------------------------------
	// Search mode (collapseHelper = null forces everything expanded)
	// ---------------------------------------------------------------------------

	describe('Force-expanded mode (collapseHelper=null)', () => {
		it('renders every group expanded regardless of stored state', () => {
			renderTree({ nodes: THREE_GROUPS, forceNullHelper: true })
			expect(screen.getByText('a-leaf')).toBeInTheDocument()
			expect(screen.getByText('b-leaf')).toBeInTheDocument()
			expect(screen.getByText('c-leaf')).toBeInTheDocument()
			expect(groupRow('Group A')).toHaveAttribute('aria-expanded', 'true')
		})

		it('clicking a header is a no-op (stays expanded)', async () => {
			const user = userEvent.setup()
			renderTree({ nodes: THREE_GROUPS, forceNullHelper: true })
			await user.click(groupRow('Group A'))
			expect(screen.getByText('a-leaf')).toBeInTheDocument()
			expect(groupRow('Group A')).toHaveAttribute('aria-expanded', 'true')
		})
	})

	// ---------------------------------------------------------------------------
	// Persistence
	// ---------------------------------------------------------------------------

	describe('Persistence', () => {
		it('remembers collapse state across remounts when given a storageId', async () => {
			const user = userEvent.setup()
			const storageId = 'test_tree_persist'

			const first = renderTree({ nodes: THREE_GROUPS, storageId })
			await user.click(within(first.container).getByRole('button', { name: 'Group B' }))
			expect(within(first.container).queryByText('b-leaf')).toBeNull()
			first.unmount()

			// fresh mount, same storage key — Group B should still be collapsed
			const second = renderTree({ nodes: THREE_GROUPS, storageId })
			expect(within(second.container).queryByText('b-leaf')).toBeNull()
			expect(within(second.container).getByText('a-leaf')).toBeInTheDocument()
		})

		it('does not persist across remounts without a storageId', async () => {
			const user = userEvent.setup()
			const first = renderTree({ nodes: THREE_GROUPS })
			await user.click(within(first.container).getByRole('button', { name: 'Group B' }))
			expect(within(first.container).queryByText('b-leaf')).toBeNull()
			first.unmount()

			const second = renderTree({ nodes: THREE_GROUPS })
			expect(within(second.container).getByText('b-leaf')).toBeInTheDocument()
		})
	})
})

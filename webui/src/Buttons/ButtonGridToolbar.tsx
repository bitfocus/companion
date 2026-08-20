import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import {
	faArrowPointer,
	faArrowsAlt,
	faArrowsLeftRight,
	faCopy,
	faHandPointer,
	faSquareCheck,
	faTrash,
	faUpDownLeftRight,
	faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useCallback } from 'react'
import { Toolbar } from '~/Components/Toolbar.js'
import {
	useButtonGridView,
	useGridActiveToolId,
	useGridHint,
	useGridPressMode,
	useGridSelectionCount,
	useGridSelectionPageNumber,
} from './ButtonGridViewContext.js'
import type { GridToolId } from './GridTools/index.js'

interface ToolDefinition {
	id: GridToolId
	label: string
	icon: IconDefinition
	title: string
	/** Set for a tool that does something irreversible or live, so it can shout about being active */
	dangerous?: boolean
}

/**
 * Select and press decide what a plain tap does; the rest are the pick-then-place tools that used to
 * live in a bar underneath the grid.
 */
const NAVIGATION_TOOLS: ToolDefinition[] = [
	{ id: 'select', label: 'Select', icon: faArrowPointer, title: 'Select buttons' },
	{ id: 'multi-select', label: 'Multi', icon: faSquareCheck, title: 'Tap buttons to add or remove them' },
	{ id: 'arrange', label: 'Arrange', icon: faUpDownLeftRight, title: 'Drag any button to move it' },
	{
		id: 'press',
		label: 'Press',
		icon: faHandPointer,
		title: 'Press buttons for real, running their actions',
		dangerous: true,
	},
]

const TRANSFER_TOOLS: ToolDefinition[] = [
	{ id: 'copy', label: 'Copy', icon: faCopy, title: 'Copy a button somewhere else' },
	{ id: 'move', label: 'Move', icon: faArrowsAlt, title: 'Move a button somewhere else' },
	{ id: 'swap', label: 'Swap', icon: faArrowsLeftRight, title: 'Swap two buttons' },
	{ id: 'delete', label: 'Delete', icon: faTrash, title: 'Clear a button', dangerous: true },
]

const ALL_TOOLS = [...NAVIGATION_TOOLS, ...TRANSFER_TOOLS]

export function ButtonGridToolbar(): React.JSX.Element {
	const { store, actions } = useButtonGridView()
	const activeToolId = useGridActiveToolId()
	const pressMode = useGridPressMode()
	const hint = useGridHint()
	const selectionCount = useGridSelectionCount()
	const selectionPageNumber = useGridSelectionPageNumber()

	const selectTool = useCallback(
		(id: GridToolId) => {
			// Choosing the tool you are already in is the quickest way back to normal
			store.setTool(id === activeToolId ? 'select' : id, actions)
		},
		[store, actions, activeToolId]
	)

	const cancel = useCallback(() => store.goBack(actions), [store, actions])

	const renderTool = (tool: ToolDefinition) => {
		const active = tool.id === activeToolId

		return (
			<Toolbar.Button
				key={tool.id}
				icon={tool.icon}
				title={tool.title}
				// The toolbar carries no visible text of its own - the status says which tool is active
				ariaLabel={tool.label}
				active={active}
				pressed={active}
				tone={tool.dangerous ? 'danger' : undefined}
				onClick={() => selectTool(tool.id)}
			/>
		)
	}

	// Something to unwind: a tool part-way through, or a selection to drop
	const canCancel = hint !== null || selectionCount > 0

	return (
		<div className="button-grid-toolbar">
			<Toolbar.Root orientation="horizontal">
				{/* Grouped so that a toolbar narrow enough to wrap breaks between the modes and the
				    pick-then-place tools, rather than mid-group */}
				<Toolbar.Group>{NAVIGATION_TOOLS.map(renderTool)}</Toolbar.Group>
				<Toolbar.Separator />
				<Toolbar.Group>{TRANSFER_TOOLS.map(renderTool)}</Toolbar.Group>

				<GridToolbarStatus
					pressMode={pressMode}
					hint={hint}
					selectionCount={selectionCount}
					selectionPageNumber={selectionPageNumber}
					activeToolId={activeToolId}
				/>

				<Toolbar.Button
					icon={faXmark}
					title="Stop what the grid is in the middle of"
					ariaLabel="Cancel"
					onClick={cancel}
					disabled={!canCancel}
				/>
			</Toolbar.Root>
		</div>
	)
}

interface GridToolbarStatusProps {
	pressMode: boolean
	hint: string | null
	selectionCount: number
	selectionPageNumber: number | null
	activeToolId: GridToolId
}

/**
 * The toolbar always says what it is doing, even when that is nothing in particular. Left empty the
 * space reads as a gap rather than as part of the bar.
 */
function GridToolbarStatus({
	pressMode,
	hint,
	selectionCount,
	selectionPageNumber,
	activeToolId,
}: GridToolbarStatusProps): React.JSX.Element {
	// Press mode runs real actions on real hardware, so the toolbar itself carries the warning rather
	// than a banner appearing above it and shoving the grid down the page
	if (pressMode) {
		return (
			<Toolbar.Status tone="danger">
				<FontAwesomeIcon icon={faHandPointer} />
				<span>Press mode &mdash; clicking a button will run its actions</span>
			</Toolbar.Status>
		)
	}

	if (hint) return <Toolbar.Status>{hint}</Toolbar.Status>

	if (selectionCount > 1) {
		return (
			<Toolbar.Status>
				{selectionCount} buttons selected
				{selectionPageNumber !== null && ` on page ${selectionPageNumber}`}
			</Toolbar.Status>
		)
	}

	const activeTool = ALL_TOOLS.find((tool) => tool.id === activeToolId)
	return <Toolbar.Status muted>{activeTool ? `${activeTool.label} tool` : ''}</Toolbar.Status>
}

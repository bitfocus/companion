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
} from '@fortawesome/free-solid-svg-icons'
import { useCallback } from 'react'
import { Toolbar } from '~/Components/Toolbar.js'
import { useButtonGridView, useGridActiveToolId } from './ButtonGridViewContext.js'
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
	{
		id: 'multi-select',
		label: 'Multi',
		icon: faSquareCheck,
		title: 'Tap buttons to add and remove them from the selection',
	},
	{
		id: 'arrange',
		label: 'Arrange',
		icon: faUpDownLeftRight,
		title: 'Drag any button to move it',
	},
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

export function ButtonGridToolbar(): React.JSX.Element {
	const { store, actions } = useButtonGridView()
	const activeToolId = useGridActiveToolId()

	const selectTool = useCallback(
		(id: GridToolId) => {
			// Choosing the tool you are already in is the quickest way back to normal
			store.setTool(id === activeToolId ? 'select' : id, actions)
		},
		[store, actions, activeToolId]
	)

	const renderTool = (tool: ToolDefinition) => {
		const active = tool.id === activeToolId

		return (
			<Toolbar.Button
				key={tool.id}
				icon={tool.icon}
				// Whether there is room for the label is a question about width, so the CSS decides it -
				// see the container query in ButtonGridPanel.css
				label={tool.label}
				title={tool.title}
				// Names the button for the widths where the label is not rendered
				ariaLabel={tool.label}
				active={active}
				pressed={active}
				tone={tool.dangerous ? 'danger' : undefined}
				onClick={() => selectTool(tool.id)}
			/>
		)
	}

	return (
		<div className="button-grid-toolbar">
			<Toolbar.Root orientation="horizontal">
				{/* Grouped so that a toolbar narrow enough to wrap breaks between the modes and the
				    pick-then-place tools, rather than mid-group */}
				<Toolbar.Group>{NAVIGATION_TOOLS.map(renderTool)}</Toolbar.Group>
				<Toolbar.Separator />
				<Toolbar.Group>{TRANSFER_TOOLS.map(renderTool)}</Toolbar.Group>
			</Toolbar.Root>
		</div>
	)
}

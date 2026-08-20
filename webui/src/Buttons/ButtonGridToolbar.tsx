import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import {
	faArrowPointer,
	faArrowsAlt,
	faArrowsLeftRight,
	faCopy,
	faHandPointer,
	faTrash,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useCallback, useRef } from 'react'
import { Button } from '~/Components/Button.js'
import { useResizeObserver } from '~/Hooks/useResizeObserver.js'
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

/** Below this the labels are dropped, but never the buttons - they stay full-size tap targets */
const COMPACT_WIDTH = 620

export function ButtonGridToolbar(): React.JSX.Element {
	const { store, actions } = useButtonGridView()
	const activeToolId = useGridActiveToolId()

	const sizeRef = useRef<HTMLDivElement>(null)
	const holderSize = useResizeObserver<HTMLDivElement>({ ref: sizeRef })
	const useCompactButtons = (holderSize.width ?? 0) < COMPACT_WIDTH

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
			<Button
				key={tool.id}
				color={active ? (tool.dangerous ? 'danger' : 'primary') : 'light'}
				active={active}
				onClick={() => selectTool(tool.id)}
				title={tool.title}
				aria-pressed={active}
			>
				<FontAwesomeIcon icon={tool.icon} /> {useCompactButtons ? '' : tool.label}
			</Button>
		)
	}

	return (
		<div className="button-grid-toolbar" ref={sizeRef}>
			<div className="button-grid-toolbar-group">{NAVIGATION_TOOLS.map(renderTool)}</div>
			<div className="button-grid-toolbar-separator" />
			<div className="button-grid-toolbar-group">{TRANSFER_TOOLS.map(renderTool)}</div>
		</div>
	)
}

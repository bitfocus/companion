import { DragOverlay } from '@dnd-kit/react'
import { useMemo } from 'react'
import { formatLocation } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { DEFAULT_PREVIEW_RENDER_SIZE } from '@companion-app/shared/Model/Preview.js'
import { ButtonPreviewBase } from '~/Components/ButtonPreview.js'
import { useButtonImageForLocation } from '~/Hooks/useButtonImageForLocation.js'
import { useGridSelectedLocations } from './ButtonGridViewContext.js'
import { GRID_BUTTON_DRAG_TYPE, type GridButtonDragItem } from './GridButtonDragItem.js'

/** Above this a faithful ghost is a screenful of buttons following the cursor, which helps nobody */
const MAX_GHOST_CELLS = 36

/**
 * What follows the cursor while buttons are dragged around the grid.
 *
 * Dragging a selection shows the whole region in the shape it will land in, so there is no separate
 * anchoring rule to learn - what is under the pointer is where it goes.
 */
export function GridButtonDragOverlay(): React.JSX.Element {
	return (
		// The default drop animation flies the ghost back to where the drag started, which reads as
		// "that did not work" even when it did
		<DragOverlay dropAnimation={null} disabled={(source) => source?.type !== GRID_BUTTON_DRAG_TYPE}>
			{(source) => <GridDragGhost origin={(source?.data as GridButtonDragItem | undefined)?.location} />}
		</DragOverlay>
	)
}

function GridDragGhost({ origin }: { origin: ControlLocation | undefined }): React.JSX.Element | null {
	const selection = useGridSelectedLocations()

	const locations = useMemo(() => {
		if (!origin) return []

		const originKey = formatLocation(origin)
		return selection.some((l) => formatLocation(l) === originKey) ? [...selection] : [origin]
	}, [origin, selection])

	const bounds = useMemo(() => {
		if (locations.length === 0) return null

		return {
			minRow: Math.min(...locations.map((l) => l.row)),
			maxRow: Math.max(...locations.map((l) => l.row)),
			minColumn: Math.min(...locations.map((l) => l.column)),
			maxColumn: Math.max(...locations.map((l) => l.column)),
		}
	}, [locations])

	if (!origin || !bounds) return null

	const rows = bounds.maxRow - bounds.minRow + 1
	const columns = bounds.maxColumn - bounds.minColumn + 1
	const selectedKeys = new Set(locations.map(formatLocation))

	if (rows * columns > MAX_GHOST_CELLS) {
		return <div className="grid-drag-ghost grid-drag-ghost-count">{locations.length} buttons</div>
	}

	return (
		<div className="grid-drag-ghost" style={{ gridTemplateColumns: `repeat(${columns}, var(--grid-drag-ghost-cell))` }}>
			{Array.from({ length: rows * columns }, (_, index) => {
				const location: ControlLocation = {
					pageNumber: origin.pageNumber,
					row: bounds.minRow + Math.floor(index / columns),
					column: bounds.minColumn + (index % columns),
				}
				const key = formatLocation(location)

				return selectedKeys.has(key) ? (
					<GhostCell key={key} location={location} />
				) : (
					<div key={key} className="grid-drag-ghost-hole" />
				)
			})}
		</div>
	)
}

function GhostCell({ location }: { location: ControlLocation }): React.JSX.Element {
	// The grid is already watching this location, and image subscriptions are shared, so the ghost
	// costs nothing beyond the element
	const { image, isUsed } = useButtonImageForLocation(location, DEFAULT_PREVIEW_RENDER_SIZE)

	return <ButtonPreviewBase preview={isUsed ? image : null} />
}

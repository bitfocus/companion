import type { ControlLocation } from '@companion-app/shared/Model/Common.js'

/** dnd-kit `source.type` for a button being dragged around the grid */
export const GRID_BUTTON_DRAG_TYPE = 'grid-button'

/**
 * Only the cell the drag started from travels with the drag.
 *
 * The rest of the selection is read from the store when the drag lands, so a cell never has to
 * subscribe to the whole selection just to be draggable - which would re-render every visible cell
 * every time the selection changed.
 */
export interface GridButtonDragItem {
	location: ControlLocation
}

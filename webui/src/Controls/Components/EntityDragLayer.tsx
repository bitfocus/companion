import { DragCloneOverlay } from '~/Resources/DragCloneOverlay.js'
import type { EntityDragData } from './EntityListDnd.js'

function isEntityDrag(source: { data?: unknown } | null): boolean {
	return (source?.data as EntityDragData | undefined)?.kind === 'entity'
}

/**
 * Drag preview for entities. Entities reorder on hover, so they use a DOM-clone DragOverlay rather than
 * dnd-kit's default clone feedback (see DragCloneOverlay). Wrapped in `.entity-list` so the cloned row
 * picks up the entity-list styling. Render once inside the global DragDropProvider.
 */
export function EntityDragLayer(): React.JSX.Element {
	return <DragCloneOverlay className="entity-list" disabled={(source) => !isEntityDrag(source)} />
}

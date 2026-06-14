import { pointerIntersection } from '@dnd-kit/collision'
import { useDragOperation, useDroppable } from '@dnd-kit/react'
import classNames from 'classnames'
import { useContext } from 'react'
import type { EntityOwner } from '@companion-app/shared/Model/EntityModel.js'
import { useEntityEditorContext } from './EntityEditorContext'
import { emptyListDroppableId, EntityNestingLevelContext } from './EntityListDnd.js'

interface EntityDropPlaceholderZoneProps {
	dragId: string
	ownerId: EntityOwner | null
	entityCount: number
	entityTypeLabel: string
}

export function EntityDropPlaceholderZone({
	dragId,
	ownerId,
	entityCount,
	entityTypeLabel,
}: EntityDropPlaceholderZoneProps): React.JSX.Element | null {
	const { serviceFactory } = useEntityEditorContext()
	const nestingLevel = useContext(EntityNestingLevelContext)

	// Empty lists have no sortable rows to drop onto, so this droppable is the drop target. The move
	// itself is performed by ControlEntitiesEditor's monitor (which recognises this droppable's id).
	const { ref, isDropTarget } = useDroppable({
		id: emptyListDroppableId(serviceFactory.listId, ownerId),
		accept: dragId,
		// Match the rows' pointer-based collision so this small zone is hit when the cursor is over it.
		collisionDetector: pointerIntersection,
		// An empty child group's zone sits inside its parent row, so it needs the deeper priority to win
		// (same `level * 2` scheme as the rows, above the parent's children shield).
		collisionPriority: nestingLevel * 2,
	})

	const { source } = useDragOperation()

	// Only show when the list is empty and a matching entity is being dragged
	if (entityCount > 0 || source?.type !== dragId) return null

	return (
		<div ref={ref} className={classNames('entitylist-dropzone', { 'is-drop-target': isDropTarget })}>
			<p>Drop {entityTypeLabel} here</p>
		</div>
	)
}

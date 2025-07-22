import { EntityOwner, SomeSocketEntityLocation } from '@companion-app/shared/Model/EntityModel.js'
import { isEqual } from 'lodash-es'
import React, { useDeferredValue } from 'react'
import { useDrop } from 'react-dnd'
import { DragState } from '~/Resources/DragAndDrop'
import { useEntityEditorContext } from './EntityEditorContext'

export interface EntityListDragItem {
	entityId: string
	listId: SomeSocketEntityLocation
	index: number
	ownerId: EntityOwner | null
	dragState: DragState | null
}

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

	const [isDragging, drop] = useDrop<EntityListDragItem, unknown, boolean>({
		accept: dragId,
		collect: (monitor) => {
			return monitor.canDrop()
		},
		hover(item, _monitor) {
			// Can't move into itself
			if (ownerId && isEqual(item.entityId, ownerId.parentId)) return

			serviceFactory.moveCard(item.listId, item.entityId, ownerId, 0)

			item.ownerId = ownerId
			item.listId = serviceFactory.listId
			item.index = 0
		},
	})

	// Defer the isDragging value to ensure dragend doesn't fire prematurely
	// See https://github.com/bitfocus/companion/issues/3115
	// https://bugs.webkit.org/show_bug.cgi?id=134212
	// https://issues.chromium.org/issues/41150279
	const isDraggingDeferred = useDeferredValue(isDragging)

	if (!isDraggingDeferred || entityCount > 0) return null

	return (
		<tr ref={drop} className="entitylist-dropzone">
			<td colSpan={3}>
				<p>Drop {entityTypeLabel} here</p>
			</td>
		</tr>
	)
}

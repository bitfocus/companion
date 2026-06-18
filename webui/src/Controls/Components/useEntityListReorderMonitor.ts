import { useDragDropManager, useDragDropMonitor } from '@dnd-kit/react'
import { isSortable } from '@dnd-kit/react/sortable'
import {
	stringifySocketEntityLocation,
	type EntityModelType,
	type EntityOwner,
	type SomeSocketEntityLocation,
} from '@companion-app/shared/Model/EntityModel.js'
import type { IEntityEditorService } from '~/Services/Controls/ControlEntitiesService.js'
import { stringifyEntityOwnerId } from '../Util.js'
import { parseEmptyListDroppableId, parseEntityListLocation, type EntityListLocation } from './EntityListDnd.js'

/**
 * Entities can't use dnd-kit's optimistic (DOM-moving) sorting: their nested lists render as separate
 * containers, and moving a DOM node across React-rendered containers while the backing mobx data
 * updates asynchronously corrupts React's tree (duplicated rows / removeChild errors).
 *
 * Instead we replicate the old react-dnd behaviour: apply the move on hover (`onDragOver`) by calling
 * the real `moveCard` mutation, so the list reorders through React/mobx as normal. The entity
 * sortables disable OptimisticSortingPlugin and the drag preview comes from a <DragOverlay> (see
 * EntityDragOverlay) - dnd-kit never clones or moves the source row, so React stays in control.
 *
 * Direction-locked hysteresis (don't re-enter a target in the same drag direction until the direction
 * reverses) avoids the swap/oscillation you otherwise get with variable-height rows.
 *
 * TODO: this is a deliberate compromise - the preview is a simplified row and the whole thing has been
 * finicky to get right. The proper fix is to rebuild the entity editor so a whole control's entities
 * live in a single flat DOM container (like the layered ElementsList), which would let us re-enable
 * dnd-kit's optimistic sorting + drop animations and delete this hover-based workaround. That is a
 * sizeable restructure of the nested EntityList/EntityChildGroup rendering, so it has been deferred.
 */

interface ActiveEntityDrag {
	listId: SomeSocketEntityLocation
	ownerId: EntityOwner | null
	direction: 'up' | 'down' | null
	lastY: number | null
	draggedOver: Set<string>
}

// Only one drag happens at a time, so a module-level record is enough to track where the entity
// currently is (its source list for the next move) across cross-list hops.
let activeDrag: ActiveEntityDrag | null = null

export function useEntityListReorderMonitor(
	controlId: string,
	entityType: EntityModelType,
	serviceFactory: IEntityEditorService
): void {
	const manager = useDragDropManager()
	const dragId = `${controlId}_${entityType}`
	const myListKey = stringifySocketEntityLocation(serviceFactory.listId)

	useDragDropMonitor({
		onDragOver(event) {
			const { source, target } = event.operation
			if (!source || source.type !== dragId || !isSortable(source)) return

			// Lazily capture where the entity started (robust against dragStart ordering)
			if (!activeDrag) {
				const loc = parseEntityListLocation(source.group ?? source.initialGroup)
				if (!loc) return
				activeDrag = { listId: loc.listId, ownerId: loc.ownerId, direction: null, lastY: null, draggedOver: new Set() }
			}

			// Resolve where we're hovering: an empty list's placeholder, or another sortable row
			let targetLocation: EntityListLocation
			let newIndex: number
			let zoneKey: string
			const emptyTarget = parseEmptyListDroppableId(target?.id)
			if (emptyTarget) {
				targetLocation = emptyTarget
				newIndex = 0
				zoneKey = `empty:${stringifySocketEntityLocation(emptyTarget.listId)}:${stringifyEntityOwnerId(emptyTarget.ownerId)}`
			} else if (target && isSortable(target)) {
				if (String(target.id) === String(source.id)) return // hovering its own row
				const loc = parseEntityListLocation(target.group)
				if (!loc) return
				targetLocation = loc
				// A clean remove-then-insert move means newIndex = target's index works in both directions
				newIndex = target.index
				zoneKey = String(target.id)
			} else {
				return
			}

			// Only the editor that owns the target list performs the move
			if (stringifySocketEntityLocation(targetLocation.listId) !== myListKey) return
			// Can't move an entity into a child group it owns
			if (targetLocation.ownerId && targetLocation.ownerId.parentId === String(source.id)) return

			// Track drag direction from pointer movement (dnd-kit's own direction is often null) and
			// reset the hysteresis whenever it reverses.
			const currentY = manager?.dragOperation.position.current.y ?? null
			if (currentY !== null && activeDrag.lastY !== null && currentY !== activeDrag.lastY) {
				const direction = currentY > activeDrag.lastY ? 'down' : 'up'
				if (direction !== activeDrag.direction) {
					activeDrag.direction = direction
					activeDrag.draggedOver.clear()
				}
			}
			if (currentY !== null) activeDrag.lastY = currentY

			// Hysteresis: only move into a given zone once per drag direction
			if (activeDrag.draggedOver.has(zoneKey)) return
			activeDrag.draggedOver.add(zoneKey)

			serviceFactory.moveCard(activeDrag.listId, String(source.id), targetLocation.ownerId, newIndex)
			activeDrag.listId = targetLocation.listId
			activeDrag.ownerId = targetLocation.ownerId
		},
		onDragEnd() {
			activeDrag = null
		},
	})
}

import { createContext } from 'react'
import type { EntityOwner, SomeEntityModel, SomeSocketEntityLocation } from '@companion-app/shared/Model/EntityModel.js'

// Nesting depth of the current entity list (0 = a control's top-level list, +1 per child group). Used
// to derive the dnd-kit `collisionPriority` of each row/dropzone so a nested child row beats its
// enclosing parent row when the pointer is inside both (nested droppables overlap). Deeper = higher.
//
// Priorities are spaced by 2 (`level * 2`) so the children-area "shield" droppable can sit on the odd
// number in between: a parent row at level L is `2L`, its children's rows/zones at level L+1 are
// `2(L+1) = 2L+2`, and the shield over that parent's `.cell-children` is `2L+1` - above the parent row
// (so it absorbs dead-space hovers) but below the child lists (so precise child hovers still win).
export const EntityNestingLevelContext = createContext(0)

export interface EntityListLocation {
	listId: SomeSocketEntityLocation
	ownerId: EntityOwner | null
}

// Attached as the dnd-kit `data` of each entity sortable so the custom drag layer (EntityDragLayer)
// can render a preview of the dragged entity.
export interface EntityDragData {
	kind: 'entity'
	entity: SomeEntityModel
	entityTypeLabel: string
}

// A dnd-kit sortable `group` value identifies which list (+ nested owner) an entity belongs to.
// We JSON-encode the listId/ownerId so it round-trips back to the objects that moveCard needs on
// drop (stringify helpers aren't reversible). Entities in the same list+owner produce the same key.
export function entityGroupKey(listId: SomeSocketEntityLocation, ownerId: EntityOwner | null): string {
	return JSON.stringify({ listId, ownerId })
}

export function parseEntityListLocation(value: string | number | undefined | null): EntityListLocation | null {
	if (typeof value !== 'string') return null
	try {
		return JSON.parse(value) as EntityListLocation
	} catch {
		return null
	}
}

// Empty lists have no sortable items to drop onto, so they render a plain droppable instead. Its id
// encodes the target list+owner the same way.
const EMPTY_LIST_PREFIX = 'entity-empty-list:'
export function emptyListDroppableId(listId: SomeSocketEntityLocation, ownerId: EntityOwner | null): string {
	return EMPTY_LIST_PREFIX + entityGroupKey(listId, ownerId)
}
export function parseEmptyListDroppableId(id: string | number | undefined | null): EntityListLocation | null {
	if (typeof id !== 'string' || !id.startsWith(EMPTY_LIST_PREFIX)) return null
	return parseEntityListLocation(id.slice(EMPTY_LIST_PREFIX.length))
}

// Id for the droppable that covers an entity's whole `.cell-children` area. The reorder monitor doesn't
// recognise this id (it's neither a sortable nor an empty-list zone), so a drag that resolves to it is
// a no-op - which is the point: it shields the dead space around the child lists from the parent row.
export function childrenShieldDroppableId(parentEntityId: string): string {
	return `entity-children-shield:${parentEntityId}`
}

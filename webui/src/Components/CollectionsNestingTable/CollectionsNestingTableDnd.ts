/**
 * dnd-kit helpers for the CollectionsNestingTable. Two drag types share the one global provider: items
 * (the sortable `type` is the consumer's `dragId`) and collections (`${dragId}-collection`).
 *
 * Sortable `group`s are how dnd-kit knows which list an item/collection belongs to, so optimistic
 * sorting can move things within and between them:
 *  - items are grouped by their owning collection (or the root, for ungrouped items)
 *  - collections are grouped by their parent collection (or the root, for top-level collections)
 *
 * Reordering is applied on drop (useCollectionsNestingTableReorderMonitor) from `source.index`/
 * `source.group`, which the backend move callbacks treat as a clean final index. Empty collections have
 * no sortable rows to sort into, so they (and collapsed collection headers) expose plain droppables
 * whose ids encode the destination; the monitor recognises those ids.
 */

const ROOT = '__root__'

export interface CntItemDragData {
	kind: 'cnt-item'
	itemId: string
	// Grid item drags use a hover-move (blocked from optimistic sorting) so a cross-collection move never
	// reparents DOM across grid containers (which crashes). List item drags use native sorting.
	gridLayout: boolean
}
export interface CntCollectionDragData {
	kind: 'cnt-collection'
	collectionId: string
}

export function collectionDragType(dragId: string): string {
	return `${dragId}-collection`
}

// --- sortable groups -------------------------------------------------------------------------------

const ITEM_GROUP_PREFIX = 'cnt-item-group:'
export function itemGroupKey(collectionId: string | null): string {
	return ITEM_GROUP_PREFIX + (collectionId ?? ROOT)
}
/** The collection id an item group belongs to (null = root/ungrouped), or undefined if not an item group. */
export function itemGroupCollectionId(group: string | number | undefined | null): string | null | undefined {
	if (typeof group !== 'string' || !group.startsWith(ITEM_GROUP_PREFIX)) return undefined
	const value = group.slice(ITEM_GROUP_PREFIX.length)
	return value === ROOT ? null : value
}

const COLLECTION_GROUP_PREFIX = 'cnt-collection-group:'
export function collectionGroupKey(parentId: string | null): string {
	return COLLECTION_GROUP_PREFIX + (parentId ?? ROOT)
}
/** The parent id a collection group belongs to (null = root), or undefined if not a collection group. */
export function collectionGroupParentId(group: string | number | undefined | null): string | null | undefined {
	if (typeof group !== 'string' || !group.startsWith(COLLECTION_GROUP_PREFIX)) return undefined
	const value = group.slice(COLLECTION_GROUP_PREFIX.length)
	return value === ROOT ? null : value
}

// --- explicit droppables (empty/collapsed targets that have no sortable rows) -----------------------

const EMPTY_ITEMS_PREFIX = 'cnt-empty-items:'
export function emptyCollectionItemDropId(collectionId: string | null): string {
	return EMPTY_ITEMS_PREFIX + (collectionId ?? ROOT)
}
export function parseEmptyCollectionItemDropId(id: string | number | undefined | null): string | null | undefined {
	if (typeof id !== 'string' || !id.startsWith(EMPTY_ITEMS_PREFIX)) return undefined
	const value = id.slice(EMPTY_ITEMS_PREFIX.length)
	return value === ROOT ? null : value
}

const HEADER_ITEMS_PREFIX = 'cnt-header-items:'
export function collectionItemHeaderDropId(collectionId: string): string {
	return HEADER_ITEMS_PREFIX + collectionId
}
export function parseCollectionItemHeaderDropId(id: string | number | undefined | null): string | undefined {
	if (typeof id !== 'string' || !id.startsWith(HEADER_ITEMS_PREFIX)) return undefined
	return id.slice(HEADER_ITEMS_PREFIX.length)
}

const NEST_PREFIX = 'cnt-nest:'
export function collectionNestDropId(parentCollectionId: string): string {
	return NEST_PREFIX + parentCollectionId
}
export function parseCollectionNestDropId(id: string | number | undefined | null): string | undefined {
	if (typeof id !== 'string' || !id.startsWith(NEST_PREFIX)) return undefined
	return id.slice(NEST_PREFIX.length)
}

// --- misc ------------------------------------------------------------------------------------------

/** Merge dnd-kit callback refs (e.g. a sortable ref + a droppable ref) onto one element. */
export function mergeDndRefs(
	...refs: Array<((element: Element | null) => void) | undefined>
): (element: Element | null) => void {
	return (element) => {
		for (const ref of refs) ref?.(element)
	}
}

import { useDragDropManager, useDragDropMonitor } from '@dnd-kit/react'
import { isSortable } from '@dnd-kit/react/sortable'
import {
	collectionDragType,
	collectionGroupParentId,
	itemGroupCollectionId,
	parseCollectionItemHeaderDropId,
	parseCollectionNestDropId,
	parseEmptyCollectionItemDropId,
	type CntCollectionDragData,
	type CntItemDragData,
} from './CollectionsNestingTableDnd.js'
import type { NestingCollectionsApi } from './Types.js'

/**
 * Applies CollectionsNestingTable drag operations.
 *
 * Items (both layouts) reorder on hover: the move is applied live through React/mobx, and dnd-kit is
 * blocked from its own optimistic sorting (see SortableHysteresis) with the preview coming from a
 * DragOverlay. This is required because items can be dropped into empty collections / onto headers,
 * which aren't sortable rows - native sorting can't place an item there, and a move applied on drop
 * leaves dnd-kit's sortable state and the data disagreeing (the moved item becomes un-draggable).
 *
 * Collections reorder via dnd-kit's native sorting (a single flat list of sortable rows) and are
 * persisted once on drop.
 *
 * The backend move callbacks take the index as a clean final index (-1 = end).
 *
 * Rendered once per table (it filters by the table's `dragId`), inside the global DragDropProvider.
 */

// Item hover-move state (one drag happens at a time).
// Grid: dedup on the resolved destination so we don't re-fire the move on every dragover.
let lastItemDest: { collectionId: string | null; index: number } | null = null
// List: directional hysteresis - once we've moved past a row in the current drag direction, don't move
// back into it until the direction reverses, so variable-height rows don't jitter as they reflow.
let listHysteresis: { direction: 'up' | 'down' | null; lastY: number | null; passed: Set<string> } | null = null

export function useCollectionsNestingTableReorderMonitor(
	dragId: string,
	collectionsApi: NestingCollectionsApi | undefined
): void {
	const manager = useDragDropManager()
	const collectionType = collectionDragType(dragId)

	useDragDropMonitor({
		onDragOver(event) {
			const { source, target } = event.operation
			if (!source || !collectionsApi || source.type !== dragId) return

			const data = source.data as CntItemDragData

			// Resolve which collection + index this hover targets
			let destCollectionId: string | null
			let destIndex: number
			let zoneKey: string

			const emptyCollectionId = parseEmptyCollectionItemDropId(target?.id)
			const headerCollectionId = parseCollectionItemHeaderDropId(target?.id)
			if (emptyCollectionId !== undefined) {
				destCollectionId = emptyCollectionId
				destIndex = -1
				zoneKey = `empty:${emptyCollectionId}`
			} else if (headerCollectionId !== undefined) {
				destCollectionId = headerCollectionId
				destIndex = -1
				zoneKey = `header:${headerCollectionId}`
			} else if (target && isSortable(target) && target.type === dragId) {
				if (String(target.id) === String(source.id)) return // hovering its own row
				const collectionId = itemGroupCollectionId(target.group)
				if (collectionId === undefined) return
				destCollectionId = collectionId
				destIndex = target.index
				zoneKey = String(target.id)
			} else {
				return
			}

			if (data.gridLayout) {
				// Grid: act only when the resolved destination changes (tiles are uniform, so no reflow jitter)
				if (lastItemDest && lastItemDest.collectionId === destCollectionId && lastItemDest.index === destIndex) {
					return
				}
				lastItemDest = { collectionId: destCollectionId, index: destIndex }
			} else {
				// List: direction-locked hysteresis so variable-height rows don't oscillate as they reflow
				if (!listHysteresis) listHysteresis = { direction: null, lastY: null, passed: new Set() }
				const y = manager?.dragOperation.position.current.y ?? null
				if (y !== null && listHysteresis.lastY !== null && y !== listHysteresis.lastY) {
					const direction = y > listHysteresis.lastY ? 'down' : 'up'
					if (direction !== listHysteresis.direction) {
						listHysteresis.direction = direction
						listHysteresis.passed.clear()
					}
				}
				if (y !== null) listHysteresis.lastY = y
				if (listHysteresis.passed.has(zoneKey)) return
				listHysteresis.passed.add(zoneKey)
			}

			collectionsApi.moveItemToCollection(data.itemId, destCollectionId, destIndex)
		},

		onDragEnd(event) {
			lastItemDest = null
			listHysteresis = null
			if (event.canceled || !collectionsApi) return

			const { source, target } = event.operation
			if (!source) return

			// Items are already moved on hover - nothing to persist on drop
			if (source.type === dragId) return

			if (!isSortable(source)) return

			if (source.type === collectionType) {
				// A collection: reorder among siblings, or nest under another collection
				const { collectionId } = source.data as CntCollectionDragData

				const nestParentId = parseCollectionNestDropId(target?.id)
				if (nestParentId !== undefined) {
					collectionsApi.moveCollection(collectionId, nestParentId, 0)
					return
				}

				const destParentId = collectionGroupParentId(source.group)
				if (destParentId === undefined) return
				collectionsApi.moveCollection(collectionId, destParentId, source.index)
			}
		},
	})
}

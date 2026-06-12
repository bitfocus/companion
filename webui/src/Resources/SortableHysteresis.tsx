import { useDragDropManager } from '@dnd-kit/react'
import { isSortable } from '@dnd-kit/react/sortable'
import { useEffect } from 'react'

/**
 * Adds directional hysteresis to every dnd-kit sortable list. Once a dragged item has swapped past
 * another item in the current drag direction, further swaps with that same item are suppressed until
 * the drag direction reverses.
 *
 * Without this, dragging a short row slowly past a tall one jitters: the swap reflows the tall row
 * back under the (slow-moving) cursor, which immediately re-triggers the swap, and so on. We block
 * the re-swap with `event.preventDefault()` on the `dragover` event - the built-in optimistic-sorting
 * plugin checks `defaultPrevented` before applying a swap. (Replaces the old checkDragState logic.)
 *
 * Render once inside the global DragDropProvider. Harmless for uniform-height lists.
 */
export function SortableHysteresis(): null {
	const manager = useDragDropManager()

	useEffect(() => {
		if (!manager) return

		let lockedDirection: 'up' | 'down' | 'left' | 'right' | null = null
		const passed = new Set<string | number>()
		const reset = () => {
			lockedDirection = null
			passed.clear()
		}

		const unsubscribe = [
			manager.monitor.addEventListener('dragstart', reset),
			manager.monitor.addEventListener('dragend', reset),
			manager.monitor.addEventListener('dragover', (event) => {
				const { source, target, position } = manager.dragOperation
				if (!isSortable(source) || !isSortable(target) || source.sortable === target.sortable) return

				const direction = position.direction
				if (direction === null) return

				if (direction !== lockedDirection) {
					lockedDirection = direction
					passed.clear()
				}

				if (passed.has(target.id)) {
					// Already swapped past this item in this direction - block the reflow-induced re-swap.
					event.preventDefault()
				} else {
					passed.add(target.id)
				}
			}),
		]

		return () => {
			for (const unsub of unsubscribe) unsub()
		}
	}, [manager])

	return null
}

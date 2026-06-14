import { DragOverlay } from '@dnd-kit/react'
import { useCallback } from 'react'
import type { EntityDragData } from './EntityListDnd.js'

function isEntityDrag(source: { data?: unknown } | null): boolean {
	return (source?.data as EntityDragData | undefined)?.kind === 'entity'
}

function getDragElement(source: unknown): Element | undefined {
	return (source as { element?: Element } | null)?.element
}

/**
 * Custom drag preview for entities, via dnd-kit's DragOverlay. Entities can't use the default clone
 * feedback (its MutationObserver syncs the clone to the source, which corrupts React's tree when the
 * list reorders on hover - see the TODO in EntityEditorRow / useEntityListReorderMonitor), but they DO
 * need a feedback element so the drag has a shape for collision detection.
 *
 * So we take a one-off static clone of the source row's DOM at drag start and render it in the overlay.
 * It looks exactly like the real row (all of its cells/controls, not just the title) but never syncs
 * back to the source, so there's no MutationObserver and React stays in control. Render once inside the
 * global DragDropProvider; `disabled` for non-entity drags so other lists keep their normal feedback.
 */
export function EntityDragLayer(): React.JSX.Element {
	return (
		// dropAnimation={null}: the default drop animation flies the overlay back to the source, and for
		// a frame the cloned row flashes at the overlay's in-flow root position before teardown. The list
		// reorder animations are separate sortable transitions and are unaffected.
		<DragOverlay className="entity-list" dropAnimation={null} disabled={(source) => !isEntityDrag(source)}>
			{(source) => <EntityDragPreview element={getDragElement(source)} />}
		</DragOverlay>
	)
}

function EntityDragPreview({ element }: { element: Element | undefined }): React.JSX.Element {
	// Imperatively mount a static clone of the source row. The ref callback only re-runs if the source
	// element changes (it doesn't during a drag), so the preview is frozen at drag-start and ignores the
	// hover-reorders happening to the real list.
	const mountClone = useCallback(
		(container: HTMLDivElement | null) => {
			if (!container || !(element instanceof HTMLElement)) return

			const clone = element.cloneNode(true) as HTMLElement
			// Strip drag-state styling so the floating preview is a normal, undimmed row.
			clone.classList.remove('entity-row-grabbing')
			clone.removeAttribute('data-dnd-dragging')
			clone.removeAttribute('data-dnd-placeholder')

			container.replaceChildren(clone)
		},
		[element]
	)

	return <div ref={mountClone} />
}

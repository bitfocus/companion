import { DragOverlay } from '@dnd-kit/react'
import { useCallback } from 'react'

interface DragCloneSource {
	type?: string
	data?: unknown
	element?: Element
}

// Classes that dim the in-place source row/tile while it's being dragged - removed from the clone so
// the floating preview is undimmed.
const DRAG_SOURCE_DIM_CLASSES = ['entity-row-grabbing', 'row-dragging', 'tile-dragging']

/**
 * A `<DragOverlay>` whose preview is a one-off static DOM clone of the drag source element.
 *
 * Used for lists that reorder on hover and so can't use dnd-kit's default clone feedback (its
 * MutationObserver would try to sync the clone to the re-rendering source and corrupt React's tree).
 * The clone is stripped of drag-state styling and tagged `.dnd-drag-preview` for the shared lifted
 * look. Render it *within the source's CSS scope* (e.g. inside the list container) so the real
 * stylesheets style it - the clone has no styles copied onto it.
 *
 * `disabled` should return false only for the drags this overlay is responsible for, so unrelated
 * drags keep their own feedback.
 */
export function DragCloneOverlay({
	className,
	disabled,
}: {
	className?: string
	disabled: (source: DragCloneSource | null) => boolean
}): React.JSX.Element {
	return (
		// dropAnimation={null}: the default drop animation flies the clone back to the source and flashes
		// it at the overlay's in-flow position on teardown.
		<DragOverlay
			className={className}
			dropAnimation={null}
			disabled={(source) => disabled(source as DragCloneSource | null)}
		>
			{(source) => <DragPreviewClone element={(source as DragCloneSource | null)?.element} />}
		</DragOverlay>
	)
}

function DragPreviewClone({ element }: { element: Element | undefined }): React.JSX.Element {
	const mountClone = useCallback(
		(container: HTMLDivElement | null) => {
			if (!container || !(element instanceof HTMLElement)) return

			const clone = element.cloneNode(true) as HTMLElement
			clone.classList.remove(...DRAG_SOURCE_DIM_CLASSES)
			clone.removeAttribute('data-dnd-dragging')
			clone.removeAttribute('data-dnd-placeholder')
			clone.classList.add('dnd-drag-preview')

			container.replaceChildren(clone)
		},
		[element]
	)

	return <div ref={mountClone} />
}

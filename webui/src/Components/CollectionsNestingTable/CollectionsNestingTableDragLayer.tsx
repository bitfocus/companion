import { DragOverlay } from '@dnd-kit/react'
import { useCallback } from 'react'
import type { CntItemDragData } from './CollectionsNestingTableDnd.js'

function isItemDrag(source: { data?: unknown } | null): boolean {
	return (source?.data as CntItemDragData | undefined)?.kind === 'cnt-item'
}

function getDragElement(source: unknown): Element | undefined {
	return (source as { element?: Element } | null)?.element
}

/**
 * Drag preview for CollectionsNestingTable item rows/tiles. Those reorder on hover (the move re-renders
 * the real row through React), so they can't use dnd-kit's default clone feedback - its MutationObserver
 * would try to sync the clone to the re-rendering source and corrupt the tree (same reasoning as the
 * entity editor). Instead this DragOverlay renders a one-off static DOM clone of the source, wrapped in
 * `.collections-nesting-table` so it keeps its styling. Render once inside the global DragDropProvider;
 * disabled for every other drag so they keep their native feedback.
 */
export function CollectionsNestingTableDragLayer(): React.JSX.Element {
	return (
		<DragOverlay className="collections-nesting-table" dropAnimation={null} disabled={(source) => !isItemDrag(source)}>
			{(source) => <GridTileDragPreview element={getDragElement(source)} />}
		</DragOverlay>
	)
}

function GridTileDragPreview({ element }: { element: Element | undefined }): React.JSX.Element {
	const mountClone = useCallback(
		(container: HTMLDivElement | null) => {
			if (!container || !(element instanceof HTMLElement)) return

			const clone = element.cloneNode(true) as HTMLElement
			clone.removeAttribute('data-dnd-placeholder')
			clone.removeAttribute('data-dnd-dragging')

			// The clone is rendered at the document root, outside the consumer's CSS ancestors (e.g. the
			// image library's wrapper), so descendant-scoped rules - tile size, image size, text styles -
			// no longer match it. Freeze the source's *computed* styles inline onto the clone subtree so it
			// is fully self-contained and looks exactly like the source regardless of where it's rendered.
			const sourceNodes = [element, ...element.querySelectorAll<HTMLElement>('*')]
			const cloneNodes = [clone, ...clone.querySelectorAll<HTMLElement>('*')]
			for (let i = 0; i < sourceNodes.length && i < cloneNodes.length; i++) {
				const computed = window.getComputedStyle(sourceNodes[i])
				let cssText = ''
				for (const property of computed) {
					cssText += `${property}:${computed.getPropertyValue(property)};`
				}
				// No transition, so the frozen styles don't animate from their initial values on first paint
				cloneNodes[i].setAttribute('style', `${cssText}transition:none;`)
			}

			// The source is dimmed while dragging (row-dragging / tile-dragging), and that opacity gets
			// copied above once the source re-renders after the first move - keep the preview fully opaque.
			clone.style.opacity = '1'

			// Give the floating preview the same "lifted" look as the natively-sorted lists (e.g. Pages):
			// a solid tinted background, an outline, and a drop shadow. The computed-style copy above pulls
			// in the resting styles, so these are applied last to win.
			clone.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)'
			clone.style.outline = '2px solid rgba(0, 0, 0, 0.5)'
			clone.style.outlineOffset = '-2px'
			if (element.classList.contains('collections-nesting-table-row-item')) {
				clone.style.backgroundColor = '#f5f2fa'
			}

			container.replaceChildren(clone)
		},
		[element]
	)

	return <div ref={mountClone} />
}

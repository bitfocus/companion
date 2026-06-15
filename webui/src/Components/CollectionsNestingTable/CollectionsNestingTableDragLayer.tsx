import { DragCloneOverlay } from '~/Resources/DragCloneOverlay.js'
import { useCollectionsNestingTableContext } from './CollectionsNestingTableContext.js'

/**
 * Drag preview for CollectionsNestingTable items, which reorder on hover (see DragCloneOverlay for why
 * the default clone feedback can't be used). Rendered *inside* the table - and therefore inside the
 * consumer's CSS scope - so the cloned row/tile is styled by the real stylesheets (both the table's and
 * the consumer's own rules) with nothing copied onto it. Disabled for everything except this table's
 * item drags (matched by `dragId`).
 */
export function CollectionsNestingTableDragLayer(): React.JSX.Element {
	const { dragId } = useCollectionsNestingTableContext()

	return <DragCloneOverlay disabled={(source) => source?.type !== dragId} />
}

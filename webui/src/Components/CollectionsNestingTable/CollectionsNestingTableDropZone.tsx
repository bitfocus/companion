import type { CollisionDetector } from '@dnd-kit/collision'
import { useDroppable } from '@dnd-kit/react'
import classNames from 'classnames'
import { CollectionsNestingTableNestingRow } from './CollectionsNestingTableNestingRow.js'

export function CollectionsNestingTableDropZone({
	droppableId,
	accept,
	itemName,
	nestingLevel,
	collisionDetector,
}: {
	droppableId: string
	accept: string
	itemName: string
	nestingLevel: number
	collisionDetector?: CollisionDetector
}): React.JSX.Element {
	const { ref, isDropTarget } = useDroppable({ id: droppableId, accept, collisionDetector })

	return (
		<div ref={ref} className={classNames('collections-nesting-table-dropzone', { 'is-drop-target': isDropTarget })}>
			<CollectionsNestingTableNestingRow className="flex flex-row align-items-center" nestingLevel={nestingLevel}>
				<p>Drop {itemName} here</p>
			</CollectionsNestingTableNestingRow>
		</div>
	)
}

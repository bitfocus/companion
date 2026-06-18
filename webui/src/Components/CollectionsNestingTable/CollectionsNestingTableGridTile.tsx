import { faGrip } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import React from 'react'

export function CollectionsNestingTableGridTile({
	className,
	rowRef,
	dragRef,
	isDragging,
	isSelected,
	allowDrag,
	children,
}: React.PropsWithChildren<{
	className: string
	rowRef: (element: Element | null) => void
	dragRef: (element: Element | null) => void
	isDragging: boolean
	isSelected: boolean
	allowDrag: boolean
}>): React.JSX.Element {
	return (
		<div
			className={classNames('collections-nesting-table-grid-tile', className, {
				'tile-dragging': isDragging,
				'tile-selected': isSelected,
			})}
			ref={rowRef}
		>
			{allowDrag && (
				<div ref={dragRef} className="tile-drag-handle" title="Drag to reorder">
					<FontAwesomeIcon icon={faGrip} />
				</div>
			)}
			<div className="tile-content">{children}</div>
		</div>
	)
}

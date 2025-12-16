import { faGrip } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import React, { useRef } from 'react'
import type { ConnectDragSource, ConnectDropTarget, ConnectDragPreview } from 'react-dnd'

export function CollectionsNestingTableGridTile({
	className,
	drag,
	drop,
	preview,
	isDragging,
	isSelected,
	children,
}: React.PropsWithChildren<{
	className: string
	drag: ConnectDragSource
	drop: ConnectDropTarget
	preview: ConnectDragPreview
	isDragging: boolean
	isSelected: boolean
}>): React.JSX.Element {
	const ref = useRef<HTMLDivElement>(null)
	preview(drop(ref))

	return (
		<div
			className={classNames('collections-nesting-table-grid-tile', className, {
				'tile-dragging': isDragging,
				'tile-notdragging': !isDragging,
				'tile-selected': isSelected,
			})}
			ref={ref}
		>
			<div ref={drag} className="tile-drag-handle" title="Drag to reorder">
				<FontAwesomeIcon icon={faGrip} />
			</div>
			<div className="tile-content">{children}</div>
		</div>
	)
}

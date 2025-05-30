import React from 'react'
import { ConnectDropTarget } from 'react-dnd'

export function GroupingTableDropZone({ drop, itemName }: { drop: ConnectDropTarget | undefined; itemName: string }) {
	return (
		<div ref={drop} className="collapsible-list-dropzone">
			<p>Drop {itemName} here</p>
		</div>
	)
}

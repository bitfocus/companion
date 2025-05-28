import React from 'react'
import { ConnectDropTarget } from 'react-dnd'

export function CollapsibleListDropZone({ drop, itemName }: { drop: ConnectDropTarget | undefined; itemName: string }) {
	return (
		<tr ref={drop} className="collapsible-list-dropzone">
			<td colSpan={6}>
				<p>Drop {itemName} here</p>
			</td>
		</tr>
	)
}

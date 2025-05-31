import React from 'react'
import { ConnectDropTarget } from 'react-dnd'
import { GroupingTableNestingRow } from './GroupingTableNestingRow.js'

export function GroupingTableDropZone({
	drop,
	itemName,
	nestingLevel,
}: {
	drop: ConnectDropTarget | undefined
	itemName: string
	nestingLevel: number
}) {
	return (
		<div ref={drop} className="grouping-table-dropzone">
			<GroupingTableNestingRow nestingLevel={nestingLevel}>
				<p>Drop {itemName} here</p>
			</GroupingTableNestingRow>
		</div>
	)
}

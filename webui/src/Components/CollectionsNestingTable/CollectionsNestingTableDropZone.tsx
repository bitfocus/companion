import React from 'react'
import { ConnectDropTarget } from 'react-dnd'
import { CollectionsNestingTableNestingRow } from './CollectionsNestingTableNestingRow.js'

export function CollectionsNestingTableDropZone({
	drop,
	itemName,
	nestingLevel,
}: {
	drop: ConnectDropTarget | undefined
	itemName: string
	nestingLevel: number
}): React.JSX.Element {
	return (
		<div ref={drop} className="collections-nesting-table-dropzone">
			<CollectionsNestingTableNestingRow className="flex flex-row align-items-center" nestingLevel={nestingLevel}>
				<p>Drop {itemName} here</p>
			</CollectionsNestingTableNestingRow>
		</div>
	)
}

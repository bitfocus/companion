import { ConnectionGroup } from '@companion-app/shared/Model/Connections.js'
import { observer } from 'mobx-react-lite'
import React from 'react'
import { useConnectionListDragging, useGroupListDragging } from './ConnectionListDropZone.js'
import { ConnectionListApi } from './ConnectionListApi.js'
import { CollapsibleGroupRow } from '../../Components/GroupingTable/CollapsibleGroupRow.js'
import classNames from 'classnames'
import './NestedGroups.css'
import { ConnectDropTarget } from 'react-dnd'

interface ConnectionGroupRowProps {
	group: ConnectionGroup
	toggleExpanded: (groupId: string) => void
	connectionListApi: ConnectionListApi
	isCollapsed: boolean
	index: number
	nestingLevel?: number
}
export const ConnectionGroupRow = observer(function ConnectionGroupRow({
	group,
	toggleExpanded,
	connectionListApi,
	isCollapsed,
	index,
	nestingLevel = 0,
}: ConnectionGroupRowProps) {
	const { drop: dropConnectionInto } = useConnectionListDragging(group.id, -1)
	const { isOver, canDrop, drop: dropGroupInto } = useGroupListDragging(group.id)

	// Check if this group has children
	const hasChildren = group.children || []

	// Apply indentation based on nesting level
	const indentStyle = {
		paddingLeft: nestingLevel > 0 ? `${nestingLevel * 20}px` : undefined,
	}

	// Function that combines both drop targets
	let combinedDropInto: ConnectDropTarget = dropConnectionInto
	if (isCollapsed) combinedDropInto = (ref: any) => dropGroupInto(dropConnectionInto(ref))

	return (
		<CollapsibleGroupRow
			group={group}
			isCollapsed={isCollapsed}
			toggleExpanded={toggleExpanded}
			index={index}
			acceptDragType="connection-group"
			groupApi={connectionListApi}
			dropInto={combinedDropInto}
			indentStyle={indentStyle}
			className={classNames({
				'connection-group-nested': nestingLevel > 0,
			})}
		/>
	)
})

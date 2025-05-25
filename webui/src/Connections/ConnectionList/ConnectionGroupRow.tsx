import { ConnectionGroup } from '@companion-app/shared/Model/Connections.js'
import { observer } from 'mobx-react-lite'
import React, { useCallback, useContext } from 'react'
import { useConnectionListDragging, useGroupListDragging } from './ConnectionListDropZone.js'
import { ConnectionListApi } from './ConnectionListApi.js'
import { CollapsibleGroupRow } from '../../Components/GroupingTable/CollapsibleGroupRow.js'
import { CButton } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus } from '@fortawesome/free-solid-svg-icons'
import { RootAppStoreContext } from '../../Stores/RootAppStore.js'
import classNames from 'classnames'
import './NestedGroups.css'

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
	const { connections } = useContext(RootAppStoreContext)

	// Check if this group has children
	const hasChildren = group.children || []

	// Apply indentation based on nesting level
	const indentStyle = {
		paddingLeft: nestingLevel > 0 ? `${nestingLevel * 20}px` : undefined,
	}

	// Count connections in this group
	const connectionsCount = Array.from(connections.connections.values()).filter(
		(conn) => conn.groupId === group.id
	).length

	// Function that combines both drop targets
	const combinedDropInto = (ref: any) => dropGroupInto(dropConnectionInto(ref))

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
				'group-has-children': hasChildren,
				'group-drop-target': isOver && canDrop,
			})}
		/>
	)
})

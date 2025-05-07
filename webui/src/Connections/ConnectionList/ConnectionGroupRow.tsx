import { ConnectionGroup } from '@companion-app/shared/Model/Connections.js'
import { observer } from 'mobx-react-lite'
import React from 'react'
import { useConnectionListDragging } from './ConnectionListDropZone.js'
import { ConnectionListApi } from './ConnectionListApi.js'
import { CollapsibleGroupRow } from '../../Components/GroupingTable/CollapsibleGroupRow.js'

interface ConnectionGroupRowProps {
	group: ConnectionGroup
	toggleExpanded: (groupId: string) => void
	connectionListApi: ConnectionListApi
	isCollapsed: boolean
	index: number
}
export const ConnectionGroupRow = observer(function ConnectionGroupRow({
	group,
	toggleExpanded,
	connectionListApi,
	isCollapsed,
	index,
}: ConnectionGroupRowProps) {
	const { drop: dropInto } = useConnectionListDragging(group.id, -1)

	return (
		<CollapsibleGroupRow
			group={group}
			isCollapsed={isCollapsed}
			toggleExpanded={toggleExpanded}
			index={index}
			acceptDragType="connection-group"
			groupApi={connectionListApi}
			dropInto={dropInto}
		>
			{/* <CFormSwitch
				className={classNames('connection-enabled-switch', {
					indeterminate: enabledStatus === null,
				})}
				color="success"
				disabled={enabledStatus === undefined}
				checked={!!enabledStatus}
				onChange={toggleEnabled}
				size="xl"
				title={!!enabledStatus ? 'Disable all connections in group' : 'Enable all connections in group'}
			/> */}
		</CollapsibleGroupRow>
	)
})

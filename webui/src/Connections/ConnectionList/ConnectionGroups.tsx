import React from 'react'
import { observer } from 'mobx-react-lite'
import { ConnectionGroupRow } from './ConnectionGroupRow.js'
import { ConnectionsInGroup } from './ConnectionsInGroup.js'
import { GenericConfirmModalRef } from '../../Components/GenericConfirmModal.js'
import { TableVisibilityHelper } from '../../Components/TableVisibility.js'
import { ClientConnectionConfigWithId, VisibleConnectionsState } from './ConnectionList.js'
import { usePanelCollapseHelperContextForPanel } from '../../Helpers/CollapseHelper.js'
import { ConnectionGroup } from '@companion-app/shared/Model/Connections.js'
import { ConnectionListApi } from './ConnectionListApi.js'
import { useGroupListDragging } from './ConnectionListDropZone.js'
import { GroupingTableDropZone } from '../../Components/GroupingTable/GroupingTableDropZone.js'

interface ConnectionGroupsArrayProps {
	groups: ConnectionGroup[]
	connectionListApi: ConnectionListApi
	groupedConnections: Map<string, ClientConnectionConfigWithId[]>
	doConfigureConnection: (connectionId: string | null) => void
	selectedConnectionId: string | null
	visibleConnections: TableVisibilityHelper<VisibleConnectionsState>
	showConnectionVariables: (connectionId: string) => void
	deleteModalRef: React.RefObject<GenericConfirmModalRef>
	nestingLevel: number
}

export const ConnectionGroupsArray = observer(function ConnectionGroupsArray({
	groups,
	connectionListApi,
	groupedConnections,
	doConfigureConnection,
	selectedConnectionId,
	visibleConnections,
	showConnectionVariables,
	deleteModalRef,
	nestingLevel,
}: ConnectionGroupsArrayProps) {
	return (
		<>
			{groups.map((childGroup, childIndex) => (
				<ConnectionGroupSingle
					key={childGroup.id}
					index={childIndex}
					group={childGroup}
					connectionListApi={connectionListApi}
					groupedConnections={groupedConnections}
					doConfigureConnection={doConfigureConnection}
					selectedConnectionId={selectedConnectionId}
					visibleConnections={visibleConnections}
					showConnectionVariables={showConnectionVariables}
					deleteModalRef={deleteModalRef}
					nestingLevel={nestingLevel}
				/>
			))}
		</>
	)
})

interface ConnectionGroupSingleProps {
	index: number
	group: ConnectionGroup
	connectionListApi: ConnectionListApi
	groupedConnections: Map<string, ClientConnectionConfigWithId[]>
	doConfigureConnection: (connectionId: string | null) => void
	selectedConnectionId: string | null
	visibleConnections: TableVisibilityHelper<VisibleConnectionsState>
	showConnectionVariables: (connectionId: string) => void
	deleteModalRef: React.RefObject<GenericConfirmModalRef>
	nestingLevel?: number
}

// Note: mobx seems to get upset when a component is called recursively, without an intermediate component
const ConnectionGroupSingle = observer(function ConnectionGroupSingle({
	index,
	group,
	connectionListApi,
	groupedConnections,
	doConfigureConnection,
	selectedConnectionId,
	visibleConnections,
	showConnectionVariables,
	deleteModalRef,
	nestingLevel = 0,
}: ConnectionGroupSingleProps) {
	const { isOver, canDrop, dragGroupId, drop } = useGroupListDragging(group.id)

	const collapseHelper = usePanelCollapseHelperContextForPanel(null, group.id)

	const isCollapsed = collapseHelper.isCollapsed || (!!dragGroupId && dragGroupId === group.id)
	const connectionsInGroup = groupedConnections.get(group.id) || []

	return (
		<>
			<ConnectionGroupRow
				group={group}
				toggleExpanded={collapseHelper.toggleCollapsed}
				connectionListApi={connectionListApi}
				isCollapsed={isCollapsed}
				index={index}
				nestingLevel={nestingLevel}
			/>

			{!isCollapsed && (
				<>
					<ConnectionGroupsArray
						groups={group.children}
						connectionListApi={connectionListApi}
						groupedConnections={groupedConnections}
						doConfigureConnection={doConfigureConnection}
						selectedConnectionId={selectedConnectionId}
						visibleConnections={visibleConnections}
						showConnectionVariables={showConnectionVariables}
						deleteModalRef={deleteModalRef}
						nestingLevel={nestingLevel + 1}
					/>

					{canDrop && (!group.children || group.children.length === 0) ? (
						<GroupingTableDropZone drop={drop} itemName="group" />
					) : null}

					{/* Render connections in this group */}
					<ConnectionsInGroup
						doConfigureConnection={doConfigureConnection}
						selectedConnectionId={selectedConnectionId}
						connections={connectionsInGroup}
						groupId={group.id}
						visibleConnections={visibleConnections}
						showConnectionVariables={showConnectionVariables}
						deleteModalRef={deleteModalRef}
						showNoConnectionsMessage={group.children.length === 0}
						nestingLevel={nestingLevel}
					/>
				</>
			)}
		</>
	)
})

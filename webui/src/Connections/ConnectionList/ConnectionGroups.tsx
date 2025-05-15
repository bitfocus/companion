import React from 'react'
import { observer } from 'mobx-react-lite'
import { ConnectionGroupRow } from './ConnectionGroupRow.js'
import { ConnectionsInGroup } from './ConnectionsInGroup.js'
import { GenericConfirmModalRef } from '../../Components/GenericConfirmModal.js'
import { TableVisibilityHelper } from '../../Components/TableVisibility.js'
import { ClientConnectionConfigWithId, VisibleConnectionsState } from './ConnectionList.js'
import { CollapseHelper } from '../../Helpers/CollapseHelper.js'
import { ConnectionGroup } from '@companion-app/shared/Model/Connections.js'
import { ConnectionListApi } from './ConnectionListApi.js'

interface ConnectionGroupsProps {
	parentId: string | null
	groupTree: Map<string | null, string[]>
	groups: Map<string, ConnectionGroup>
	connectionListApi: ConnectionListApi
	collapseHelper: CollapseHelper
	toggleGroupExpanded: (groupId: string) => void
	groupedConnections: Map<string, ClientConnectionConfigWithId[]>
	doConfigureConnection: (connectionId: string | null) => void
	selectedConnectionId: string | null
	visibleConnections: TableVisibilityHelper<VisibleConnectionsState>
	showConnectionVariables: (connectionId: string) => void
	deleteModalRef: React.RefObject<GenericConfirmModalRef>
	nestingLevel?: number
}

export const ConnectionGroups = observer(function ConnectionGroups({
	parentId,
	groupTree,
	groups,
	connectionListApi,
	collapseHelper,
	toggleGroupExpanded,
	groupedConnections,
	doConfigureConnection,
	selectedConnectionId,
	visibleConnections,
	showConnectionVariables,
	deleteModalRef,
	nestingLevel = 0,
}: ConnectionGroupsProps) {
	// Get child groups of current parent
	const childGroupIds = groupTree.get(parentId) || []

	if (childGroupIds.length === 0) return null

	return (
		<>
			{childGroupIds.map((groupId, index) => {
				const group = groups.get(groupId)
				if (!group) return null

				const isCollapsed = collapseHelper.isPanelCollapsed(null, groupId)
				const connectionsInGroup = groupedConnections.get(groupId) || []

				return (
					<React.Fragment key={groupId}>
						<ConnectionGroupRow
							group={group}
							toggleExpanded={toggleGroupExpanded}
							connectionListApi={connectionListApi}
							isCollapsed={isCollapsed}
							index={index}
							nestingLevel={nestingLevel}
						/>

						{!isCollapsed && (
							<>
								<ConnectionsInGroup
									doConfigureConnection={doConfigureConnection}
									selectedConnectionId={selectedConnectionId}
									connections={connectionsInGroup}
									groupId={groupId}
									visibleConnections={visibleConnections}
									showConnectionVariables={showConnectionVariables}
									deleteModalRef={deleteModalRef}
									showNoConnectionsMessage
									nestingLevel={nestingLevel}
								/>

								{/* Render nested groups */}
								<ConnectionGroups
									parentId={groupId}
									groupTree={groupTree}
									groups={groups}
									connectionListApi={connectionListApi}
									collapseHelper={collapseHelper}
									toggleGroupExpanded={toggleGroupExpanded}
									groupedConnections={groupedConnections}
									doConfigureConnection={doConfigureConnection}
									selectedConnectionId={selectedConnectionId}
									visibleConnections={visibleConnections}
									showConnectionVariables={showConnectionVariables}
									deleteModalRef={deleteModalRef}
									nestingLevel={nestingLevel + 1}
								/>
							</>
						)}
					</React.Fragment>
				)
			})}
		</>
	)
})

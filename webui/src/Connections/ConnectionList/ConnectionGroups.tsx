import React from 'react'
import { observer } from 'mobx-react-lite'
import { ConnectionGroupRow } from './ConnectionGroupRow.js'
import { ConnectionsInGroup } from './ConnectionsInGroup.js'
import { GenericConfirmModalRef } from '../../Components/GenericConfirmModal.js'
import { TableVisibilityHelper } from '../../Components/TableVisibility.js'
import { ClientConnectionConfigWithId, VisibleConnectionsState } from './ConnectionList.js'
import { PanelCollapseHelper } from '../../Helpers/CollapseHelper.js'
import { ConnectionGroup } from '@companion-app/shared/Model/Connections.js'
import { ConnectionListApi } from './ConnectionListApi.js'

interface ConnectionGroupsProps {
	groups: ConnectionGroup[]
	connectionListApi: ConnectionListApi
	collapseHelper: PanelCollapseHelper
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
	if (groups.length === 0) return null

	return (
		<>
			{groups.map((group, index) => {
				const isCollapsed = collapseHelper.isPanelCollapsed(null, group.id)
				const connectionsInGroup = groupedConnections.get(group.id) || []

				return (
					<React.Fragment key={group.id}>
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
									groupId={group.id}
									visibleConnections={visibleConnections}
									showConnectionVariables={showConnectionVariables}
									deleteModalRef={deleteModalRef}
									showNoConnectionsMessage
									nestingLevel={nestingLevel}
								/>

								{/* Render nested groups */}
								<ConnectionGroups
									groups={group.children || []}
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

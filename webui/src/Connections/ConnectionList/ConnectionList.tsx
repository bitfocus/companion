import React, { useCallback, useContext, useRef } from 'react'
import { CButton, CButtonGroup } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlug, faLayerGroup } from '@fortawesome/free-solid-svg-icons'
import { ConnectionVariablesModal, ConnectionVariablesModalRef } from '../ConnectionVariablesModal.js'
import { GenericConfirmModal, GenericConfirmModalRef } from '../../Components/GenericConfirmModal.js'
import { RootAppStoreContext } from '../../Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { NonIdealState } from '../../Components/NonIdealState.js'
import { useTableVisibilityHelper, VisibilityButton } from '../../Components/TableVisibility.js'
import { usePanelCollapseHelper } from '../../Helpers/CollapseHelper.js'
import { MissingVersionsWarning } from './MissingVersionsWarning.js'
import { ConnectionGroupRow } from './ConnectionGroupRow.js'
import { ClientConnectionConfig } from '@companion-app/shared/Model/Connections.js'
import { ConnectionsStore } from '../../Stores/ConnectionsStore.js'
import { DragState } from '../../util.js'
import { useConnectionListApi } from './ConnectionListApi.js'
import { ConnectionsInGroup } from './ConnectionsInGroup.js'
import { useConnectionListDragging } from './ConnectionListDropZone.js'
import { useConnectionStatuses } from './useConnectionStatuses.js'
import { ConnectionStatusEntry } from '@companion-app/shared/Model/Common.js'
import { ObservableMap } from 'mobx'

export interface VisibleConnectionsState {
	disabled: boolean
	ok: boolean
	warning: boolean
	error: boolean
}

interface ConnectionsListProps {
	doConfigureConnection: (connectionId: string | null) => void
	selectedConnectionId: string | null
}

export const ConnectionsList = observer(function ConnectionsList({
	doConfigureConnection,
	selectedConnectionId,
}: ConnectionsListProps) {
	const { connections } = useContext(RootAppStoreContext)

	const connectionStatuses = useConnectionStatuses()

	const confirmModalRef = useRef<GenericConfirmModalRef>(null)
	const variablesModalRef = useRef<ConnectionVariablesModalRef>(null)

	const showConnectionVariables = useCallback(
		(connectionId: string) => variablesModalRef.current?.show(connectionId),
		[]
	)

	const collapseHelper = usePanelCollapseHelper('connection-groups', Array.from(connections.groups.keys()), true)

	// Toggle group expansion
	const toggleGroupExpanded = useCallback(
		(groupId: string) => {
			collapseHelper.togglePanelCollapsed(null, groupId)
		},
		[collapseHelper]
	)

	const visibleConnections = useTableVisibilityHelper<VisibleConnectionsState>('connections_visible', {
		disabled: true,
		ok: true,
		warning: true,
		error: true,
	})

	const { groupedConnections, ungroupedConnections } = getGroupedConnections(connections, connectionStatuses)

	const connectionListApi = useConnectionListApi(confirmModalRef)

	const { isDragging } = useConnectionListDragging(null)

	return (
		<div>
			<h4>Connections</h4>

			<p>
				When you want to control devices or software with Companion, you need to add a connection to let Companion know
				how to communicate with whatever you want to control.
			</p>

			<MissingVersionsWarning />

			<GenericConfirmModal ref={confirmModalRef} />
			<ConnectionVariablesModal ref={variablesModalRef} />

			<div className="connection-group-actions mb-2">
				<CButton color="primary" size="sm" onClick={connectionListApi.addNewGroup}>
					<FontAwesomeIcon icon={faLayerGroup} /> Add Group
				</CButton>
			</div>

			<table className="table-tight table-responsive-sm">
				<thead>
					<tr>
						<th className="fit">&nbsp;</th>
						<th>Label</th>
						<th>Module</th>
						<th colSpan={3} className="fit">
							<CButtonGroup className="table-header-buttons">
								<VisibilityButton {...visibleConnections} keyId="disabled" color="secondary" label="Disabled" />
								<VisibilityButton {...visibleConnections} keyId="ok" color="success" label="OK" />
								<VisibilityButton {...visibleConnections} keyId="warning" color="warning" label="Warning" />
								<VisibilityButton {...visibleConnections} keyId="error" color="danger" label="Error" />
							</CButtonGroup>
						</th>
					</tr>
				</thead>
				<tbody>
					{/* Render grouped connections */}
					{Array.from(connections.groups.entries())
						.sort(([, a], [, b]) => a.sortOrder - b.sortOrder)
						.map(([groupId, group], index) => {
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
									/>

									{!isCollapsed && (
										<ConnectionsInGroup
											doConfigureConnection={doConfigureConnection}
											selectedConnectionId={selectedConnectionId}
											connections={connectionsInGroup}
											groupId={groupId}
											visibleConnections={visibleConnections}
											showConnectionVariables={showConnectionVariables}
											deleteModalRef={confirmModalRef}
											showNoConnectionsMessage
										/>
									)}
								</React.Fragment>
							)
						})}

					{/* Render ungrouped connections */}

					{(isDragging || ungroupedConnections.length > 0) && connections.groups.size > 0 && (
						<tr className="collapsible-group-header">
							<td colSpan={6}>
								<span className="group-name">Ungrouped Connections</span>
							</td>
						</tr>
					)}

					<ConnectionsInGroup
						doConfigureConnection={doConfigureConnection}
						selectedConnectionId={selectedConnectionId}
						connections={ungroupedConnections}
						groupId={null}
						visibleConnections={visibleConnections}
						showConnectionVariables={showConnectionVariables}
						deleteModalRef={confirmModalRef}
						showNoConnectionsMessage={false}
					/>

					{connections.count === 0 && (
						<tr>
							<td colSpan={6}>
								<NonIdealState icon={faPlug}>
									You haven't set up any connections yet. <br />
									Try adding something from the list <span className="d-xl-none">below</span>
									<span className="d-none d-xl-inline">to the right</span>.
								</NonIdealState>
							</td>
						</tr>
					)}
				</tbody>
			</table>
		</div>
	)
})

export interface ConnectionDragItem {
	connectionId: string
	groupId: string | null
	index: number

	dragState: DragState | null
}
export interface ConnectionDragStatus {
	isDragging: boolean
}

export interface ConnectionGroupDragItem {
	groupId: string
	index: number
	dragState: DragState | null
}
export interface ConnectionGroupDragStatus {
	isDragging: boolean
}

export interface ClientConnectionConfigWithId extends ClientConnectionConfig {
	id: string
	status: ConnectionStatusEntry | undefined
}
function getGroupedConnections(
	connections: ConnectionsStore,
	connectionStatuses: ObservableMap<string, ConnectionStatusEntry>
) {
	const validGroupIds = new Set(connections.groups.keys())
	const groupedConnections = new Map<string, ClientConnectionConfigWithId[]>()
	const ungroupedConnections: ClientConnectionConfigWithId[] = []
	for (const [connectionId, connection] of connections.connections) {
		const status = connectionStatuses.get(connectionId)
		if (connection.groupId && validGroupIds.has(connection.groupId)) {
			if (!groupedConnections.has(connection.groupId)) {
				groupedConnections.set(connection.groupId, [])
			}
			groupedConnections.get(connection.groupId)!.push({ ...connection, id: connectionId, status })
		} else {
			ungroupedConnections.push({ ...connection, id: connectionId, status })
		}
	}

	// sort All connections by sortOrder
	ungroupedConnections.sort((a, b) => a.sortOrder - b.sortOrder)
	for (const connections of groupedConnections.values()) {
		connections.sort((a, b) => a.sortOrder - b.sortOrder)
	}

	return {
		groupedConnections,
		ungroupedConnections,
	}
}

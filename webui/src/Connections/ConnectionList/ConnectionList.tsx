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
import { PanelCollapseHelperProvider, usePanelCollapseHelper } from '../../Helpers/CollapseHelper.js'
import { MissingVersionsWarning } from './MissingVersionsWarning.js'
import { ClientConnectionConfig } from '@companion-app/shared/Model/Connections.js'
import { ConnectionsStore } from '../../Stores/ConnectionsStore.js'
import { DragState } from '../../util.js'
import { useConnectionListApi } from './ConnectionListApi.js'
import { ConnectionsInGroup } from './ConnectionsInGroup.js'
import { useConnectionListDragging } from './ConnectionListDropZone.js'
import { useConnectionStatuses } from './useConnectionStatuses.js'
import { ConnectionStatusEntry } from '@companion-app/shared/Model/Common.js'
import { ObservableMap, toJS } from 'mobx'
import { ConnectionGroupsArray } from './ConnectionGroups.js'

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

	const visibleConnections = useTableVisibilityHelper<VisibleConnectionsState>('connections_visible', {
		disabled: true,
		ok: true,
		warning: true,
		error: true,
	})

	const { groupedConnections, ungroupedConnections } = getGroupedConnections(connections, connectionStatuses)

	console.log(
		'groups',
		connections.rootGroups().map((k) => toJS(k))
	)

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
				<CButton color="primary" size="sm" onClick={() => connectionListApi.addNewGroup('New Group')}>
					<FontAwesomeIcon icon={faLayerGroup} /> Add Group
				</CButton>
			</div>

			<table className="table-tight table-responsive-sm">
				<thead>
					<tr>
						<th className="fit">&nbsp;</th>
						<th>Connection</th>
						<th colSpan={4} className="fit">
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
					{/* Render root level groups and their nested content */}
					<PanelCollapseHelperProvider
						storageId="connection-groups"
						knownPanelIds={connections.allGroupIds}
						defaultCollapsed
					>
						<ConnectionGroupsArray
							groups={connections.rootGroups()}
							connectionListApi={connectionListApi}
							groupedConnections={groupedConnections}
							doConfigureConnection={doConfigureConnection}
							selectedConnectionId={selectedConnectionId}
							visibleConnections={visibleConnections}
							showConnectionVariables={showConnectionVariables}
							deleteModalRef={confirmModalRef}
							nestingLevel={0}
						/>
					</PanelCollapseHelperProvider>

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

interface GroupedConnectionsData {
	groupedConnections: Map<string, ClientConnectionConfigWithId[]>
	ungroupedConnections: ClientConnectionConfigWithId[]
}

function getGroupedConnections(
	connections: ConnectionsStore,
	connectionStatuses: ObservableMap<string, ConnectionStatusEntry>
): GroupedConnectionsData {
	const validGroupIds = new Set(connections.allGroupIds)
	const groupedConnections = new Map<string, ClientConnectionConfigWithId[]>()
	const ungroupedConnections: ClientConnectionConfigWithId[] = []

	// Initialize empty arrays for all groups
	for (const groupId of validGroupIds) {
		groupedConnections.set(groupId, [])
	}

	// Assign connections to their groups
	for (const [connectionId, connection] of connections.connections) {
		const status = connectionStatuses.get(connectionId)
		if (connection.groupId && validGroupIds.has(connection.groupId)) {
			groupedConnections.get(connection.groupId)!.push({ ...connection, id: connectionId, status })
		} else {
			ungroupedConnections.push({ ...connection, id: connectionId, status })
		}
	}

	// Sort connections by sortOrder within each group
	ungroupedConnections.sort((a, b) => a.sortOrder - b.sortOrder)
	for (const connections of groupedConnections.values()) {
		connections.sort((a, b) => a.sortOrder - b.sortOrder)
	}

	return {
		groupedConnections,
		ungroupedConnections,
	}
}

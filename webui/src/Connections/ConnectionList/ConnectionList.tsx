import React, { useCallback, useContext, useRef } from 'react'
import { CButton, CButtonGroup } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faEyeSlash, faPlug, faLayerGroup } from '@fortawesome/free-solid-svg-icons'
import { ConnectionVariablesModal, ConnectionVariablesModalRef } from '../ConnectionVariablesModal.js'
import { GenericConfirmModal, GenericConfirmModalRef } from '../../Components/GenericConfirmModal.js'
import type { ConnectionStatusEntry } from '@companion-app/shared/Model/Common.js'
import { RootAppStoreContext } from '../../Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { NonIdealState } from '../../Components/NonIdealState.js'
import { TableVisibilityHelper, useTableVisibilityHelper, VisibilityButton } from '../../Components/TableVisibility.js'
import { usePanelCollapseHelper } from '../../Helpers/CollapseHelper.js'
import { MissingVersionsWarning } from './MissingVersionsWarning.js'
import { ConnectionsTableRow } from './ConnectionsTableRow.js'
import { ConnectionGroupRow } from './ConnectionGroupRow.js'
import { ClientConnectionConfig } from '@companion-app/shared/Model/Connections.js'
import { ConnectionsStore } from '../../Stores/ConnectionsStore.js'
import { DragState } from '../../util.js'
import { useConnectionListDragging } from './ConnectionListDropZone.js'

interface VisibleConnectionsState {
	disabled: boolean
	ok: boolean
	warning: boolean
	error: boolean
}

interface ConnectionsListProps {
	doConfigureConnection: (connectionId: string | null) => void
	connectionStatus: Record<string, ConnectionStatusEntry | undefined> | undefined
	selectedConnectionId: string | null
}

export const ConnectionsList = observer(function ConnectionsList({
	doConfigureConnection,
	connectionStatus,
	selectedConnectionId,
}: ConnectionsListProps) {
	const { connections, socket } = useContext(RootAppStoreContext)

	const deleteModalRef = useRef<GenericConfirmModalRef>(null)
	const variablesModalRef = useRef<ConnectionVariablesModalRef>(null)

	const collapseHelper = usePanelCollapseHelper('connection-groups', Array.from(connections.groups.keys()), true)

	// Create a new empty group - use the socket connection to call the backend
	const addNewGroup = useCallback(() => {
		socket.emitPromise('connection-groups:add', ['New Group']).catch((e) => {
			console.error('Failed to add group', e)
		})
	}, [socket])

	// Toggle group expansion
	const toggleGroupExpanded = useCallback(
		(groupId: string) => {
			collapseHelper.setPanelCollapsed(groupId, !collapseHelper.isPanelCollapsed(null, groupId))
		},
		[collapseHelper]
	)

	// Rename a group
	const renameGroup = useCallback(
		(groupId: string, newName: string) => {
			socket.emitPromise('connection-groups:set-name', [groupId, newName]).catch((e) => {
				console.error('Failed to rename group', e)
			})
		},
		[socket]
	)

	// Delete a group and move its connections to ungrouped
	const deleteGroup = useCallback(
		(groupId: string) => {
			deleteModalRef.current?.show(
				'Delete Group',
				'Are you sure you want to delete this group? All connections in this group will be moved to Ungrouped Connections.',
				'Delete',
				() => {
					socket.emitPromise('connection-groups:remove', [groupId]).catch((e) => {
						console.error('Failed to delete group', e)
					})
				}
			)
		},
		[socket, deleteModalRef]
	)

	const visibleConnections = useTableVisibilityHelper<VisibleConnectionsState>('connections_visible', {
		disabled: true,
		ok: true,
		warning: true,
		error: true,
	})

	const { groupedConnections, ungroupedConnections } = getGroupedConnections(connections)

	return (
		<div>
			<h4>Connections</h4>

			<p>
				When you want to control devices or software with Companion, you need to add a connection to let Companion know
				how to communicate with whatever you want to control.
			</p>

			<MissingVersionsWarning />

			<GenericConfirmModal ref={deleteModalRef} />
			<ConnectionVariablesModal ref={variablesModalRef} />

			<div className="connection-group-actions mb-2">
				<CButton color="primary" size="sm" onClick={addNewGroup}>
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
					{Array.from(connections.groups.entries()).map(([groupId, group]) => {
						const isCollapsed = collapseHelper.isPanelCollapsed(null, groupId)

						const connectionsInGroup = groupedConnections.get(groupId) || []

						return (
							<React.Fragment key={groupId}>
								<ConnectionGroupRow
									group={group}
									toggleExpanded={toggleGroupExpanded}
									renameGroup={renameGroup}
									deleteGroup={deleteGroup}
									isCollapsed={isCollapsed}
								/>

								{!isCollapsed && (
									<ConnectionsInGroup
										doConfigureConnection={doConfigureConnection}
										connectionStatus={connectionStatus}
										selectedConnectionId={selectedConnectionId}
										connections={connectionsInGroup}
										groupId={groupId}
										visibleConnections={visibleConnections}
										variablesModalRef={variablesModalRef}
										deleteModalRef={deleteModalRef}
										showNoConnectionsMessage
									/>
								)}
							</React.Fragment>
						)
					})}

					{/* Render ungrouped connections */}

					<ConnectionsInGroup
						headingRow={
							connections.groups.size > 0 && (
								<tr className="connection-group-header">
									<td colSpan={6}>
										<span className="group-name">Ungrouped Connections</span>
									</td>
								</tr>
							)
						}
						doConfigureConnection={doConfigureConnection}
						connectionStatus={connectionStatus}
						selectedConnectionId={selectedConnectionId}
						connections={ungroupedConnections}
						groupId={null}
						visibleConnections={visibleConnections}
						variablesModalRef={variablesModalRef}
						deleteModalRef={deleteModalRef}
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

interface ClientConnectionConfigWithId extends ClientConnectionConfig {
	id: string
}
function getGroupedConnections(connections: ConnectionsStore) {
	const validGroupIds = new Set(connections.groups.keys())
	const groupedConnections = new Map<string, ClientConnectionConfigWithId[]>()
	const ungroupedConnections: ClientConnectionConfigWithId[] = []
	for (const [connectionId, connection] of connections.connections) {
		if (connection.groupId && validGroupIds.has(connection.groupId)) {
			if (!groupedConnections.has(connection.groupId)) {
				groupedConnections.set(connection.groupId, [])
			}
			groupedConnections.get(connection.groupId)!.push({ ...connection, id: connectionId })
		} else {
			ungroupedConnections.push({ ...connection, id: connectionId })
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

function ConnectionsInGroup({
	headingRow,
	doConfigureConnection,
	connectionStatus,
	selectedConnectionId,
	connections,
	groupId,
	visibleConnections,
	variablesModalRef,
	deleteModalRef,
	showNoConnectionsMessage,
}: {
	headingRow?: React.ReactNode
	doConfigureConnection: (connectionId: string | null) => void
	connectionStatus: Record<string, ConnectionStatusEntry | undefined> | undefined
	selectedConnectionId: string | null
	connections: ClientConnectionConfigWithId[]
	groupId: string | null
	visibleConnections: TableVisibilityHelper<VisibleConnectionsState>
	variablesModalRef: React.RefObject<ConnectionVariablesModalRef>
	deleteModalRef: React.RefObject<GenericConfirmModalRef>
	showNoConnectionsMessage: boolean
}) {
	const doShowVariables = useCallback((connectionId: string) => {
		variablesModalRef.current?.show(connectionId)
	}, [])

	let visibleCount = 0

	const connectionRows = connections
		.map((connection, index) => {
			const status = connectionStatus?.[connection.id]

			// Apply visibility filters
			if (!visibleConnections.visibility.disabled && connection.enabled === false) {
				return null
			} else if (status) {
				if (!visibleConnections.visibility.ok && status.category === 'good') {
					return null
				} else if (!visibleConnections.visibility.warning && status.category === 'warning') {
					return null
				} else if (!visibleConnections.visibility.error && status.category === 'error') {
					return null
				}
			}

			visibleCount++

			return (
				<ConnectionsTableRow
					key={connection.id}
					id={connection.id}
					index={index}
					connection={connection}
					connectionStatus={status}
					showVariables={doShowVariables}
					deleteModalRef={deleteModalRef}
					configureConnection={doConfigureConnection}
					isSelected={connection.id === selectedConnectionId}
				/>
			)
		})
		.filter((row) => row !== null)

	// Calculate number of hidden connections
	const hiddenCount = connections.length - visibleCount

	const { isDragging, drop } = useConnectionListDragging(groupId)

	return (
		<>
			{(isDragging || connections.length > 0) && headingRow}

			{connectionRows}

			{isDragging && connections.length === 0 && (
				<tr ref={drop} className="connectionlist-dropzone">
					<td colSpan={6}>
						<p>Drop connection here</p>
					</td>
				</tr>
			)}

			{hiddenCount > 0 && (
				<tr>
					<td colSpan={6} style={{ padding: '10px 5px' }}>
						<FontAwesomeIcon icon={faEyeSlash} style={{ marginRight: '0.5em', color: 'gray' }} />
						<strong>{hiddenCount} Connections are hidden</strong>
					</td>
				</tr>
			)}

			{showNoConnectionsMessage && connections.length === 0 && !isDragging && (
				<tr>
					<td colSpan={6} style={{ padding: '10px 5px' }}>
						<FontAwesomeIcon icon={faEyeSlash} style={{ marginRight: '0.5em', color: 'gray' }} />
						<strong>There are no connections in this group</strong>
					</td>
				</tr>
			)}
		</>
	)
}

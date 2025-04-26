import React, { useCallback, useContext, useRef, useMemo } from 'react'
import { CButton, CButtonGroup } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faEyeSlash, faPlug, faLayerGroup } from '@fortawesome/free-solid-svg-icons'
import { ConnectionVariablesModal, ConnectionVariablesModalRef } from '../ConnectionVariablesModal.js'
import { GenericConfirmModal, GenericConfirmModalRef } from '../../Components/GenericConfirmModal.js'
import type { ConnectionStatusEntry } from '@companion-app/shared/Model/Common.js'
import { RootAppStoreContext } from '../../Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { NonIdealState } from '../../Components/NonIdealState.js'
import { useTableVisibilityHelper, VisibilityButton } from '../../Components/TableVisibility.js'
import { usePanelCollapseHelper } from '../../Helpers/CollapseHelper.js'
import { MissingVersionsWarning } from './MissingVersionsWarning.js'
import { ConnectionsTableRow } from './ConnectionsTableRow.js'
import { ConnectionGroupRow } from './ConnectionGroupRow.js'

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

	// Move a connection to a group
	const moveConnectionToGroup = useCallback(
		(connectionId: string, groupId: string | null) => {
			// TODO: This would be implemented in the backend
			socket
				.emitPromise('connection-groups:move-connection', [
					{
						connectionId,
						groupId,
					},
				])
				.catch((e) => {
					console.error('Failed to move connection to group', e)
				})
		},
		[socket]
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
			socket.emitPromise('connection-groups:remove', [groupId]).catch((e) => {
				console.error('Failed to delete group', e)
			})
		},
		[socket]
	)

	const doShowVariables = useCallback((connectionId: string) => {
		variablesModalRef.current?.show(connectionId)
	}, [])

	const visibleConnections = useTableVisibilityHelper<VisibleConnectionsState>('connections_visible', {
		disabled: true,
		ok: true,
		warning: true,
		error: true,
	})

	const moveRow = useCallback(
		(itemId: string, targetId: string) => {
			const rawIds = Array.from(connections.connections.entries())
				.sort(([, a], [, b]) => a.sortOrder - b.sortOrder)
				.map(([id]) => id)

			const itemIndex = rawIds.indexOf(itemId)
			const targetIndex = rawIds.indexOf(targetId)
			if (itemIndex === -1 || targetIndex === -1) return

			const newIds = rawIds.filter((id) => id !== itemId)
			newIds.splice(targetIndex, 0, itemId)

			socket.emitPromise('connections:set-order', [newIds]).catch((e) => {
				console.error('Reorder failed', e)
			})
		},
		[socket, connections]
	)

	// Get list of ungrouped connections - any connection not in a group
	const ungroupedConnections = useMemo(() => {
		// Filter connections that don't have a groupId property
		return Array.from(connections.connections.entries())
			.filter(([_, connection]) => !connection.groupId)
			.map(([id]) => id)
	}, [connections.connections])

	let visibleCount = 0
	// Calculate number of hidden connections
	const hiddenCount = connections.count - visibleCount

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
					{Array.from(connections.groups.entries()).map(([groupId, group]) => (
						<React.Fragment key={groupId}>
							<ConnectionGroupRow
								group={group}
								toggleExpanded={toggleGroupExpanded}
								renameGroup={renameGroup}
								deleteGroup={deleteGroup}
								collapseHelper={collapseHelper}
							/>

							{!collapseHelper.isPanelCollapsed(null, groupId) &&
								Array.from(connections.connections.entries())
									.filter(([_, connection]) => connection.groupId === groupId)
									.map(([connectionId, connection]) => {
										const status = connectionStatus?.[connectionId]

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
												key={connectionId}
												id={connectionId}
												connection={connection}
												connectionStatus={status}
												showVariables={doShowVariables}
												deleteModalRef={deleteModalRef}
												configureConnection={doConfigureConnection}
												moveRow={moveRow}
												isSelected={connectionId === selectedConnectionId}
												moveConnectionToGroup={moveConnectionToGroup}
											/>
										)
									})}
						</React.Fragment>
					))}

					{/* Render ungrouped connections */}
					{ungroupedConnections.length > 0 && (
						<tr className="connection-group-header">
							<td colSpan={6}>
								<span className="group-name">Ungrouped Connections</span>
							</td>
						</tr>
					)}

					{ungroupedConnections.map((connectionId) => {
						const connection = connections.connections.get(connectionId)
						const status = connectionStatus?.[connectionId]

						if (!connection) return null

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
								key={connectionId}
								id={connectionId}
								connection={connection}
								connectionStatus={status}
								showVariables={doShowVariables}
								deleteModalRef={deleteModalRef}
								configureConnection={doConfigureConnection}
								moveRow={moveRow}
								isSelected={connectionId === selectedConnectionId}
								moveConnectionToGroup={moveConnectionToGroup}
							/>
						)
					})}

					{hiddenCount > 0 && (
						<tr>
							<td colSpan={6} style={{ padding: '10px 5px' }}>
								<FontAwesomeIcon icon={faEyeSlash} style={{ marginRight: '0.5em', color: 'gray' }} />
								<strong>{hiddenCount} Connections are hidden</strong>
							</td>
						</tr>
					)}
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
	id: string
}
export interface ConnectionDragStatus {
	isDragging: boolean
}

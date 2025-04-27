import type { ConnectionStatusEntry } from '@companion-app/shared/Model/Common.js'
import { faEyeSlash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback } from 'react'
import { GenericConfirmModalRef } from '../../Components/GenericConfirmModal.js'
import { TableVisibilityHelper } from '../../Components/TableVisibility.js'
import { ConnectionVariablesModalRef } from '../ConnectionVariablesModal.js'
import { ClientConnectionConfigWithId, VisibleConnectionsState } from './ConnectionList.js'
import { useConnectionListDragging } from './ConnectionListDropZone.js'
import { ConnectionsTableRow } from './ConnectionsTableRow.js'
import { observer } from 'mobx-react-lite'

interface ConnectionsInGroupProps {
	doConfigureConnection: (connectionId: string | null) => void
	connectionStatus: Record<string, ConnectionStatusEntry | undefined> | undefined
	selectedConnectionId: string | null
	connections: ClientConnectionConfigWithId[]
	groupId: string | null
	visibleConnections: TableVisibilityHelper<VisibleConnectionsState>
	variablesModalRef: React.RefObject<ConnectionVariablesModalRef>
	deleteModalRef: React.RefObject<GenericConfirmModalRef>
	showNoConnectionsMessage: boolean
}

export const ConnectionsInGroup = observer(function ConnectionsInGroup({
	doConfigureConnection,
	connectionStatus,
	selectedConnectionId,
	connections,
	groupId,
	visibleConnections,
	variablesModalRef,
	deleteModalRef,
	showNoConnectionsMessage,
}: ConnectionsInGroupProps) {
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
})

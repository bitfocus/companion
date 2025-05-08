import React from 'react'
import { GenericConfirmModalRef } from '../../Components/GenericConfirmModal.js'
import { TableVisibilityHelper } from '../../Components/TableVisibility.js'
import { ClientConnectionConfigWithId, VisibleConnectionsState } from './ConnectionList.js'
import { useConnectionListDragging } from './ConnectionListDropZone.js'
import { ConnectionsTableRow } from './ConnectionsTableRow.js'
import { observer } from 'mobx-react-lite'
import { CollapsibleGroupContents } from '../../Components/GroupingTable/CollapsibleGroupContents.js'

interface ConnectionsInGroupProps {
	doConfigureConnection: (connectionId: string | null) => void
	selectedConnectionId: string | null
	connections: ClientConnectionConfigWithId[]
	groupId: string | null
	visibleConnections: TableVisibilityHelper<VisibleConnectionsState>
	showConnectionVariables: (connectionId: string) => void
	deleteModalRef: React.RefObject<GenericConfirmModalRef>
	showNoConnectionsMessage: boolean
}

export const ConnectionsInGroup = observer(function ConnectionsInGroup({
	doConfigureConnection,
	selectedConnectionId,
	connections,
	groupId,
	visibleConnections,
	showConnectionVariables,
	deleteModalRef,
	showNoConnectionsMessage,
}: ConnectionsInGroupProps) {
	const { isDragging, drop } = useConnectionListDragging(groupId)

	return (
		<CollapsibleGroupContents<ClientConnectionConfigWithId>
			items={connections}
			showNoItemsMessage={showNoConnectionsMessage}
			itemName="connection"
			isDragging={isDragging}
			drop={drop}
		>
			{(connection, index) => {
				// Apply visibility filters
				if (!visibleConnections.visibility.disabled && connection.enabled === false) {
					return null
				} else if (connection.status) {
					if (!visibleConnections.visibility.ok && connection.status.category === 'good') {
						return null
					} else if (!visibleConnections.visibility.warning && connection.status.category === 'warning') {
						return null
					} else if (!visibleConnections.visibility.error && connection.status.category === 'error') {
						return null
					}
				}

				return (
					<ConnectionsTableRow
						key={connection.id}
						id={connection.id}
						index={index}
						connection={connection}
						showVariables={showConnectionVariables}
						deleteModalRef={deleteModalRef}
						configureConnection={doConfigureConnection}
						isSelected={connection.id === selectedConnectionId}
					/>
				)
			}}
		</CollapsibleGroupContents>
	)
})

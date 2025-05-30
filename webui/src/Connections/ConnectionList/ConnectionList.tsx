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
import { PanelCollapseHelperProvider } from '../../Helpers/CollapseHelper.js'
import { MissingVersionsWarning } from './MissingVersionsWarning.js'
import { ClientConnectionConfig, ConnectionGroup } from '@companion-app/shared/Model/Connections.js'
import { useConnectionListApi } from './ConnectionListApi.js'
import { useConnectionStatuses } from './useConnectionStatuses.js'
import { ConnectionStatusEntry } from '@companion-app/shared/Model/Common.js'
import { GroupingTable } from '../../Components/GroupingTable/GroupingTable.js'
import { ConnectionListContextProvider, useConnectionListContext } from './ConnectionListContext.js'
import { useComputed } from '../../util.js'
import { ConnectionsTableRow } from './ConnectionsTableRow.js'

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

	const connectionListApi = useConnectionListApi(confirmModalRef)

	const allConnections = useComputed(() => {
		const allConnections: ClientConnectionConfigWithId[] = []

		for (const [connectionId, connection] of connections.connections) {
			const status = connectionStatuses.get(connectionId)
			allConnections.push({ ...connection, id: connectionId, status })
		}

		return allConnections
	}, [connections.connections, connectionStatuses])

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
			<PanelCollapseHelperProvider
				storageId="connection-groups"
				knownPanelIds={connections.allGroupIds}
				defaultCollapsed
			>
				<ConnectionListContextProvider
					visibleConnections={visibleConnections}
					showVariables={showConnectionVariables}
					deleteModalRef={confirmModalRef}
					configureConnection={doConfigureConnection}
					selectedConnectionId={selectedConnectionId}
				>
					<GroupingTable<ConnectionGroup, ClientConnectionConfigWithId>
						Heading={ConnectionListTableHeading}
						NoContent={ConnectionListNoConnections}
						ItemRow={ConnectionListItem}
						itemName="connection"
						dragId="connection"
						groupApi={connectionListApi}
						groups={connections.rootGroups()}
						items={allConnections}
					/>
				</ConnectionListContextProvider>
			</PanelCollapseHelperProvider>
		</div>
	)
})

export interface ClientConnectionConfigWithId extends ClientConnectionConfig {
	id: string
	status: ConnectionStatusEntry | undefined
}

function ConnectionListTableHeading() {
	const { visibleConnections } = useConnectionListContext()

	return (
		<div className="flex flex-row">
			<div className="grow">Connection</div>
			<div className="no-break">
				<CButtonGroup className="table-header-buttons">
					<VisibilityButton {...visibleConnections} keyId="disabled" color="secondary" label="Disabled" />
					<VisibilityButton {...visibleConnections} keyId="ok" color="success" label="OK" />
					<VisibilityButton {...visibleConnections} keyId="warning" color="warning" label="Warning" />
					<VisibilityButton {...visibleConnections} keyId="error" color="danger" label="Error" />
				</CButtonGroup>
			</div>
		</div>
	)
}

function ConnectionListNoConnections() {
	return (
		<NonIdealState icon={faPlug}>
			You haven't set up any connections yet. <br />
			Try adding something from the list <span className="d-xl-none">below</span>
			<span className="d-none d-xl-inline">to the right</span>.
		</NonIdealState>
	)
}

function ConnectionListItem({ item: connection, index }: { item: ClientConnectionConfigWithId; index: number }) {
	const { visibleConnections, showVariables, deleteModalRef, configureConnection, selectedConnectionId } =
		useConnectionListContext()

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
			showVariables={showVariables}
			deleteModalRef={deleteModalRef}
			configureConnection={configureConnection}
			isSelected={connection.id === selectedConnectionId}
		/>
	)
}

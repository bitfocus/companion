import React, { useCallback, useContext, useRef } from 'react'
import { CButton, CButtonGroup } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlug, faLayerGroup } from '@fortawesome/free-solid-svg-icons'
import { ConnectionVariablesModal, ConnectionVariablesModalRef } from '../ConnectionVariablesModal.js'
import { GenericConfirmModal, GenericConfirmModalRef } from '../../Components/GenericConfirmModal.js'
import { RootAppStoreContext } from '../../Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { NonIdealState } from '../../Components/NonIdealState.js'
import { TableVisibilityHelper, useTableVisibilityHelper, VisibilityButton } from '../../Components/TableVisibility.js'
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

	console.log('conns', allConnections)

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
				>
					<GroupingTable<ConnectionGroup, ClientConnectionConfigWithId>
						Heading={ConnectionListTableHeading}
						NoContent={ConnectionListNoConnections}
						ItemRow={(item) => ConnectionListItemWrapper(visibleConnections, item)}
						itemName="connection"
						dragId="connection"
						groupApi={connectionListApi}
						groups={connections.rootGroups()}
						items={allConnections}
						selectedItemId={selectedConnectionId}
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

function ConnectionListItemWrapper(
	visibleConnections: TableVisibilityHelper<VisibleConnectionsState>,
	item: ClientConnectionConfigWithId
) {
	// Apply visibility filters
	if (!visibleConnections.visibility.disabled && item.enabled === false) {
		return null
	} else if (item.status) {
		if (!visibleConnections.visibility.ok && item.status.category === 'good') {
			return null
		} else if (!visibleConnections.visibility.warning && item.status.category === 'warning') {
			return null
		} else if (!visibleConnections.visibility.error && item.status.category === 'error') {
			return null
		}
	}

	return <ConnectionsTableRow connection={item} />
}

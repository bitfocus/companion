import React, { useCallback, useContext, useRef } from 'react'
import { CButton, CButtonGroup, CFormSwitch } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlug, faLayerGroup } from '@fortawesome/free-solid-svg-icons'
import { ConnectionVariablesModal, ConnectionVariablesModalRef } from '../ConnectionVariablesModal.js'
import { GenericConfirmModal, GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { useTableVisibilityHelper, VisibilityButton } from '~/Components/TableVisibility.js'
import { PanelCollapseHelperProvider } from '~/Helpers/CollapseHelper.js'
import { MissingVersionsWarning } from '../../Instances/MissingVersionsWarning.js'
import { ClientConnectionConfig, ConnectionCollection } from '@companion-app/shared/Model/Connections.js'
import { useConnectionCollectionsApi } from './ConnectionListApi.js'
import { useInstanceStatuses } from '../../Instances/useInstanceStatuses.js'
import { InstanceStatusEntry } from '@companion-app/shared/Model/InstanceStatus.js'
import { CollectionsNestingTable } from '~/Components/CollectionsNestingTable/CollectionsNestingTable.js'
import { ConnectionListContextProvider, useConnectionListContext } from './ConnectionListContext.js'
import { useComputed } from '~/Resources/util.js'
import { ConnectionsTableRow } from './ConnectionsTableRow.js'
import { useNavigate } from '@tanstack/react-router'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'

export interface VisibleConnectionsState {
	disabled: boolean
	ok: boolean
	warning: boolean
	error: boolean
}

interface ConnectionsListProps {
	selectedConnectionId: string | null
}

export const ConnectionsList = observer(function ConnectionsList({ selectedConnectionId }: ConnectionsListProps) {
	const { connections } = useContext(RootAppStoreContext)

	const connectionStatuses = useInstanceStatuses()

	const navigate = useNavigate({ from: '/connections/configured' })
	const doConfigureConnection = useCallback(
		(connectionId: string | null) => {
			if (!connectionId) {
				void navigate({ to: '/connections/configured' })
			} else {
				void navigate({ to: '/connections/configured/$connectionId', params: { connectionId } })
			}
		},
		[navigate]
	)

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

	const connectionListApi = useConnectionCollectionsApi(confirmModalRef)

	const allConnections = useComputed(() => {
		const allConnections: ClientConnectionConfigWithId[] = []

		for (const [connectionId, connection] of connections.connections) {
			const status = connectionStatuses.get(connectionId)
			allConnections.push({ ...connection, id: connectionId, status })
		}

		return allConnections
	}, [connections.connections, connectionStatuses])

	const ConnectionsItemRow = useCallback(
		(item: ClientConnectionConfigWithId) =>
			ConnectionListItemWrapper(visibleConnections.visibility, item, selectedConnectionId),
		[visibleConnections.visibility, selectedConnectionId]
	)

	return (
		<div className="connections-list-container flex-column-layout">
			<div className="connections-list-header fixed-header">
				<h4>Connections</h4>

				<p>
					When you want to control devices or software with Companion, you need to add a connection to let Companion
					know how to communicate with whatever you want to control.
				</p>

				<MissingVersionsWarning moduleType={ModuleInstanceType.Connection} instances={connections.connections} />

				<GenericConfirmModal ref={confirmModalRef} />
				<ConnectionVariablesModal ref={variablesModalRef} />

				<div className="connection-group-actions mb-2">
					<CButtonGroup>
						<CButton
							color="primary"
							size="sm"
							className="d-xl-none"
							onClick={() => void navigate({ to: '/connections/configured/add' })}
						>
							<FontAwesomeIcon icon={faPlug} className="me-1" />
							Add Connection
						</CButton>
						<CreateCollectionButton />
					</CButtonGroup>
				</div>
			</div>

			<div className="connections-list-table-container scrollable-content">
				<PanelCollapseHelperProvider
					storageId="connection-collections"
					knownPanelIds={connections.allCollectionIds}
					defaultCollapsed
				>
					<ConnectionListContextProvider
						visibleConnections={visibleConnections}
						showVariables={showConnectionVariables}
						deleteModalRef={confirmModalRef}
						configureConnection={doConfigureConnection}
					>
						<CollectionsNestingTable<ConnectionCollection, ClientConnectionConfigWithId>
							Heading={ConnectionListTableHeading}
							NoContent={ConnectionListNoConnections}
							ItemRow={ConnectionsItemRow}
							GroupHeaderContent={ConnectionGroupHeaderContent}
							itemName="connection"
							dragId="connection"
							collectionsApi={connectionListApi}
							collections={connections.rootCollections()}
							items={allConnections}
							selectedItemId={selectedConnectionId}
						/>
					</ConnectionListContextProvider>
				</PanelCollapseHelperProvider>
			</div>
		</div>
	)
})

export interface ClientConnectionConfigWithId extends ClientConnectionConfig {
	id: string
	status: InstanceStatusEntry | undefined
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

function ConnectionGroupHeaderContent({ collection }: { collection: ConnectionCollection }) {
	const setEnabledMutation = useMutationExt(trpc.instances.connections.collections.setEnabled.mutationOptions())

	const setEnabled = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const enabled = e.target.checked

			setEnabledMutation.mutateAsync({ collectionId: collection.id, enabled }).catch((e: any) => {
				console.error('Failed to set collection enabled state', e)
			})
		},
		[setEnabledMutation, collection.id]
	)

	return (
		<CFormSwitch
			className="ms-1"
			color="success"
			checked={collection.metaData.enabled}
			onChange={setEnabled}
			title={collection.metaData.enabled ? 'Disable collection' : 'Enable collection'}
			size="xl"
		/>
	)
}

function ConnectionListItemWrapper(
	visibility: VisibleConnectionsState,
	item: ClientConnectionConfigWithId,
	selectedItemId: string | null
) {
	// Apply visibility filters
	if (!visibility.disabled && item.enabled === false) {
		return null
	} else if (item.status) {
		if (!visibility.ok && item.status.category === 'good') {
			return null
		} else if (!visibility.warning && item.status.category === 'warning') {
			return null
		} else if (!visibility.error && item.status.category === 'error') {
			return null
		}
	}

	return (
		<MyErrorBoundary>
			<ConnectionsTableRow connection={item} isSelected={selectedItemId === item.id} />
		</MyErrorBoundary>
	)
}

function CreateCollectionButton() {
	const createMutation = useMutationExt(trpc.instances.connections.collections.add.mutationOptions())

	const doCreateCollection = useCallback(() => {
		createMutation.mutateAsync({ collectionName: 'New Collection' }).catch((e) => {
			console.error('Failed to add collection', e)
		})
	}, [createMutation])

	return (
		<CButton color="info" size="sm" onClick={doCreateCollection}>
			<FontAwesomeIcon icon={faLayerGroup} /> Create Collection
		</CButton>
	)
}

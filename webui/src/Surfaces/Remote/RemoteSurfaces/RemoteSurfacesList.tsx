import { faLayerGroup, faPlug } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useNavigate } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useRef } from 'react'
import type { OutboundSurfaceCollection, OutboundSurfaceInfo } from '@companion-app/shared/Model/Surfaces.js'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import { Button, ButtonGroup } from '~/Components/Button'
import { CollectionsNestingTable } from '~/Components/CollectionsNestingTable/CollectionsNestingTable.js'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { SwitchInputField } from '~/Components/SwitchInputField.js'
import { PanelCollapseHelperProvider } from '~/Helpers/CollapseHelper.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { useComputed } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { AddRemoteSurfaceButton } from './AddRemoteSurfaceButton.js'
import { useRemoteSurfacesCollectionsApi } from './RemoteSurfacesCollectionsApi.js'
import { RemoteSurfacesListContextProvider } from './RemoteSurfacesListContext.js'
import { RemoteSurfaceTableRow } from './RemoteSurfaceTableRow.js'

interface RemoteSurfacesListProps {
	selectedRemoteConnectionId: string | null
}

export const RemoteSurfacesList = observer(function RemoteSurfacesList({
	selectedRemoteConnectionId,
}: RemoteSurfacesListProps) {
	const { surfaces } = useContext(RootAppStoreContext)

	const navigate = useNavigate({ from: '/surfaces/remote' })
	const doConfigureRemoteConnection = useCallback(
		(connectionId: string | null) => {
			if (!connectionId) {
				void navigate({ to: '/surfaces/remote' })
			} else {
				void navigate({ to: '/surfaces/remote/$connectionId', params: { connectionId } })
			}
		},
		[navigate]
	)

	const confirmModalRef = useRef<GenericConfirmModalRef>(null)

	const remoteSurfacesListApi = useRemoteSurfacesCollectionsApi(confirmModalRef)

	const allRemoteSurfaces = useComputed(
		() => Array.from(surfaces.outboundSurfaces.values()),
		[surfaces.outboundSurfaces]
	)

	const RemoteSurfaceItemRow = useCallback(
		(item: OutboundSurfaceInfo) => RemoteSurfacesListItemWrapper(item, selectedRemoteConnectionId),
		[selectedRemoteConnectionId]
	)

	return (
		<div className="connections-list-container flex-column-layout">
			<div className="connections-list-header fixed-header">
				<h4>Remote Surfaces</h4>

				<p style={{ marginBottom: '0.5rem' }}>
					The Stream Deck Studio and Network Dock support network connections. You can set up the connection from
					Companion here, or use the Discovered Surfaces tab.
					<br />
					This is not suitable for all remote surfaces such as Satellite, as that opens the connection to Companion
					itself.
				</p>

				<GenericConfirmModal ref={confirmModalRef} />

				<ButtonGroup className="connection-group-actions mb-2">
					<AddRemoteSurfaceButton />
					<Button
						color="warning"
						className="d-xl-none"
						onClick={() => void navigate({ to: '/surfaces/remote/discover' })}
					>
						<FontAwesomeIcon icon={faPlug} className="me-1" />
						Discover Remote Surfaces
					</Button>
					<CreateCollectionButton />
				</ButtonGroup>
			</div>

			<div className="connections-list-table-container scrollable-content">
				<PanelCollapseHelperProvider
					storageId="connection-collections"
					knownPanelIds={surfaces.allOutboundSurfaceCollectionIds}
					defaultCollapsed
				>
					<RemoteSurfacesListContextProvider
						deleteModalRef={confirmModalRef}
						configureRemoteConnection={doConfigureRemoteConnection}
					>
						<CollectionsNestingTable<OutboundSurfaceCollection, OutboundSurfaceInfo>
							NoContent={RemoteSurfacesListNoInstances}
							ItemRow={RemoteSurfaceItemRow}
							GroupHeaderContent={RemoteSurfacesGroupHeaderContent}
							itemName="Surface Remote Connection"
							dragId="surface-remote-connections"
							collectionsApi={remoteSurfacesListApi}
							collections={surfaces.outboundSurfaceRootCollections()}
							items={allRemoteSurfaces}
							selectedItemId={selectedRemoteConnectionId}
						/>
					</RemoteSurfacesListContextProvider>
				</PanelCollapseHelperProvider>
			</div>
		</div>
	)
})

function RemoteSurfacesListNoInstances() {
	return <NonIdealState icon={faPlug}>No remote surface connections are configured</NonIdealState>
}

function RemoteSurfacesGroupHeaderContent({ collection }: { collection: OutboundSurfaceCollection }) {
	const setEnabledMutation = useMutationExt(trpc.surfaces.outbound.collections.setEnabled.mutationOptions())

	const setEnabled = useCallback(
		(enabled: boolean) => {
			setEnabledMutation.mutateAsync({ collectionId: collection.id, enabled }).catch((e) => {
				console.error('Failed to set collection enabled state', stringifyError(e))
			})
		},
		[setEnabledMutation, collection.id]
	)

	return (
		<div className="ms-1">
			<SwitchInputField
				value={collection.metaData.enabled}
				setValue={setEnabled}
				tooltip={collection.metaData.enabled ? 'Disable collection' : 'Enable collection'}
			/>
		</div>
	)
}

function RemoteSurfacesListItemWrapper(item: OutboundSurfaceInfo, selectedItemId: string | null) {
	return (
		<MyErrorBoundary>
			<RemoteSurfaceTableRow remoteConnection={item} isSelected={selectedItemId === item.id} />
		</MyErrorBoundary>
	)
}

function CreateCollectionButton() {
	const createMutation = useMutationExt(trpc.surfaces.outbound.collections.add.mutationOptions())

	const doCreateCollection = useCallback(() => {
		createMutation.mutateAsync({ collectionName: 'New Collection' }).catch((e) => {
			console.error('Failed to add collection', e)
		})
	}, [createMutation])

	return (
		<Button color="info" size="sm" onClick={doCreateCollection}>
			<FontAwesomeIcon icon={faLayerGroup} /> Create Collection
		</Button>
	)
}

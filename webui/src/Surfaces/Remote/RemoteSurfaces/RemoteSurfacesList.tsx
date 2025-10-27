import React, { useCallback, useContext, useRef } from 'react'
import { CButton, CButtonGroup, CFormSwitch } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlug, faLayerGroup, faAdd } from '@fortawesome/free-solid-svg-icons'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { PanelCollapseHelperProvider } from '~/Helpers/CollapseHelper.js'
import { useRemoteSurfacesCollectionsApi } from './RemoteSurfacesCollectionsApi.js'
import { RemoteSurfacesListContextProvider } from './RemoteSurfacesListContext.js'
import { useComputed } from '~/Resources/util.js'
import { RemoteSurfaceTableRow } from './RemoteSurfaceTableRow.js'
import { useNavigate } from '@tanstack/react-router'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import type { SurfaceInstanceCollection } from '@companion-app/shared/Model/SurfaceInstance.js'
import type { OutboundSurfaceInfo } from '@companion-app/shared/Model/Surfaces.js'
import { CollectionsNestingTable } from '~/Components/CollectionsNestingTable/CollectionsNestingTable.js'
import { AddOutboundSurfaceModal, type AddOutboundSurfaceModalRef } from '~/Surfaces/Remote/AddOutboundSurfaceModal.js'

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

	const addModalRef = useRef<AddOutboundSurfaceModalRef>(null)

	const addSurface = useCallback(() => addModalRef?.current?.show(), [])

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

				<AddOutboundSurfaceModal ref={addModalRef} />

				<GenericConfirmModal ref={confirmModalRef} />

				<div className="connection-group-actions mb-2">
					<CButtonGroup size="sm">
						<CButton color="primary" onClick={addSurface}>
							<FontAwesomeIcon icon={faAdd} /> Add Remote Surface
						</CButton>
						<CButton
							color="info"
							className="d-xl-none"
							onClick={() => void navigate({ to: '/surfaces/remote/discover' })}
						>
							<FontAwesomeIcon icon={faPlug} className="me-1" />
							Discover Remote Surfaces
						</CButton>
						<CreateCollectionButton />
					</CButtonGroup>
				</div>
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
						<CollectionsNestingTable<SurfaceInstanceCollection, OutboundSurfaceInfo>
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

function RemoteSurfacesGroupHeaderContent({ collection }: { collection: SurfaceInstanceCollection }) {
	const setEnabledMutation = useMutationExt(trpc.surfaces.outbound.collections.setEnabled.mutationOptions())

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
		<CButton color="info" size="sm" onClick={doCreateCollection}>
			<FontAwesomeIcon icon={faLayerGroup} /> Create Collection
		</CButton>
	)
}

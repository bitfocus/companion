import React, { useCallback, useContext, useRef } from 'react'
import { CButton, CButtonGroup, CFormSwitch } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlug, faLayerGroup } from '@fortawesome/free-solid-svg-icons'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { useTableVisibilityHelper, VisibilityButton } from '~/Components/TableVisibility.js'
import { PanelCollapseHelperProvider } from '~/Helpers/CollapseHelper.js'
import { MissingVersionsWarning } from '~/Instances/MissingVersionsWarning.js'
import { useSurfaceInstanceCollectionsApi } from './SurfaceInstanceCollectionsApi.js'

import type { InstanceStatusEntry } from '@companion-app/shared/Model/InstanceStatus.js'
import { CollectionsNestingTable } from '~/Components/CollectionsNestingTable/CollectionsNestingTable.js'
import { SurfaceInstancesListContextProvider, useSurfaceInstancesListContext } from './SurfaceInstancesListContext.js'
import { useComputed } from '~/Resources/util.js'
import { SurfaceInstanceTableRow } from './SurfaceInstanceTableRow.js'
import { useNavigate } from '@tanstack/react-router'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import type {
	ClientSurfaceInstanceConfig,
	SurfaceInstanceCollection,
} from '@companion-app/shared/Model/SurfaceInstance.js'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import { stringifyError } from '@companion-app/shared/Stringify.js'

export interface VisibleSurfaceInstancesState {
	disabled: boolean
	ok: boolean
	warning: boolean
	error: boolean
}

interface SurfaceInstancesListProps {
	selectedInstanceId: string | null
}

export const SurfaceInstancesList = observer(function SurfaceInstancesList({
	selectedInstanceId,
}: SurfaceInstancesListProps) {
	const { surfaceInstances, instanceStatuses } = useContext(RootAppStoreContext)

	const navigate = useNavigate({ from: '/surfaces/integrations' })
	const doConfigureInstance = useCallback(
		(instanceId: string | null) => {
			if (!instanceId) {
				void navigate({ to: '/surfaces/integrations' })
			} else {
				void navigate({ to: '/surfaces/integrations/$instanceId', params: { instanceId } })
			}
		},
		[navigate]
	)

	const confirmModalRef = useRef<GenericConfirmModalRef>(null)

	const visibleInstances = useTableVisibilityHelper<VisibleSurfaceInstancesState>('surface_instances_visible', {
		disabled: true,
		ok: true,
		warning: true,
		error: true,
	})

	const surfaceInstanceListApi = useSurfaceInstanceCollectionsApi(confirmModalRef)

	const allSurfaceInstances = useComputed(() => {
		const allSurfaceInstances: ClientSurfaceInstanceConfigWithId[] = []

		for (const [instanceId, instance] of surfaceInstances.instances) {
			const status = instanceStatuses.getStatus(instanceId)
			allSurfaceInstances.push({ ...instance, id: instanceId, status })
		}

		return allSurfaceInstances
	}, [surfaceInstances.instances, instanceStatuses])

	const SurfaceInstanceItemRow = useCallback(
		(item: ClientSurfaceInstanceConfigWithId) =>
			SurfaceInstancesListItemWrapper(visibleInstances.visibility, item, selectedInstanceId),
		[visibleInstances.visibility, selectedInstanceId]
	)

	return (
		<div className="connections-list-container flex-column-layout">
			<div className="connections-list-header fixed-header">
				<h4>Surface Integrations</h4>

				<p>
					Similar to connections, surface integrations represent the ability to use different hardware or virtual
					surfaces to trigger buttons in Companion. Here you enable and configure the types of surfaces you want to use.
				</p>

				<MissingVersionsWarning moduleType={ModuleInstanceType.Surface} instances={surfaceInstances.instances} />

				<GenericConfirmModal ref={confirmModalRef} />

				<div className="connection-group-actions mb-2">
					<CButtonGroup>
						<CButton
							color="primary"
							size="sm"
							className="d-xl-none"
							onClick={() => void navigate({ to: '/surfaces/integrations/add' })}
						>
							<FontAwesomeIcon icon={faPlug} className="me-1" />
							Add Surface Integration
						</CButton>
						<CreateCollectionButton />
					</CButtonGroup>
				</div>
			</div>

			<div className="connections-list-table-container scrollable-content">
				<PanelCollapseHelperProvider
					storageId="connection-collections"
					knownPanelIds={surfaceInstances.allCollectionIds}
					defaultCollapsed
				>
					<SurfaceInstancesListContextProvider
						visibleInstances={visibleInstances}
						deleteModalRef={confirmModalRef}
						configureInstance={doConfigureInstance}
					>
						<CollectionsNestingTable<SurfaceInstanceCollection, ClientSurfaceInstanceConfigWithId>
							Heading={SurfaceInstancesListTableHeading}
							NoContent={SurfaceInstancesListNoInstances}
							ItemRow={SurfaceInstanceItemRow}
							GroupHeaderContent={SurfaceInstancesGroupHeaderContent}
							itemName="surface integration"
							dragId="surface-instance"
							collectionsApi={surfaceInstanceListApi}
							collections={surfaceInstances.rootCollections()}
							items={allSurfaceInstances}
							selectedItemId={selectedInstanceId}
						/>
					</SurfaceInstancesListContextProvider>
				</PanelCollapseHelperProvider>
			</div>
		</div>
	)
})

export interface ClientSurfaceInstanceConfigWithId extends ClientSurfaceInstanceConfig {
	id: string
	status: InstanceStatusEntry | undefined
}

function SurfaceInstancesListTableHeading() {
	const { visibleInstances } = useSurfaceInstancesListContext()

	return (
		<div className="flex flex-row">
			<div className="grow">Instance</div>
			<div className="no-break">
				<CButtonGroup className="table-header-buttons">
					<VisibilityButton {...visibleInstances} keyId="disabled" color="secondary" label="Disabled" />
					<VisibilityButton {...visibleInstances} keyId="ok" color="success" label="OK" />
					<VisibilityButton {...visibleInstances} keyId="warning" color="warning" label="Warning" />
					<VisibilityButton {...visibleInstances} keyId="error" color="danger" label="Error" />
				</CButtonGroup>
			</div>
		</div>
	)
}

function SurfaceInstancesListNoInstances() {
	return (
		<NonIdealState icon={faPlug}>
			You haven't set up any surfaces yet. <br />
			Try adding something from the list <span className="d-xl-none">below</span>
			<span className="d-none d-xl-inline">to the right</span>.
		</NonIdealState>
	)
}

function SurfaceInstancesGroupHeaderContent({ collection }: { collection: SurfaceInstanceCollection }) {
	const setEnabledMutation = useMutationExt(trpc.instances.surfaces.collections.setEnabled.mutationOptions())

	const setEnabled = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const enabled = e.target.checked

			setEnabledMutation.mutateAsync({ collectionId: collection.id, enabled }).catch((e) => {
				console.error('Failed to set collection enabled state', stringifyError(e))
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

function SurfaceInstancesListItemWrapper(
	visibility: VisibleSurfaceInstancesState,
	item: ClientSurfaceInstanceConfigWithId,
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
			<SurfaceInstanceTableRow instance={item} isSelected={selectedItemId === item.id} />
		</MyErrorBoundary>
	)
}

function CreateCollectionButton() {
	const createMutation = useMutationExt(trpc.instances.surfaces.collections.add.mutationOptions())

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

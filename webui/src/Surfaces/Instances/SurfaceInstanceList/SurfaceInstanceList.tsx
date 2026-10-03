import { faLayerGroup, faPlug } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useNavigate } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useMemo, useRef } from 'react'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import type { InstanceStatusEntry } from '@companion-app/shared/Model/InstanceStatus.js'
import type {
	ClientSurfaceInstanceConfig,
	SurfaceInstanceCollection,
} from '@companion-app/shared/Model/SurfaceInstance.js'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import { Button } from '~/Components/Button'
import { CollectionsNestingTable } from '~/Components/CollectionsNestingTable/CollectionsNestingTable.js'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { StatusFilterPill } from '~/Components/StatusFilterPill.js'
import { SwitchInputField } from '~/Components/SwitchInputField.js'
import { useTableVisibilityHelper } from '~/Components/TableVisibility.js'
import { PanelCollapseHelperProvider } from '~/Helpers/CollapseHelper.js'
import { MissingVersionsWarning } from '~/Instances/MissingVersionsWarning.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { useComputed } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { useSurfaceInstanceCollectionsApi } from './SurfaceInstanceCollectionsApi.js'
import { SurfaceInstancesListContextProvider, useSurfaceInstancesListContext } from './SurfaceInstancesListContext.js'
import { SurfaceInstanceTableRow } from './SurfaceInstanceTableRow.js'

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

	const navigate = useNavigate()

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

	const counts = useMemo(() => {
		const counts = { disabled: 0, ok: 0, warning: 0, error: 0 }

		for (const item of allSurfaceInstances) {
			counts[getSurfaceInstanceCategory(item)]++
		}

		return counts
	}, [allSurfaceInstances])

	const SurfaceInstanceItemRow = useCallback(
		(item: ClientSurfaceInstanceConfigWithId) =>
			SurfaceInstancesListItemWrapper(visibleInstances.visibility, item, selectedInstanceId),
		[visibleInstances.visibility, selectedInstanceId]
	)

	return (
		<div className="connections-list-container flex-column-layout h-full">
			<div className="fixed-header flex flex-col">
				<MissingVersionsWarning moduleType={ModuleInstanceType.Surface} instances={surfaceInstances.instances} />

				<GenericConfirmModal ref={confirmModalRef} />

				<div className="bg-surface-muted/50 border border-border/70 p-3 rounded-lg flex items-center justify-between gap-2 flex-wrap">
					<div className="flex flex-wrap items-center gap-2">
						<Button color="primary" size="sm" onClick={() => void navigate({ to: '/surfaces/integrations/add' })}>
							<FontAwesomeIcon icon={faPlug} className="me-1" />
							Add Surface Integration
						</Button>
						<CreateCollectionButton />
					</div>
				</div>
			</div>

			<div className="connections-list-table-container scrollable-content mt-2 list-card">
				<PanelCollapseHelperProvider
					storageId="connection-collections"
					knownPanelIds={surfaceInstances.allCollectionIds}
					defaultCollapsed
				>
					<SurfaceInstancesListContextProvider
						visibleInstances={visibleInstances}
						counts={counts}
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

/**
 * The single status category an instance belongs to, used both for the header counts and for the
 * visibility filtering, so that the two can never disagree.
 */
function getSurfaceInstanceCategory(item: ClientSurfaceInstanceConfigWithId): keyof VisibleSurfaceInstancesState {
	if (item.enabled === false) return 'disabled'

	switch (item.status?.category) {
		case 'warning':
			return 'warning'
		case 'error':
			return 'error'
		default:
			return 'ok'
	}
}

export interface ClientSurfaceInstanceConfigWithId extends ClientSurfaceInstanceConfig {
	id: string
	status: InstanceStatusEntry | undefined
}

function SurfaceInstancesListTableHeading() {
	const { visibleInstances, counts } = useSurfaceInstancesListContext()

	const totalCount = counts.disabled + counts.ok + counts.warning + counts.error
	const isAllActive =
		visibleInstances.visibility.disabled &&
		visibleInstances.visibility.ok &&
		visibleInstances.visibility.warning &&
		visibleInstances.visibility.error

	const toggleAll = useCallback(() => {
		const targetState = !isAllActive
		visibleInstances.toggleVisibility('disabled', targetState)
		visibleInstances.toggleVisibility('ok', targetState)
		visibleInstances.toggleVisibility('warning', targetState)
		visibleInstances.toggleVisibility('error', targetState)
	}, [isAllActive, visibleInstances])

	return (
		<div className="flex flex-wrap items-center justify-between gap-2">
			<div className="font-semibold">Surface Integrations</div>
			<div className="flex flex-wrap items-center gap-1.5">
				<StatusFilterPill
					label="All"
					count={totalCount}
					isActive={isAllActive}
					onClick={toggleAll}
					title="Show all status types"
				/>
				<StatusFilterPill
					label="OK"
					count={counts.ok}
					dotClass="bg-emerald-500"
					isActive={visibleInstances.visibility.ok}
					onClick={() => visibleInstances.toggleVisibility('ok')}
				/>
				<StatusFilterPill
					label="Warning"
					count={counts.warning}
					dotClass="bg-amber-500"
					isActive={visibleInstances.visibility.warning}
					onClick={() => visibleInstances.toggleVisibility('warning')}
				/>
				<StatusFilterPill
					label="Error"
					count={counts.error}
					dotClass="bg-rose-500"
					isActive={visibleInstances.visibility.error}
					onClick={() => visibleInstances.toggleVisibility('error')}
				/>
				<StatusFilterPill
					label="Disabled"
					count={counts.disabled}
					dotClass="bg-zinc-400"
					isActive={visibleInstances.visibility.disabled}
					onClick={() => visibleInstances.toggleVisibility('disabled')}
				/>
			</div>
		</div>
	)
}

function SurfaceInstancesListNoInstances() {
	return (
		<NonIdealState icon={faPlug}>
			You haven't set up any surface integrations yet. <br />
			Use &quot;Add Surface Integration&quot; above to get started.
		</NonIdealState>
	)
}

function SurfaceInstancesGroupHeaderContent({ collection }: { collection: SurfaceInstanceCollection }) {
	const setEnabledMutation = useMutationExt(trpc.instances.surfaces.collections.setEnabled.mutationOptions())

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
				id={undefined}
				value={collection.metaData.enabled}
				setValue={setEnabled}
				tooltip={collection.metaData.enabled ? 'Disable collection' : 'Enable collection'}
			/>
		</div>
	)
}

function SurfaceInstancesListItemWrapper(
	visibility: VisibleSurfaceInstancesState,
	item: ClientSurfaceInstanceConfigWithId,
	selectedItemId: string | null
) {
	// Apply visibility filters, using the same category the counts are derived from
	if (!visibility[getSurfaceInstanceCategory(item)]) {
		return null
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
		<Button color="secondary" size="sm" onClick={doCreateCollection}>
			<FontAwesomeIcon icon={faLayerGroup} className="me-1.5" /> Create Collection
		</Button>
	)
}

import { faFolderPlus, faPlug } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useNavigate } from '@tanstack/react-router'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ClientConnectionConfig, ConnectionCollection } from '@companion-app/shared/Model/Connections.js'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import type { InstanceStatusEntry } from '@companion-app/shared/Model/InstanceStatus.js'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import { Button } from '~/Components/Button.js'
import { CollectionsNestingTable } from '~/Components/CollectionsNestingTable/CollectionsNestingTable.js'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { SearchBox } from '~/Components/SearchBox.js'
import { StatusFilterPill } from '~/Components/StatusFilterPill.js'
import { SwitchInputField } from '~/Components/SwitchInputField.js'
import { useTableVisibilityHelper } from '~/Components/TableVisibility.js'
import { PanelCollapseHelperProvider } from '~/Helpers/CollapseHelper.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { useComputed } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { MissingVersionsWarning } from '../../Instances/MissingVersionsWarning.js'
import { ConnectionVariablesModal, type ConnectionVariablesModalRef } from '../ConnectionVariablesModal.js'
import { useConnectionCollectionsApi } from './ConnectionListApi.js'
import { ConnectionListContextProvider, useConnectionListFilterContext } from './ConnectionListContext.js'
import { ConnectionsTableRow } from './ConnectionsTableRow.js'

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
	const { connections, instanceStatuses, modules } = useContext(RootAppStoreContext)

	const navigate = useNavigate({ from: '/connections' })
	const doConfigureConnection = useCallback(
		(connectionId: string | null) => {
			if (!connectionId) {
				void navigate({ to: '/connections' })
			} else {
				void navigate({ to: `/connections/$connectionId`, params: { connectionId } })
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
			const status = instanceStatuses.getStatus(connectionId)
			allConnections.push({ ...connection, id: connectionId, status })
		}

		return allConnections
	}, [connections.connections, instanceStatuses])

	const [searchText, setSearchText] = useState('')

	const filteredConnections = useMemo(() => {
		const query = searchText.trim().toLowerCase()
		if (!query) return allConnections

		return allConnections.filter((item) => {
			const labelMatch = item.label?.toLowerCase().includes(query)
			const idMatch = item.id.toLowerCase().includes(query)
			const moduleInfo = modules.getModuleInfo(item.moduleType, item.moduleId)
			const brandMatch =
				moduleInfo?.display?.name?.toLowerCase().includes(query) || item.moduleId.toLowerCase().includes(query)
			return labelMatch || idMatch || brandMatch
		})
	}, [allConnections, searchText, modules])

	const counts = useMemo(() => {
		let disabled = 0
		let ok = 0
		let warning = 0
		let error = 0

		for (const item of allConnections) {
			if (item.enabled === false) {
				disabled++
			} else if (item.status?.category === 'good') {
				ok++
			} else if (item.status?.category === 'warning') {
				warning++
			} else if (item.status?.category === 'error') {
				error++
			} else {
				ok++
			}
		}

		return { disabled, ok, warning, error }
	}, [allConnections])

	const ConnectionsItemRow = useCallback(
		(item: ClientConnectionConfigWithId) =>
			ConnectionListItemWrapper(visibleConnections.visibility, item, selectedConnectionId),
		[visibleConnections.visibility, selectedConnectionId]
	)

	return (
		<div className="connections-list-container flex-column-layout">
			<div className="px-3">
				<MissingVersionsWarning moduleType={ModuleInstanceType.Connection} instances={connections.connections} />
				<GenericConfirmModal ref={confirmModalRef} />
				<ConnectionVariablesModal ref={variablesModalRef} />
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
						searchText={searchText}
						setSearchText={setSearchText}
						counts={counts}
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
							items={filteredConnections}
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
	const navigate = useNavigate()
	const { visibleConnections, searchText, setSearchText, counts } = useConnectionListFilterContext()

	const totalCount = counts.disabled + counts.ok + counts.warning + counts.error
	const isAllActive =
		visibleConnections.visibility.disabled &&
		visibleConnections.visibility.ok &&
		visibleConnections.visibility.warning &&
		visibleConnections.visibility.error

	const toggleAll = useCallback(() => {
		const targetState = !isAllActive
		visibleConnections.toggleVisibility('disabled', targetState)
		visibleConnections.toggleVisibility('ok', targetState)
		visibleConnections.toggleVisibility('warning', targetState)
		visibleConnections.toggleVisibility('error', targetState)
	}, [isAllActive, visibleConnections])

	return (
		<div className="flex flex-col gap-2.5 w-full py-1">
			<div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full">
				<SearchBox
					filter={searchText}
					setFilter={setSearchText}
					placeholder="Filter connections..."
					className="mb-0 flex-1 min-w-0 h-9"
				/>

				<div className="flex items-center gap-2 shrink-0">
					<CreateCollectionButton />
					<Button
						color="primary"
						className="h-9 inline-flex items-center justify-center"
						onClick={() => void navigate({ to: '/connections/add' })}
					>
						<FontAwesomeIcon icon={faPlug} className="me-1" />
						Add Connection
					</Button>
				</div>
			</div>

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
					isActive={visibleConnections.visibility.ok}
					onClick={() => visibleConnections.toggleVisibility('ok')}
				/>

				<StatusFilterPill
					label="Warning"
					count={counts.warning}
					dotClass="bg-amber-500"
					isActive={visibleConnections.visibility.warning}
					onClick={() => visibleConnections.toggleVisibility('warning')}
				/>

				<StatusFilterPill
					label="Error"
					count={counts.error}
					dotClass="bg-rose-500"
					isActive={visibleConnections.visibility.error}
					onClick={() => visibleConnections.toggleVisibility('error')}
				/>

				<StatusFilterPill
					label="Disabled"
					count={counts.disabled}
					dotClass="bg-zinc-400"
					isActive={visibleConnections.visibility.disabled}
					onClick={() => visibleConnections.toggleVisibility('disabled')}
				/>
			</div>
		</div>
	)
}

function ConnectionListNoConnections() {
	const { searchText } = useConnectionListFilterContext()

	if (searchText) {
		return <NonIdealState icon={faPlug}>No connections match your search query.</NonIdealState>
	}

	return (
		<NonIdealState icon={faPlug}>
			You haven't set up any connections yet. <br />
			Try adding something with the button above.
		</NonIdealState>
	)
}

function ConnectionGroupHeaderContent({ collection }: { collection: ConnectionCollection }) {
	const setEnabledMutation = useMutationExt(trpc.instances.connections.collections.setEnabled.mutationOptions())

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

export function CreateCollectionButton({ className }: { className?: string } = {}): React.JSX.Element {
	const createMutation = useMutationExt(trpc.instances.connections.collections.add.mutationOptions())

	const doCreateCollection = useCallback(() => {
		createMutation.mutateAsync({ collectionName: 'New Folder' }).catch((e) => {
			console.error('Failed to add collection', e)
		})
	}, [createMutation])

	return (
		<Button
			color="secondary"
			className={classNames('h-9 inline-flex items-center justify-center', className)}
			onClick={doCreateCollection}
			title="Create new folder to organize connections"
		>
			<FontAwesomeIcon icon={faFolderPlus} className="me-1" /> New Folder
		</Button>
	)
}

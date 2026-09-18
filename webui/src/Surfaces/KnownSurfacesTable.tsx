import { faCircleUp, faFolderOpen, faPowerOff, faSearch, faTrash } from '@fortawesome/free-solid-svg-icons'
import './surfaces.css'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useRef } from 'react'
import type { ClientDevicesListItem, ClientSurfaceItem } from '@companion-app/shared/Model/Surfaces.js'
import { Button, LinkButtonExternal } from '~/Components/Button'
import { CopyButton } from '~/Components/CopyButton'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { WindowLinkOpen } from '~/Helpers/Window.js'
import { trpc, useMutationExt } from '~/Resources/TRPC'
import { makeAbsolutePath } from '~/Resources/util'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

interface KnownSurfacesTableProps {
	selectedItemId: string | null
	selectItem: (itemId: string | null) => void
}

export const KnownSurfacesTable = observer(function KnownSurfacesTable({
	selectedItemId,
	selectItem,
}: KnownSurfacesTableProps) {
	const { surfaces } = useContext(RootAppStoreContext)

	const confirmRef = useRef<GenericConfirmModalRef>(null)

	const deleteEmulatorMutation = useMutationExt(trpc.surfaces.emulatorRemove.mutationOptions())
	const deleteEmulator = useCallback(
		(surfaceId: string) => {
			confirmRef?.current?.show('Remove Emulator', 'Are you sure?', 'Remove', () => {
				deleteEmulatorMutation.mutateAsync({ id: surfaceId }).catch((err) => {
					console.error('Emulator remove failed', err)
				})
			})
		},
		[deleteEmulatorMutation]
	)

	const deleteGroupMutation = useMutationExt(trpc.surfaces.groupRemove.mutationOptions())
	const deleteGroup = useCallback(
		(groupId: string) => {
			confirmRef?.current?.show('Remove Group', 'Are you sure?', 'Remove', () => {
				deleteGroupMutation.mutateAsync({ groupId }).catch((err) => {
					console.error('Group remove failed', err)
				})
			})
		},
		[deleteGroupMutation]
	)

	const forgetSurfaceMutation = useMutationExt(trpc.surfaces.surfaceForget.mutationOptions())
	const forgetSurface = useCallback(
		(surfaceId: string) => {
			confirmRef.current?.show(
				'Forget Surface',
				'Are you sure you want to forget this surface? Any settings will be lost',
				'Forget',
				() => {
					forgetSurfaceMutation.mutateAsync({ surfaceId }).catch((err) => {
						console.error('forget failed', err)
					})
				}
			)
		},
		[forgetSurfaceMutation]
	)

	const surfacesList = Array.from(surfaces.store.values()).sort((a, b) => {
		// 1) Those with an index should be first, sorted by index
		if (a.index !== null && b.index !== null) {
			return a.index - b.index
		}
		if (a.index !== null) return -1
		if (b.index !== null) return 1

		// 2) Those with a location but no index, sorted by id
		const aHasLocation = a.isAutoGroup && !!a.surfaces?.some((s) => s.location)
		const bHasLocation = b.isAutoGroup && !!b.surfaces?.some((s) => s.location)

		if (aHasLocation && bHasLocation) {
			return a.id.localeCompare(b.id)
		}
		if (aHasLocation) return -1
		if (bHasLocation) return 1

		// 3) Everything else, sorted by id
		return a.id.localeCompare(b.id)
	})

	return (
		<>
			<GenericConfirmModal ref={confirmRef} />

			<div className="scrollable-content surfaces-grid-container">
				<div className="grid-header-cell">Nr.</div>
				<div className="grid-header-cell">Configured Surfaces and Groups</div>
				<div className="grid-header-cell"></div>
				{surfacesList.map((group) => {
					if (group.isAutoGroup && (group.surfaces || []).length === 1) {
						return (
							<SurfaceRow
								key={group.id}
								surface={group.surfaces[0]}
								index={group.index}
								isInGroup={false}
								deleteEmulator={deleteEmulator}
								forgetSurface={forgetSurface}
								noBorder={false}
								isSelected={selectedItemId === group.surfaces[0].id}
								selectItem={selectItem}
							/>
						)
					} else {
						return (
							<ManualGroupRow
								key={group.id}
								group={group}
								deleteGroup={deleteGroup}
								deleteEmulator={deleteEmulator}
								forgetSurface={forgetSurface}
								isGroupSelected={selectedItemId === group.id}
								selectedItemId={selectedItemId}
								selectItem={selectItem}
							/>
						)
					}
				})}

				{surfacesList.length === 0 && (
					<div className="grid-no-results">
						<NonIdealState icon={faSearch} text="No surfaces found" />
					</div>
				)}
			</div>
		</>
	)
})

interface ManualGroupRowProps {
	group: ClientDevicesListItem
	deleteGroup: (groupId: string) => void
	deleteEmulator: (surfaceId: string) => void
	forgetSurface: (surfaceId: string) => void
	isGroupSelected: boolean
	selectedItemId: string | null
	selectItem: (itemId: string | null) => void
}
const ManualGroupRow = observer(function ManualGroupRow({
	group,
	deleteGroup,
	deleteEmulator,
	forgetSurface,
	isGroupSelected,
	selectedItemId,
	selectItem,
}: ManualGroupRowProps) {
	const deleteGroup2 = useCallback(() => deleteGroup(group.id), [deleteGroup, group.id])

	const handleGroupClick = useCallback(
		(e: React.MouseEvent) => {
			// Don't trigger row click if clicking on input field or buttons
			if ((e.target as HTMLElement).closest('input, button, a, [role="button"]')) {
				return
			}
			selectItem(group.id)
		},
		[selectItem, group.id]
	)

	const groupName = group.displayName || 'Surface Group'
	return (
		<>
			<div
				className={classNames('grid-row', { 'grid-row-selected': isGroupSelected })}
				onClick={handleGroupClick}
				title={`${groupName}${/group/i.test(groupName) ? '' : ' group'}: click to edit settings.`}
			>
				<div className="grid-cell">#{group.index}</div>
				<div className="grid-cell">
					<div className="surface-name-row">
						<b>{groupName}</b>
						<span className="surface-status surface-status-group">Group</span>
					</div>
					<div className="surface-id-row">
						<span className="surface-id" title={group.id}>
							{group.id}
						</span>
						<CopyButton size="sm" variant="ghost" title="Copy group id" text={group.id} />
					</div>
				</div>
				<div className="grid-cell surface-row-actions">
					<div className="surface-action-list">
						<Button onClick={deleteGroup2} size="sm" color="danger" variant="outline" title="Delete group">
							<FontAwesomeIcon icon={faTrash} className="me-1.5" />
							<span>Delete Group</span>
						</Button>
					</div>
				</div>
			</div>
			{(group.surfaces || []).map((surface, i, arr) => (
				<SurfaceRow
					key={surface.id}
					surface={surface}
					index={null}
					isInGroup={true}
					deleteEmulator={deleteEmulator}
					forgetSurface={forgetSurface}
					noBorder={i !== arr.length - 1} // No border on the last item
					isSelected={selectedItemId === surface.id}
					selectItem={selectItem}
				/>
			))}
		</>
	)
})

interface SurfaceRowProps {
	surface: ClientSurfaceItem
	index: number | null
	isInGroup: boolean
	deleteEmulator: (id: string) => void
	forgetSurface: (id: string) => void
	noBorder?: boolean
	isSelected: boolean
	selectItem: (id: string) => void
}

const SurfaceRow = observer(function SurfaceRow({
	surface,
	index,
	isInGroup,
	deleteEmulator,
	forgetSurface,
	noBorder,
	isSelected,
	selectItem,
}: SurfaceRowProps) {
	const deleteEmulator2 = useCallback(() => deleteEmulator(surface.id), [deleteEmulator, surface.id])
	const forgetSurface2 = useCallback(() => forgetSurface(surface.id), [forgetSurface, surface.id])

	const handleSurfaceClick = useCallback(
		(e: React.MouseEvent) => {
			// Don't trigger row click if clicking on input field or buttons
			if ((e.target as HTMLElement).closest('input, button')) {
				return
			}
			selectItem(surface.id)
		},
		[selectItem, surface.id]
	)

	const surfaceDisabled =
		!surface.enabled &&
		!surface.isConnected &&
		surface.integrationType !== 'emulator' &&
		surface.integrationType !== 'elgato-plugin' &&
		surface.integrationType !== 'satellite'

	return (
		<div
			className={classNames('grid-row', {
				'grid-row-no-border': noBorder,
				'grid-row-selected': isSelected,
				'surface-disabled': surfaceDisabled,
			})}
			onClick={handleSurfaceClick}
			title={`${surface.id}: click to edit surface settings.`}
		>
			<div className="grid-cell font-mono tabular-nums text-xs text-muted/70">
				{index !== null ? `#${index}` : ''}
				{/* Show disabled icon for surfaces that respect the enabled setting and are disabled */}
				{surfaceDisabled && (
					<span title="Disabled">
						<FontAwesomeIcon icon={faPowerOff} color="gray" aria-label="Disabled" />
					</span>
				)}
			</div>
			<div className={classNames('grid-cell', { 'ps-6': isInGroup })}>
				<div className="surface-name-row">
					<b className="text-sm font-semibold text-body-strong">
						{surface.name ? `${surface.name} - (${surface.type})` : surface.type}
					</b>
					<span
						className={classNames('surface-status', {
							'surface-status-disabled': surfaceDisabled,
							'surface-status-online': !surfaceDisabled && surface.isConnected,
							'surface-status-offline': !surfaceDisabled && !surface.isConnected,
						})}
					>
						{surfaceDisabled ? 'Disabled' : surface.isConnected ? surface.location || 'Local' : 'Offline'}
					</span>
					{!!surface.hasFirmwareUpdates && (
						<>
							{' '}
							<WindowLinkOpen href={surface.hasFirmwareUpdates.updaterDownloadUrl} title="Firmware update is available">
								<FontAwesomeIcon icon={faCircleUp} />
							</WindowLinkOpen>
						</>
					)}
				</div>
				<div className="surface-id-row">
					<span className="surface-id font-mono tabular-nums text-2xs text-muted">{surface.id}</span>
					<CopyButton size="sm" variant="ghost" title="Copy surface id" text={surface.id} />
				</div>
			</div>
			<div className="grid-cell surface-row-actions">
				{surface.isConnected ? (
					<div className="surface-action-list">
						{surface.integrationType === 'emulator' && (
							<>
								<LinkButtonExternal
									href={makeAbsolutePath(`/emulator/${surface.id.substring(9)}`)}
									title="Open Emulator"
									size="sm"
									variant="outline"
								>
									<FontAwesomeIcon icon={faFolderOpen} className="me-1.5" />
									<span>Open</span>
								</LinkButtonExternal>
								<Button onClick={deleteEmulator2} size="sm" color="danger" variant="outline" title="Delete Emulator">
									<FontAwesomeIcon icon={faTrash} className="me-1.5" />
									<span>Delete</span>
								</Button>
							</>
						)}
					</div>
				) : (
					<Button onClick={forgetSurface2} size="sm" color="danger" variant="outline" title="Forget surface">
						<FontAwesomeIcon icon={faTrash} className="me-1.5" />
						<span>Forget</span>
					</Button>
				)}
			</div>
		</div>
	)
})

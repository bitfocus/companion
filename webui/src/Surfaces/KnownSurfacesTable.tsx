import React, { useCallback, useContext, useRef } from 'react'
import { CButton, CButtonGroup } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleUp, faCopy, faFolderOpen, faPowerOff, faSearch, faTrash } from '@fortawesome/free-solid-svg-icons'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import classNames from 'classnames'
import type { ClientDevicesListItem, ClientSurfaceItem } from '@companion-app/shared/Model/Surfaces.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { WindowLinkOpen } from '~/Helpers/Window.js'
import CopyToClipboard from 'react-copy-to-clipboard'
import { makeAbsolutePath } from '~/Resources/util'
import { trpc, useMutationExt } from '~/Resources/TRPC'

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
				<div className="grid-header-cell">NO</div>
				<div className="grid-header-cell">Info</div>
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
	const { notifier } = useContext(RootAppStoreContext)

	const deleteGroup2 = useCallback(() => deleteGroup(group.id), [deleteGroup, group.id])

	const handleGroupClick = useCallback(
		(e: React.MouseEvent) => {
			// Don't trigger row click if clicking on input field or buttons
			if ((e.target as HTMLElement).closest('input, button')) {
				return
			}
			selectItem(group.id)
		},
		[selectItem, group.id]
	)

	return (
		<>
			<div className={classNames('grid-row', { 'grid-row-selected': isGroupSelected })} onClick={handleGroupClick}>
				<div className="grid-cell">#{group.index}</div>
				<div className="grid-cell">
					<b>{group.displayName || 'Surface Group'}</b>
					<div className="surface-id-row">
						<span className="surface-id" title={group.id}>
							{group.id}
						</span>
						<CopyToClipboard text={group.id} onCopy={() => notifier.show(`Copied`, 'Copied to clipboard', 5000)}>
							<CButton size="sm" title="Copy group id" className="p-0 px-1">
								<FontAwesomeIcon icon={faCopy} color="#000" />
							</CButton>
						</CopyToClipboard>
					</div>
				</div>
				<div className="grid-cell">
					<CButtonGroup>
						<CButton onClick={deleteGroup2} title="Delete group">
							<FontAwesomeIcon icon={faTrash} />
						</CButton>
					</CButtonGroup>
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
	deleteEmulator: (surfaceId: string) => void
	forgetSurface: (surfaceId: string) => void
	noBorder: boolean
	isSelected: boolean
	selectItem: (itemId: string | null) => void
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
	const { notifier } = useContext(RootAppStoreContext)

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
		>
			<div className="grid-cell">
				{index !== null ? `#${index}` : ''}
				{/* Show disabled icon for surfaces that respect the enabled setting and are disabled */}
				{surfaceDisabled && <FontAwesomeIcon icon={faPowerOff} color="gray" title="Disabled" />}
			</div>
			<div className={classNames('grid-cell', { 'ps-4': isInGroup })}>
				<div>
					<b>{surface.name ? `${surface.name} - (${surface.type})` : surface.type}</b>
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
					<span className="surface-id" title={surface.id}>
						{surface.id}
					</span>
					<CopyToClipboard text={surface.id} onCopy={() => notifier.show(`Copied`, 'Copied to clipboard', 5000)}>
						<CButton size="sm" title="Copy surface id" className="p-0 px-1">
							<FontAwesomeIcon icon={faCopy} color="#000" />
						</CButton>
					</CopyToClipboard>
					<span className={classNames('surface-status', { 'surface-disabled': surfaceDisabled })}>
						{surfaceDisabled ? 'Disabled' : surface.isConnected ? surface.location || 'Local' : 'Offline'}
					</span>
				</div>
			</div>
			<div className="grid-cell">
				{surface.isConnected ? (
					<CButtonGroup className="no-break">
						{surface.integrationType === 'emulator' && (
							<>
								<CButton
									href={makeAbsolutePath(`/emulator/${surface.id.substring(9)}`)}
									target="_blank"
									title="Open Emulator"
								>
									<FontAwesomeIcon icon={faFolderOpen} />
								</CButton>
								<CButton onClick={deleteEmulator2} title="Delete Emulator">
									<FontAwesomeIcon icon={faTrash} />
								</CButton>
							</>
						)}
					</CButtonGroup>
				) : (
					<CButton onClick={forgetSurface2} title="Forget">
						<FontAwesomeIcon icon={faTrash} />
					</CButton>
				)}
			</div>
		</div>
	)
})

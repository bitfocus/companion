import React, { useCallback, useContext, useRef } from 'react'
import { CButton, CButtonGroup } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleUp, faCopy, faFolderOpen, faSearch, faTrash } from '@fortawesome/free-solid-svg-icons'
import { GenericConfirmModal, GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import classNames from 'classnames'
import { ClientDevicesListItem, ClientSurfaceItem } from '@companion-app/shared/Model/Surfaces.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { WindowLinkOpen } from '~/Helpers/Window.js'
import CopyToClipboard from 'react-copy-to-clipboard'

interface KnownSurfacesTableProps {
	selectedItemId: string | null
	selectItem: (itemId: string | null) => void
}

export const KnownSurfacesTable = observer(function KnownSurfacesTable({
	selectedItemId,
	selectItem,
}: KnownSurfacesTableProps) {
	const { surfaces, socket } = useContext(RootAppStoreContext)

	const confirmRef = useRef<GenericConfirmModalRef>(null)

	const deleteEmulator = useCallback(
		(surfaceId: string) => {
			confirmRef?.current?.show('Remove Emulator', 'Are you sure?', 'Remove', () => {
				socket.emitPromise('surfaces:emulator-remove', [surfaceId]).catch((err) => {
					console.error('Emulator remove failed', err)
				})
			})
		},
		[socket]
	)

	const deleteGroup = useCallback(
		(groupId: string) => {
			confirmRef?.current?.show('Remove Group', 'Are you sure?', 'Remove', () => {
				socket.emitPromise('surfaces:group-remove', [groupId]).catch((err) => {
					console.error('Group remove failed', err)
				})
			})
		},
		[socket]
	)

	const forgetSurface = useCallback(
		(surfaceId: string) => {
			confirmRef.current?.show(
				'Forget Surface',
				'Are you sure you want to forget this surface? Any settings will be lost',
				'Forget',
				() => {
					socket.emitPromise('surfaces:forget', [surfaceId]).catch((err) => {
						console.error('fotget failed', err)
					})
				}
			)
		},
		[socket]
	)

	const surfacesList = Array.from(surfaces.store.values()).sort((a, b) => {
		if (a.index === undefined && b.index === undefined) {
			return a.id.localeCompare(b.id)
		} else {
			return (a.index ?? Number.POSITIVE_INFINITY) - (b.index ?? Number.POSITIVE_INFINITY)
		}
	})

	return (
		<>
			<GenericConfirmModal ref={confirmRef} />

			<div className="surfaces-grid-container">
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
function ManualGroupRow({
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
						<CopyToClipboard
							text={group.id}
							onCopy={() => notifier.current?.show(`Copied`, 'Copied to clipboard', 5000)}
						>
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
					index={undefined}
					deleteEmulator={deleteEmulator}
					forgetSurface={forgetSurface}
					noBorder={i !== arr.length - 1} // No border on the last item
					isSelected={selectedItemId === surface.id}
					selectItem={selectItem}
				/>
			))}
		</>
	)
}

interface SurfaceRowProps {
	surface: ClientSurfaceItem
	index: number | undefined
	deleteEmulator: (surfaceId: string) => void
	forgetSurface: (surfaceId: string) => void
	noBorder: boolean
	isSelected: boolean
	selectItem: (itemId: string | null) => void
}

const SurfaceRow = observer(function SurfaceRow({
	surface,
	index,
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

	return (
		<div
			className={classNames('grid-row', {
				'grid-row-no-border': noBorder,
				'grid-row-selected': isSelected,
			})}
			onClick={handleSurfaceClick}
		>
			<div className="grid-cell">{index !== undefined ? `#${index}` : ''}</div>
			<div className="grid-cell" style={{ paddingLeft: index === undefined ? '2em' : 'default' }}>
				<b>{surface.name ? `${surface.name} - (${surface.type})` : surface.type}</b>
				{!!surface.hasFirmwareUpdates && (
					<>
						{' '}
						<WindowLinkOpen href={surface.hasFirmwareUpdates.updaterDownloadUrl}>
							<FontAwesomeIcon icon={faCircleUp} title="Firmware update is available" />
						</WindowLinkOpen>
					</>
				)}
				<div className="surface-id-row">
					<span className="surface-id" title={surface.id}>
						{surface.id}
					</span>
					<CopyToClipboard
						text={surface.id}
						onCopy={() => notifier.current?.show(`Copied`, 'Copied to clipboard', 5000)}
					>
						<CButton size="sm" title="Copy surface id" className="p-0 px-1">
							<FontAwesomeIcon icon={faCopy} color="#000" />
						</CButton>
					</CopyToClipboard>
					<span className="surface-location">{surface.isConnected ? surface.location || 'Local' : 'Offline'}</span>
				</div>
			</div>
			<div className="grid-cell">
				{surface.isConnected ? (
					<CButtonGroup className="no-break">
						{surface.integrationType === 'emulator' && (
							<>
								<CButton href={`/emulator/${surface.id.substring(9)}`} target="_blank" title="Open Emulator">
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

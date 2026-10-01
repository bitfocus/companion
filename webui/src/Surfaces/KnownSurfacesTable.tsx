import {
	faArrowUpRightFromSquare,
	faBars,
	faCircleUp,
	faCopy,
	faLayerGroup,
	faSearch,
	faTrash,
} from '@fortawesome/free-solid-svg-icons'
import './surfaces.css'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import copy from 'copy-to-clipboard'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useRef } from 'react'
import type { ClientDevicesListItem, ClientSurfaceItem } from '@companion-app/shared/Model/Surfaces.js'
import { Badge } from '~/Components/Badge.js'
import { LinkButtonExternal } from '~/Components/Button'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { Popover } from '~/Components/Popover'
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

			<div className="surfaces-list">
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

				{surfacesList.length === 0 && <NonIdealState icon={faSearch} text="No surfaces found" />}
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
	const surfaceCount = (group.surfaces || []).length
	return (
		<div className="surface-group">
			<div
				className={classNames('surface-row surface-group-row', { 'list-row-selected': isGroupSelected })}
				onClick={handleGroupClick}
				title={`${groupName}${/group/i.test(groupName) ? '' : ' group'}: click to edit settings.`}
			>
				<span className="surface-row-index">{group.index !== null ? `#${group.index}` : ''}</span>
				<div className="surface-row-text">
					<span className="surface-row-name">
						<FontAwesomeIcon icon={faLayerGroup} className="surface-group-icon" />
						{groupName}
					</span>
					<span className="surface-row-subtitle">
						{surfaceCount} {surfaceCount === 1 ? 'surface' : 'surfaces'} · {group.id}
					</span>
				</div>
				<SurfaceRowMenu copyId={group.id} copyLabel="Copy group ID">
					<Popover.Item onClick={deleteGroup2} title="Delete group" className="surface-row-menu-danger">
						<FontAwesomeIcon icon={faTrash} className="me-2" />
						Delete group
					</Popover.Item>
				</SurfaceRowMenu>
			</div>
			{(group.surfaces || []).map((surface) => (
				<SurfaceRow
					key={surface.id}
					surface={surface}
					index={null}
					isInGroup={true}
					deleteEmulator={deleteEmulator}
					forgetSurface={forgetSurface}
					isSelected={selectedItemId === surface.id}
					selectItem={selectItem}
				/>
			))}
		</div>
	)
})

interface SurfaceRowProps {
	surface: ClientSurfaceItem
	index: number | null
	isInGroup: boolean
	deleteEmulator: (id: string) => void
	forgetSurface: (id: string) => void
	isSelected: boolean
	selectItem: (id: string) => void
}

const SurfaceRow = observer(function SurfaceRow({
	surface,
	index,
	isInGroup,
	deleteEmulator,
	forgetSurface,
	isSelected,
	selectItem,
}: SurfaceRowProps) {
	const deleteEmulator2 = useCallback(() => deleteEmulator(surface.id), [deleteEmulator, surface.id])
	const forgetSurface2 = useCallback(() => forgetSurface(surface.id), [forgetSurface, surface.id])

	const handleSurfaceClick = useCallback(
		(e: React.MouseEvent) => {
			// Don't trigger row click if clicking on input field or buttons
			if ((e.target as HTMLElement).closest('input, button, a, [role="button"]')) {
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

	const subtitle = [
		surface.name ? surface.type : null,
		surface.isConnected && !surfaceDisabled ? surface.location || 'Local' : null,
		surface.id,
	]
		.filter((part) => !!part)
		.join(' · ')

	return (
		<div
			className={classNames('surface-row', {
				'surface-row-nested': isInGroup,
				'list-row-selected': isSelected,
				'surface-row-disabled': surfaceDisabled,
			})}
			onClick={handleSurfaceClick}
			title={`${surface.id}: click to edit surface settings.`}
		>
			<span className="surface-row-index">{index !== null ? `#${index}` : ''}</span>
			<div className="surface-row-text">
				<span className="surface-row-name">{surface.name || surface.type}</span>
				<span className="surface-row-subtitle" title={subtitle}>
					{subtitle}
				</span>
			</div>

			{!!surface.hasFirmwareUpdates && (
				<WindowLinkOpen
					href={surface.hasFirmwareUpdates.updaterDownloadUrl}
					title="Firmware update is available"
					className="surface-row-firmware"
				>
					<FontAwesomeIcon icon={faCircleUp} />
				</WindowLinkOpen>
			)}

			{surface.isConnected && surface.integrationType === 'emulator' && (
				<LinkButtonExternal
					href={makeAbsolutePath(`/emulator/${surface.id.substring(9)}`)}
					title="Open Emulator"
					size="sm"
					variant="ghost"
				>
					<FontAwesomeIcon icon={faArrowUpRightFromSquare} />
				</LinkButtonExternal>
			)}

			<SurfaceStatusBadge isConnected={surface.isConnected} isDisabled={surfaceDisabled} />

			<SurfaceRowMenu copyId={surface.id} copyLabel="Copy surface ID">
				{surface.isConnected ? (
					surface.integrationType === 'emulator' && (
						<Popover.Item onClick={deleteEmulator2} title="Delete emulator" className="surface-row-menu-danger">
							<FontAwesomeIcon icon={faTrash} className="me-2" />
							Delete emulator
						</Popover.Item>
					)
				) : (
					<Popover.Item onClick={forgetSurface2} title="Forget surface" className="surface-row-menu-danger">
						<FontAwesomeIcon icon={faTrash} className="me-2" />
						Forget surface
					</Popover.Item>
				)}
			</SurfaceRowMenu>
		</div>
	)
})

interface SurfaceStatusBadgeProps {
	isConnected: boolean
	isDisabled: boolean
}

function SurfaceStatusBadge({ isConnected, isDisabled }: SurfaceStatusBadgeProps) {
	if (isDisabled) return <Badge tone="disabled">Disabled</Badge>
	if (!isConnected) return <Badge tone="neutral">Offline</Badge>
	return <Badge tone="good">Connected</Badge>
}

interface SurfaceRowMenuProps {
	copyId: string
	copyLabel: string
	children: React.ReactNode
}

/** The row's `⋯` menu, matching the connection/integration rows: copy the id, then any destructive actions. */
function SurfaceRowMenu({ copyId, copyLabel, children }: SurfaceRowMenuProps) {
	const doCopy = useCallback(() => {
		copy(copyId).catch(() => {
			console.error('Failed to copy text:', copyId)
		})
	}, [copyId])

	return (
		<Popover.Root>
			<Popover.Trigger
				color={null}
				className="surface-row-menu-trigger"
				title="Click for additional options."
				aria-label="Click for additional options."
			>
				<FontAwesomeIcon icon={faBars} />
			</Popover.Trigger>
			<Popover.Popup arrow side="right" align="center">
				<Popover.Item onClick={doCopy} title={copyLabel}>
					<FontAwesomeIcon icon={faCopy} className="me-2 opacity-70" />
					{copyLabel}
				</Popover.Item>
				{children}
			</Popover.Popup>
		</Popover.Root>
	)
}

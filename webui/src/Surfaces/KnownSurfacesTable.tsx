import React, { useCallback, useContext, useRef } from 'react'
import { CButton, CButtonGroup } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleUp, faCog, faFolderOpen, faSearch, faTrash } from '@fortawesome/free-solid-svg-icons'
import { TextInputField } from '../Components/TextInputField.js'
import { GenericConfirmModal, GenericConfirmModalRef } from '../Components/GenericConfirmModal.js'
import { SurfaceEditModal, SurfaceEditModalRef } from './EditModal.js'
import classNames from 'classnames'
import { ClientDevicesListItem, ClientSurfaceItem } from '@companion-app/shared/Model/Surfaces.js'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { NonIdealState } from '../Components/NonIdealState.js'
import { WindowLinkOpen } from '../Helpers/Window.js'

export const KnownSurfacesTable = observer(function KnownSurfacesTable() {
	const { surfaces, socket } = useContext(RootAppStoreContext)

	const editModalRef = useRef<SurfaceEditModalRef>(null)
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

	const configureSurface = useCallback((surfaceId: string) => {
		editModalRef.current?.show(surfaceId, null)
	}, [])

	const configureGroup = useCallback((groupId: string) => {
		editModalRef.current?.show(null, groupId)
	}, [])

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

	const updateName = useCallback(
		(surfaceId: string, name: string) => {
			socket.emitPromise('surfaces:set-name', [surfaceId, name]).catch((err) => {
				console.error('Update name failed', err)
			})
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
			<SurfaceEditModal ref={editModalRef} />
			<GenericConfirmModal ref={confirmRef} />

			<table className="table table-responsive-sm table-margin-top">
				<thead>
					<tr>
						<th>NO</th>
						<th>ID</th>
						<th>Name</th>
						<th>Type</th>
						<th>Location</th>
						<th>&nbsp;</th>
					</tr>
				</thead>
				<tbody>
					{surfacesList.map((group) => {
						if (group.isAutoGroup && (group.surfaces || []).length === 1) {
							return (
								<SurfaceRow
									key={group.id}
									surface={group.surfaces[0]}
									index={group.index}
									updateName={updateName}
									configureSurface={configureSurface}
									deleteEmulator={deleteEmulator}
									forgetSurface={forgetSurface}
									noBorder={false}
								/>
							)
						} else {
							return (
								<ManualGroupRow
									key={group.id}
									group={group}
									configureGroup={configureGroup}
									deleteGroup={deleteGroup}
									updateName={updateName}
									configureSurface={configureSurface}
									deleteEmulator={deleteEmulator}
									forgetSurface={forgetSurface}
								/>
							)
						}
					})}

					{surfacesList.length === 0 && (
						<tr>
							<td colSpan={7}>
								<NonIdealState icon={faSearch} text="No surfaces found" />
							</td>
						</tr>
					)}
				</tbody>
			</table>
		</>
	)
})

interface ManualGroupRowProps {
	group: ClientDevicesListItem
	configureGroup: (groupId: string) => void
	deleteGroup: (groupId: string) => void
	updateName: (surfaceId: string, name: string) => void
	configureSurface: (surfaceId: string) => void
	deleteEmulator: (surfaceId: string) => void
	forgetSurface: (surfaceId: string) => void
}
function ManualGroupRow({
	group,
	configureGroup,
	deleteGroup,
	updateName,
	configureSurface,
	deleteEmulator,
	forgetSurface,
}: ManualGroupRowProps) {
	const configureGroup2 = useCallback(() => configureGroup(group.id), [configureGroup, group.id])
	const deleteGroup2 = useCallback(() => deleteGroup(group.id), [deleteGroup, group.id])
	const updateName2 = useCallback((val: string) => updateName(group.id, val), [updateName, group.id])

	return (
		<>
			<tr>
				<td>#{group.index}</td>
				<td>{group.id}</td>
				<td>
					<TextInputField value={group.displayName} setValue={updateName2} />
				</td>
				<td>Group</td>
				<td>-</td>
				<td className="text-right">
					<CButtonGroup>
						<CButton onClick={configureGroup2} title="Configure">
							<FontAwesomeIcon icon={faCog} /> Settings
						</CButton>

						<CButton onClick={deleteGroup2} title="Delete group">
							<FontAwesomeIcon icon={faTrash} /> Delete
						</CButton>
					</CButtonGroup>
				</td>
			</tr>
			{(group.surfaces || []).map((surface) => (
				<SurfaceRow
					key={surface.id}
					surface={surface}
					index={undefined}
					updateName={updateName}
					configureSurface={configureSurface}
					deleteEmulator={deleteEmulator}
					forgetSurface={forgetSurface}
					noBorder
				/>
			))}
		</>
	)
}

interface SurfaceRowProps {
	surface: ClientSurfaceItem
	index: number | undefined
	updateName: (surfaceId: string, name: string) => void
	configureSurface: (surfaceId: string) => void
	deleteEmulator: (surfaceId: string) => void
	forgetSurface: (surfaceId: string) => void
	noBorder: boolean
}

const SurfaceRow = observer(function SurfaceRow({
	surface,
	index,
	updateName,
	configureSurface,
	deleteEmulator,
	forgetSurface,
	noBorder,
}: SurfaceRowProps) {
	const updateName2 = useCallback((val: string) => updateName(surface.id, val), [updateName, surface.id])
	const configureSurface2 = useCallback(() => configureSurface(surface.id), [configureSurface, surface.id])
	const deleteEmulator2 = useCallback(() => deleteEmulator(surface.id), [deleteEmulator, surface.id])
	const forgetSurface2 = useCallback(() => forgetSurface(surface.id), [forgetSurface, surface.id])

	return (
		<tr
			className={classNames({
				noBorder,
			})}
		>
			<td>{index !== undefined ? `#${index}` : ''}</td>
			<td>{surface.id}</td>
			<td>
				<TextInputField value={surface.name} setValue={updateName2} />
			</td>
			<td>
				{surface.type}
				{!!surface.hasFirmwareUpdates && (
					<>
						{' '}
						<WindowLinkOpen href={surface.hasFirmwareUpdates.updaterDownloadUrl}>
							<FontAwesomeIcon icon={faCircleUp} title="Firmware update is available" />
						</WindowLinkOpen>
					</>
				)}
			</td>
			<td>{surface.isConnected ? surface.location || 'Local' : 'Offline'}</td>
			<td className="text-right">
				{surface.isConnected ? (
					<CButtonGroup>
						<CButton onClick={configureSurface2} title="Configure">
							<FontAwesomeIcon icon={faCog} /> Settings
						</CButton>

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
					<CButton onClick={forgetSurface2}>
						<FontAwesomeIcon icon={faTrash} /> Forget
					</CButton>
				)}
			</td>
		</tr>
	)
})

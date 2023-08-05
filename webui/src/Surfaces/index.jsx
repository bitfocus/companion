import React, { memo, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { CAlert, CButton, CButtonGroup } from '@coreui/react'
import { SurfacesContext, socketEmitPromise, SocketContext } from '../util'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faAdd, faCog, faFolderOpen, faSync, faTrash } from '@fortawesome/free-solid-svg-icons'
import { TextInputField } from '../Components/TextInputField'
import { GenericConfirmModal } from '../Components/GenericConfirmModal'
import { SurfaceEditModal } from './EditModal'
import { AddSurfaceGroupModal } from './AddGroupModal'

export const SurfacesPage = memo(function SurfacesPage() {
	const socket = useContext(SocketContext)
	const surfacesContext = useContext(SurfacesContext)

	const confirmRef = useRef(null)

	const editModalRef = useRef(null)
	const addGroupModalRef = useRef(null)
	const confirmModalRef = useRef(null)

	const [scanning, setScanning] = useState(false)
	const [scanError, setScanError] = useState(null)

	const refreshUSB = useCallback(() => {
		setScanning(true)
		setScanError(null)

		socketEmitPromise(socket, 'surfaces:rescan', [], 30000)
			.then((errorMsg) => {
				setScanError(errorMsg || null)
				setScanning(false)
			})
			.catch((err) => {
				console.error('Refresh USB failed', err)

				setScanning(false)
			})
	}, [socket])

	const addEmulator = useCallback(() => {
		socketEmitPromise(socket, 'surfaces:emulator-add', []).catch((err) => {
			console.error('Emulator add failed', err)
		})
	}, [socket])

	const deleteEmulator = useCallback(
		(deviceId) => {
			confirmRef?.current?.show('Remove Emulator', 'Are you sure?', 'Remove', () => {
				socketEmitPromise(socket, 'surfaces:emulator-remove', [deviceId]).catch((err) => {
					console.error('Emulator remove failed', err)
				})
			})
		},
		[socket]
	)

	const addGroup = useCallback(() => {
		addGroupModalRef.current.show()
	}, [socket])

	const deleteGroup = useCallback(
		(groupId) => {
			confirmRef?.current?.show('Remove Group', 'Are you sure?', 'Remove', () => {
				socketEmitPromise(socket, 'surfaces:group-remove', [groupId]).catch((err) => {
					console.error('Group remove failed', err)
				})
			})
		},
		[socket]
	)

	const configureDevice = useCallback((surfaceId) => {
		editModalRef.current.show(surfaceId)
	}, [])

	const forgetDevice = useCallback(
		(deviceId) => {
			confirmModalRef.current.show(
				'Forget Surface',
				'Are you sure you want to forget this surface? Any settings will be lost',
				'Forget',
				() => {
					socketEmitPromise(socket, 'surfaces:forget', [deviceId]).catch((err) => {
						console.error('fotget failed', err)
					})
				}
			)
		},
		[socket]
	)

	const updateName = useCallback(
		(deviceId, name) => {
			socketEmitPromise(socket, 'surfaces:set-name', [deviceId, name]).catch((err) => {
				console.error('Update name failed', err)
			})
		},
		[socket]
	)

	return (
		<div>
			<GenericConfirmModal ref={confirmRef} />

			<h4>Surfaces</h4>
			<p>
				These are the surfaces currently connected to companion. If your streamdeck is missing from this list, you might
				need to close the Elgato Streamdeck application and click the Rescan button below.
			</p>

			<CAlert color="info">
				Did you know, you can connect a Streamdeck from another computer or Raspberry Pi with{' '}
				<a target="_blank" rel="noreferrer" href="https://bitfocus.io/companion-satellite">
					Companion Satellite
				</a>
				?
			</CAlert>

			<CAlert color="warning" role="alert" style={{ display: scanError ? '' : 'none' }}>
				{scanError}
			</CAlert>

			<CButtonGroup>
				<CButton color="warning" onClick={refreshUSB}>
					<FontAwesomeIcon icon={faSync} spin={scanning} />
					{scanning ? ' Checking for new devices...' : ' Rescan USB'}
				</CButton>
				<CButton color="danger" onClick={addEmulator}>
					<FontAwesomeIcon icon={faAdd} /> Add Emulator
				</CButton>
				<CButton color="warning" onClick={addGroup}>
					<FontAwesomeIcon icon={faAdd} /> Add Group
				</CButton>
			</CButtonGroup>

			<SurfaceEditModal ref={editModalRef} />
			<AddSurfaceGroupModal ref={addGroupModalRef} />
			<GenericConfirmModal ref={confirmModalRef} />

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
					{surfacesContext.map((group) =>
						group.isAutoGroup && (group.surfaces || []).length === 1 ? (
							<SurfaceRow
								key={group.id}
								surface={group.surfaces[0]}
								index={group.index}
								updateName={updateName}
								configureDevice={configureDevice}
								deleteEmulator={deleteEmulator}
								forgetDevice={forgetDevice}
							/>
						) : (
							<ManualGroupRow
								key={group.id}
								group={group}
								deleteGroup={deleteGroup}
								updateName={updateName}
								configureDevice={configureDevice}
								deleteEmulator={deleteEmulator}
								forgetDevice={forgetDevice}
							/>
						)
					)}

					{surfacesContext.length === 0 && (
						<tr>
							<td colSpan={7}>No control surfaces have been detected</td>
						</tr>
					)}
				</tbody>
			</table>
		</div>
	)
})

function ManualGroupRow({ group, deleteGroup, updateName, configureDevice, deleteEmulator, forgetDevice }) {
	const deleteGroup2 = useCallback(() => deleteGroup(group.id), [deleteGroup, group.id])
	const updateName2 = useCallback((val) => updateName(group.id, val), [updateName, group.id])

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
						<CButton onClick={deleteGroup2} title="Delete group">
							<FontAwesomeIcon icon={faTrash} />
						</CButton>
					</CButtonGroup>
				</td>
			</tr>
			{(group.surfaces || []).map((surface) => (
				<SurfaceRow
					key={surface.id}
					surface={surface}
					updateName={updateName}
					configureDevice={configureDevice}
					deleteEmulator={deleteEmulator}
					forgetDevice={forgetDevice}
				/>
			))}
		</>
	)
}

function SurfaceRow({ surface, index, updateName, configureDevice, deleteEmulator, forgetDevice }) {
	const updateName2 = useCallback((val) => updateName(surface.id, val), [updateName, surface.id])
	const configureDevice2 = useCallback(() => configureDevice(surface.id), [configureDevice, surface.id])
	const deleteEmulator2 = useCallback(() => deleteEmulator(surface.id), [deleteEmulator, surface.id])
	const forgetDevice2 = useCallback(() => forgetDevice(surface.id), [forgetDevice, surface.id])

	return (
		<tr>
			<td>{index !== undefined ? `#${index}` : ''}</td>
			<td>{surface.id}</td>
			<td>
				<TextInputField value={surface.name} setValue={updateName2} />
			</td>
			<td>{surface.type}</td>
			<td>{surface.isConnected ? surface.location || 'Local' : 'Offline'}</td>
			<td className="text-right">
				{surface.isConnected ? (
					<CButtonGroup>
						<CButton onClick={configureDevice2} title="Configure">
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
					<CButton onClick={forgetDevice2}>
						<FontAwesomeIcon icon={faTrash} /> Forget
					</CButton>
				)}
			</td>
		</tr>
	)
}

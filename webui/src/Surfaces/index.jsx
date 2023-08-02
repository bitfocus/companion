import React, { memo, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { CAlert, CButton, CButtonGroup } from '@coreui/react'
import { SurfacesContext, socketEmitPromise, SocketContext } from '../util'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faAdd, faCog, faFolderOpen, faSync, faTrash } from '@fortawesome/free-solid-svg-icons'
import { TextInputField } from '../Components/TextInputField'
import { useMemo } from 'react'
import { GenericConfirmModal } from '../Components/GenericConfirmModal'
import { SurfaceEditModal } from './EditModal'

export const SurfacesPage = memo(function SurfacesPage() {
	const socket = useContext(SocketContext)
	const devices = useContext(SurfacesContext)

	const confirmRef = useRef(null)

	const devicesList = useMemo(() => {
		const ary = Object.values(devices.available)

		ary.sort((a, b) => {
			if (a.index !== b.index) {
				return a.index - b.index
			}

			// fallback to serial
			return a.id.localeCompare(b.id)
		})

		return ary
	}, [devices.available])
	const offlineDevicesList = useMemo(() => {
		const ary = Object.values(devices.offline)

		ary.sort((a, b) => {
			if (a.index !== b.index) {
				return a.index - b.index
			}

			// fallback to serial
			return a.id.localeCompare(b.id)
		})

		return ary
	}, [devices.offline])

	const editModalRef = useRef()
	const confirmModalRef = useRef(null)

	const [scanning, setScanning] = useState(false)
	const [scanError, setScanError] = useState(null)

	useEffect(() => {
		// If device disappears, hide the edit modal
		if (editModalRef.current) {
			editModalRef.current.ensureIdIsValid(Object.keys(devices))
		}
	}, [devices])

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

	const configureDevice = useCallback((device) => {
		editModalRef.current.show(device)
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
			</CButtonGroup>

			<p>&nbsp;</p>

			<SurfaceEditModal ref={editModalRef} />
			<GenericConfirmModal ref={confirmModalRef} />

			<h5>Connected</h5>

			<table className="table table-responsive-sm">
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
					{devicesList.map((dev) => (
						<AvailableDeviceRow
							key={dev.id}
							device={dev}
							updateName={updateName}
							configureDevice={configureDevice}
							deleteEmulator={deleteEmulator}
						/>
					))}

					{devicesList.length === 0 && (
						<tr>
							<td colSpan={4}>No control surfaces have been detected</td>
						</tr>
					)}
				</tbody>
			</table>

			<h5>Disconnected</h5>

			<table className="table table-responsive-sm">
				<thead>
					<tr>
						<th>ID</th>
						<th>Name</th>
						<th>Type</th>
						<th>&nbsp;</th>
					</tr>
				</thead>
				<tbody>
					{offlineDevicesList.map((dev) => (
						<OfflineDeviceRow key={dev.id} device={dev} updateName={updateName} forgetDevice={forgetDevice} />
					))}

					{offlineDevicesList.length === 0 && (
						<tr>
							<td colSpan={4}>No items</td>
						</tr>
					)}
				</tbody>
			</table>
		</div>
	)
})

function AvailableDeviceRow({ device, updateName, configureDevice, deleteEmulator }) {
	const updateName2 = useCallback((val) => updateName(device.id, val), [updateName, device.id])
	const configureDevice2 = useCallback(() => configureDevice(device), [configureDevice, device])
	const deleteEmulator2 = useCallback(() => deleteEmulator(device.id), [deleteEmulator, device.id])

	return (
		<tr>
			<td>#{device.index}</td>
			<td>{device.id}</td>
			<td>
				<TextInputField value={device.name} setValue={updateName2} />
			</td>
			<td>{device.type}</td>
			<td>{device.location}</td>
			<td className="text-right">
				<CButtonGroup>
					<CButton onClick={configureDevice2} title="Configure">
						<FontAwesomeIcon icon={faCog} /> Settings
					</CButton>

					{device.integrationType === 'emulator' && (
						<>
							<CButton href={`/emulator/${device.id.substring(9)}`} target="_blank" title="Open Emulator">
								<FontAwesomeIcon icon={faFolderOpen} />
							</CButton>
							<CButton onClick={deleteEmulator2} title="Delete Emulator">
								<FontAwesomeIcon icon={faTrash} />
							</CButton>
						</>
					)}
				</CButtonGroup>
			</td>
		</tr>
	)
}

function OfflineDeviceRow({ device, updateName, forgetDevice }) {
	const updateName2 = useCallback((val) => updateName(device.id, val), [updateName, device.id])
	const forgetDevice2 = useCallback(() => forgetDevice(device.id), [forgetDevice, device.id])

	return (
		<tr>
			<td>{device.id}</td>
			<td>
				<TextInputField value={device.name} setValue={updateName2} />
			</td>
			<td>{device.type}</td>
			<td className="text-right">
				<CButton onClick={forgetDevice2}>
					<FontAwesomeIcon icon={faTrash} /> Forget
				</CButton>
			</td>
		</tr>
	)
}

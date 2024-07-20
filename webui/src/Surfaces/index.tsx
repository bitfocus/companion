import React, { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { CAlert, CButton, CButtonGroup } from '@coreui/react'
import { SocketContext, assertNever, socketEmitPromise } from '../util.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faAdd, faCog, faFolderOpen, faSync, faTrash } from '@fortawesome/free-solid-svg-icons'
import { TextInputField } from '../Components/TextInputField.js'
import { GenericConfirmModal, GenericConfirmModalRef } from '../Components/GenericConfirmModal.js'
import { SurfaceEditModal, SurfaceEditModalRef } from './EditModal.js'
import { AddSurfaceGroupModal, AddSurfaceGroupModalRef } from './AddGroupModal.js'
import classNames from 'classnames'
import {
	ClientDevicesListItem,
	ClientDiscoveredSurfaceInfo,
	ClientSurfaceItem,
	SurfacesDiscoveryUpdate,
} from '@companion-app/shared/Model/Surfaces.js'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { ClientBonjourService } from '@companion-app/shared/Model/Common.js'

export const SurfacesPage = observer(function SurfacesPage() {
	const { surfaces, socket } = useContext(RootAppStoreContext)

	const editModalRef = useRef<SurfaceEditModalRef>(null)
	const addGroupModalRef = useRef<AddSurfaceGroupModalRef>(null)
	const confirmRef = useRef<GenericConfirmModalRef>(null)

	const [scanning, setScanning] = useState(false)
	const [scanError, setScanError] = useState<string | null>(null)

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
		(surfaceId: string) => {
			confirmRef?.current?.show('Remove Emulator', 'Are you sure?', 'Remove', () => {
				socketEmitPromise(socket, 'surfaces:emulator-remove', [surfaceId]).catch((err) => {
					console.error('Emulator remove failed', err)
				})
			})
		},
		[socket]
	)

	const addGroup = useCallback(() => {
		addGroupModalRef.current?.show()
	}, [socket])

	const deleteGroup = useCallback(
		(groupId: string) => {
			confirmRef?.current?.show('Remove Group', 'Are you sure?', 'Remove', () => {
				socketEmitPromise(socket, 'surfaces:group-remove', [groupId]).catch((err) => {
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
					socketEmitPromise(socket, 'surfaces:forget', [surfaceId]).catch((err) => {
						console.error('fotget failed', err)
					})
				}
			)
		},
		[socket]
	)

	const updateName = useCallback(
		(surfaceId: string, name: string) => {
			socketEmitPromise(socket, 'surfaces:set-name', [surfaceId, name]).catch((err) => {
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
		<div>
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
					{scanning ? ' Checking for new surfaces...' : ' Rescan USB'}
				</CButton>
				<CButton color="danger" onClick={addEmulator}>
					<FontAwesomeIcon icon={faAdd} /> Add Emulator
				</CButton>
				<CButton color="warning" onClick={addGroup}>
					<FontAwesomeIcon icon={faAdd} /> Add Group
				</CButton>
			</CButtonGroup>

			<SurfaceEditModal ref={editModalRef} />
			<GenericConfirmModal ref={confirmRef} />
			<AddSurfaceGroupModal ref={addGroupModalRef} />

			<SurfaceDiscoveryTable />

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
							<td colSpan={7}>No control surfaces have been detected</td>
						</tr>
					)}
				</tbody>
			</table>
		</div>
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

function SurfaceRow({
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
			<td>{surface.type}</td>
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
}

function SurfaceDiscoveryTable() {
	const socket = useContext(SocketContext)

	const [services, setServices] = useState<Record<string, ClientDiscoveredSurfaceInfo | undefined>>({})

	// // Listen for data
	// useEffect(() => {
	// 	const onUp = (svc: ClientBonjourService) => {

	// 		// console.log('up', svc)

	// 		setServices((svcs) => {
	// 			return {
	// 				...svcs,
	// 				[svc.fqdn]: svc,
	// 			}
	// 		})
	// 	}
	// 	const onDown = (svc: ClientBonjourService) => {
	// 		if (svc.subId !== subIdRef.current) return

	// 		// console.log('down', svc)

	// 		setServices((svcs) => {
	// 			const res = { ...svcs }
	// 			delete res[svc.fqdn]
	// 			return res
	// 		})
	// 	}

	// 	socket.on('bonjour:service:up', onUp)
	// 	socket.on('bonjour:service:down', onDown)

	// 	return () => {
	// 		socket.off('bonjour:service:up', onUp)
	// 		socket.off('bonjour:service:down', onDown)
	// 	}
	// }, [])

	// Start/Stop the subscription
	useEffect(() => {
		let killed = false
		socketEmitPromise(socket, 'surfaces:discovery:join', [])
			.then((services) => {
				// Make sure it hasnt been terminated
				if (killed) {
					socketEmitPromise(socket, 'surfaces:discovery:leave', []).catch(() => {
						console.error('Failed to leave discovery')
					})
					return
				}

				setServices(services)
			})
			.catch((e) => {
				console.error('Bonjour subscription failed: ', e)
			})

		const updateHandler = (update: SurfacesDiscoveryUpdate) => {
			switch (update.type) {
				case 'remove':
					setServices((svcs) => {
						const res = { ...svcs }
						delete res[update.itemId]
						return res
					})
					break
				case 'update':
					setServices((svcs) => {
						return {
							...svcs,
							[update.info.id]: update.info,
						}
					})
					break
				default:
					assertNever(update)
					break
			}
		}

		socket.on('surfaces:discovery:update', updateHandler)

		return () => {
			killed = true

			socket.off('surfaces:discovery:update', updateHandler)

			setServices({})

			socketEmitPromise(socket, 'surfaces:discovery:leave', []).catch(() => {
				console.error('Failed to leave discovery')
			})
		}
	}, [socket])

	console.log(services)

	return (
		<>
			<h3>TEST Discovery</h3>

			<table className="table table-responsive-sm table-margin-top">
				<thead>
					<tr>
						<th>Name</th>
						<th>Address</th>
						<th>&nbsp;</th>
					</tr>
				</thead>
				<tbody>
					{Object.entries(services).map(([id, svc]) =>
						svc ? (
							<tr key={id}>
								<td>{svc.name}</td>
								<tr>{svc.addresses}</tr>
							</tr>
						) : null
					)}
					{Object.values(services).length === 0 && (
						<tr>
							<td colSpan={7}>Searching for Satellite installations</td>
						</tr>
					)}
				</tbody>
			</table>
		</>
	)
}

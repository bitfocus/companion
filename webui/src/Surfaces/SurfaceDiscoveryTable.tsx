import { ClientDiscoveredSurfaceInfo, SurfacesDiscoveryUpdate } from '@companion-app/shared/Model/Surfaces.js'
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { socketEmitPromise, assertNever, SocketContext } from '../util.js'
import { CButton, CButtonGroup } from '@coreui/react'
import { faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { SetupSatelliteModalRef, SetupSatelliteModal } from './SetupSatelliteModal.js'

export function SurfaceDiscoveryTable() {
	const discoveredSurfaces = useSurfaceDiscoverySubscription()
	console.log(discoveredSurfaces)

	const setupSatelliteRef = useRef<SetupSatelliteModalRef>(null)

	const showSetupSatellite = useCallback((surfaceInfo: ClientDiscoveredSurfaceInfo) => {
		setupSatelliteRef.current?.show(surfaceInfo)
	}, [])

	return (
		<>
			<SetupSatelliteModal ref={setupSatelliteRef} />

			<table className="table table-responsive-sm table-margin-top">
				<thead>
					<tr>
						<th>Name</th>
						<th>Type</th>
						<th>Address</th>
						<th>&nbsp;</th>
					</tr>
				</thead>
				<tbody>
					{Object.entries(discoveredSurfaces).map(([id, svc]) =>
						svc ? <SatelliteRow key={id} surfaceInfo={svc} showSetupSatellite={showSetupSatellite} /> : null
					)}
					{Object.values(discoveredSurfaces).length === 0 && (
						<tr>
							<td colSpan={7}>Searching for Satellite installations</td>
						</tr>
					)}
				</tbody>
			</table>
		</>
	)
}

function useSurfaceDiscoverySubscription() {
	const socket = useContext(SocketContext)

	const [discoveredSurfaces, setDiscoveredSurfaces] = useState<Record<string, ClientDiscoveredSurfaceInfo | undefined>>(
		{}
	)

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

				setDiscoveredSurfaces(services)
			})
			.catch((e) => {
				console.error('Bonjour subscription failed: ', e)
			})

		const updateHandler = (update: SurfacesDiscoveryUpdate) => {
			switch (update.type) {
				case 'remove':
					setDiscoveredSurfaces((svcs) => {
						const res = { ...svcs }
						delete res[update.itemId]
						return res
					})
					break
				case 'update':
					setDiscoveredSurfaces((svcs) => {
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

			setDiscoveredSurfaces({})

			socketEmitPromise(socket, 'surfaces:discovery:leave', []).catch(() => {
				console.error('Failed to leave discovery')
			})
		}
	}, [socket])

	return discoveredSurfaces
}

interface SatelliteRowProps {
	surfaceInfo: ClientDiscoveredSurfaceInfo
	showSetupSatellite: (surfaceInfo: ClientDiscoveredSurfaceInfo) => void
}

function SatelliteRow({ surfaceInfo, showSetupSatellite }: SatelliteRowProps) {
	const addressesSet = new Set(
		surfaceInfo.addresses.filter((address) => {
			// Skip ipv6 link-local
			return !address.startsWith('fe80::')
		})
	)
	if (addressesSet.size === 0) return null

	const addresses = Array.from(addressesSet).sort()

	return (
		<tr>
			<td>{surfaceInfo.name}</td>
			<td>Companion Satellite</td>
			<td>
				{addresses.map((address) => (
					<p key={address} className="p-no-margin">
						{surfaceInfo.apiEnabled ? (
							<a href={`http://${address}:${surfaceInfo.port}`} target="_new">
								{address}
							</a>
						) : (
							address
						)}
					</p>
				))}
			</td>
			<td>
				<CButtonGroup>
					<CButton onClick={() => showSetupSatellite(surfaceInfo)} title="Setup">
						<FontAwesomeIcon icon={faPlus} /> Setup
					</CButton>
				</CButtonGroup>
			</td>
		</tr>
	)
}

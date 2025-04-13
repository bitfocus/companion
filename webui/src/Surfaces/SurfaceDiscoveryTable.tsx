import {
	ClientDiscoveredSurfaceInfo,
	ClientDiscoveredSurfaceInfoSatellite,
	ClientDiscoveredSurfaceInfoStreamDeck,
} from '@companion-app/shared/Model/Surfaces.js'
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { assertNever, SocketContext } from '../util.js'
import { CButton, CButtonGroup } from '@coreui/react'
import { faBan, faPlus, faSearch } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { SetupSatelliteModalRef, SetupSatelliteModal } from './SetupSatelliteModal.js'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { NonIdealState } from '../Components/NonIdealState.js'
import { observer } from 'mobx-react-lite'

export const SurfaceDiscoveryTable = observer(function SurfaceDiscoveryTable() {
	const discoveredSurfaces = useSurfaceDiscoverySubscription()
	const { userConfig, socket } = useContext(RootAppStoreContext)

	const setupSatelliteRef = useRef<SetupSatelliteModalRef>(null)

	const showSetupSatellite = useCallback((surfaceInfo: ClientDiscoveredSurfaceInfoSatellite) => {
		setupSatelliteRef.current?.show(surfaceInfo)
	}, [])
	const addRemoteStreamDeck = useCallback(
		(surfaceInfo: ClientDiscoveredSurfaceInfoStreamDeck) => {
			// TODO
			socket
				.emitPromise('surfaces:outbound:add', ['elgato', surfaceInfo.address, surfaceInfo.port, surfaceInfo.name])
				.then(() => {
					console.log('added streamdeck', surfaceInfo)
				})
				.catch((e) => {
					console.error('Failed to add streamdeck: ', e)
				})
		},
		[socket]
	)

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
					{userConfig.properties?.discoveryEnabled ? (
						<>
							{Object.entries(discoveredSurfaces).map(([id, svc]) => {
								switch (svc?.surfaceType) {
									case 'satellite':
										return <SatelliteRow key={id} surfaceInfo={svc} showSetupSatellite={showSetupSatellite} />
									case 'streamdeck':
										return <StreamDeckRow key={id} surfaceInfo={svc} addRemoteStreamDeck={addRemoteStreamDeck} />
									case undefined:
										return null
									default:
										assertNever(svc)
										return null
								}
							})}
							{Object.values(discoveredSurfaces).length === 0 && (
								<tr>
									<td colSpan={7}>
										<NonIdealState icon={faSearch} text="Searching for remote surfaces" />
									</td>
								</tr>
							)}
						</>
					) : (
						<tr>
							<td colSpan={7}>
								<NonIdealState icon={faBan} text="Discovery of Remote surfaces is disabled" />
							</td>
						</tr>
					)}
				</tbody>
			</table>
		</>
	)
})

function useSurfaceDiscoverySubscription() {
	const socket = useContext(SocketContext)

	const [discoveredSurfaces, setDiscoveredSurfaces] = useState<Record<string, ClientDiscoveredSurfaceInfo | undefined>>(
		{}
	)

	// Start/Stop the subscription
	useEffect(() => {
		let killed = false
		socket
			.emitPromise('surfaces:discovery:join', [])
			.then((services) => {
				// Make sure it hasnt been terminated
				if (killed) {
					socket.emitPromise('surfaces:discovery:leave', []).catch(() => {
						console.error('Failed to leave discovery')
					})
					return
				}

				setDiscoveredSurfaces(services)
			})
			.catch((e) => {
				console.error('Bonjour subscription failed: ', e)
			})

		const unsubUpdates = socket.on('surfaces:discovery:update', (update) => {
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
		})

		return () => {
			killed = true

			unsubUpdates()

			setDiscoveredSurfaces({})

			socket.emitPromise('surfaces:discovery:leave', []).catch(() => {
				console.error('Failed to leave discovery')
			})
		}
	}, [socket])

	return discoveredSurfaces
}

interface SatelliteRowProps {
	surfaceInfo: ClientDiscoveredSurfaceInfoSatellite
	showSetupSatellite: (surfaceInfo: ClientDiscoveredSurfaceInfoSatellite) => void
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
				{addresses.map((address) => {
					// Ensure ipv6 is formatted correctly for links
					const linkAddress = address.includes(':') ? `[${address}]` : address

					return (
						<p key={address} className="p-no-margin">
							{surfaceInfo.apiEnabled ? (
								<a href={`http://${linkAddress}:${surfaceInfo.port}`} target="_new">
									{address}
								</a>
							) : (
								address
							)}
						</p>
					)
				})}
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

interface StreamDeckRowProps {
	surfaceInfo: ClientDiscoveredSurfaceInfoStreamDeck
	addRemoteStreamDeck: (surfaceInfo: ClientDiscoveredSurfaceInfoStreamDeck) => void
}

const StreamDeckRow = observer(function StreamDeckRow({ surfaceInfo, addRemoteStreamDeck }: StreamDeckRowProps) {
	const { surfaces } = useContext(RootAppStoreContext)

	const isAlreadyAdded = !!surfaces.getOutboundStreamDeckSurface(surfaceInfo.address, surfaceInfo.port)

	return (
		<tr>
			<td>{surfaceInfo.name}</td>
			<td>{surfaceInfo.modelName}</td>
			<td>
				<p className="p-no-margin">{surfaceInfo.address}</p>
			</td>
			<td>
				<CButtonGroup>
					<CButton
						onClick={() => addRemoteStreamDeck(surfaceInfo)}
						title={isAlreadyAdded ? 'Already added' : 'Add Stream Deck'}
						className="btn-undefined"
						disabled={isAlreadyAdded}
					>
						<FontAwesomeIcon icon={faPlus} /> Add Stream Deck
					</CButton>
				</CButtonGroup>
			</td>
		</tr>
	)
})

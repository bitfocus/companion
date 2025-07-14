import {
	ClientDiscoveredSurfaceInfo,
	ClientDiscoveredSurfaceInfoSatellite,
	ClientDiscoveredSurfaceInfoStreamDeck,
} from '@companion-app/shared/Model/Surfaces.js'
import React, { useCallback, useContext, useRef, useState } from 'react'
import { assertNever } from '~/util.js'
import { CButton, CButtonGroup } from '@coreui/react'
import { faBan, faPlus, faSearch } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { SetupSatelliteModalRef, SetupSatelliteModal } from './SetupSatelliteModal.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { observer } from 'mobx-react-lite'
import { useSubscription } from '@trpc/tanstack-react-query'
import { trpc, useMutationExt } from '~/TRPC.js'

export const SurfaceDiscoveryTable = observer(function SurfaceDiscoveryTable() {
	const discoveredSurfaces = useSurfaceDiscoverySubscription()
	const { userConfig } = useContext(RootAppStoreContext)

	const setupSatelliteRef = useRef<SetupSatelliteModalRef>(null)

	const showSetupSatellite = useCallback((surfaceInfo: ClientDiscoveredSurfaceInfoSatellite) => {
		setupSatelliteRef.current?.show(surfaceInfo)
	}, [])

	const addRemoteStreamDeckMutation = useMutationExt(trpc.surfaces.outbound.add.mutationOptions())
	const addRemoteStreamDeck = useCallback(
		(surfaceInfo: ClientDiscoveredSurfaceInfoStreamDeck) => {
			addRemoteStreamDeckMutation
				.mutateAsync({
					type: 'elgato',
					address: surfaceInfo.address,
					port: surfaceInfo.port,
					name: surfaceInfo.name,
				})
				.then(() => {
					console.log('added streamdeck', surfaceInfo)
				})
				.catch((e) => {
					console.error('Failed to add streamdeck: ', e)
				})
		},
		[addRemoteStreamDeckMutation]
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
	const [discoveredSurfaces, setDiscoveredSurfaces] = useState<Record<string, ClientDiscoveredSurfaceInfo | undefined>>(
		{}
	)

	/*const discoverySub = */ useSubscription(
		trpc.surfaceDiscovery.watchForSurfaces.subscriptionOptions(undefined, {
			onStarted: () => {
				setDiscoveredSurfaces({}) // Clear when the subscription starts
			},
			onData: (data) => {
				// TODO - should this debounce?

				setDiscoveredSurfaces((surfaces) => {
					switch (data.type) {
						case 'init': {
							const newSurfaces: typeof surfaces = {}
							for (const svc of data.infos) {
								// TODO - how to avoid this cast?
								newSurfaces[svc.id] = svc as ClientDiscoveredSurfaceInfo
							}
							return newSurfaces
						}
						case 'update': {
							const newSurfaces = { ...surfaces }
							// TODO - how to avoid this cast?
							newSurfaces[data.info.id] = data.info as ClientDiscoveredSurfaceInfo
							return newSurfaces
						}
						case 'remove': {
							const newSurfaces = { ...surfaces }
							delete newSurfaces[data.itemId]
							return newSurfaces
						}
						default:
							console.warn('Unknown bonjour event type', data)
							return surfaces
					}
				})
			},
		})
	)

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
								<a href={`http://${linkAddress}:${surfaceInfo.port}`} target="_blank">
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

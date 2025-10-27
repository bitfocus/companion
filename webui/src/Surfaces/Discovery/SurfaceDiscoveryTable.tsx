import type {
	ClientDiscoveredSurfaceInfoSatellite,
	ClientDiscoveredSurfaceInfoStreamDeck,
} from '@companion-app/shared/Model/Surfaces.js'
import React, { useCallback, useContext, useRef } from 'react'
import { assertNever } from '~/Resources/util.js'
import { CButton, CButtonGroup } from '@coreui/react'
import { faBan, faCheck, faPlus, faSearch } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { SetupSatelliteModal, type SetupSatelliteModalRef } from './SetupSatelliteModal.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { observer } from 'mobx-react-lite'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { useSurfaceDiscoveryContext } from './SurfaceDiscoveryContext.js'

export const SurfaceDiscoveryTable = observer(function SurfaceDiscoveryTable() {
	const { discoveredSurfaces } = useSurfaceDiscoveryContext()
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

			<table className="table table-responsive-sm">
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
										return <DiscoveredSurfaceRow key={id} surfaceInfo={svc} addRemoteStreamDeck={addRemoteStreamDeck} />
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

const DiscoveredSurfaceRow = observer(function DiscoveredSurfaceRow({
	surfaceInfo,
	addRemoteStreamDeck,
}: StreamDeckRowProps) {
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
					{isAlreadyAdded ? (
						<CButton title={'Already added'} className="btn-undefined" disabled>
							<FontAwesomeIcon icon={faCheck} /> Already added
						</CButton>
					) : (
						<CButton onClick={() => addRemoteStreamDeck(surfaceInfo)} title="Add Stream Deck" className="btn-undefined">
							<FontAwesomeIcon icon={faPlus} /> Add Stream Deck
						</CButton>
					)}
				</CButtonGroup>
			</td>
		</tr>
	)
})

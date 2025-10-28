import type {
	ClientDiscoveredSurfaceInfoPlugin,
	ClientDiscoveredSurfaceInfoSatellite,
	ClientDiscoveredSurfaceInfoStreamDeck,
} from '@companion-app/shared/Model/Surfaces.js'
import React, { useCallback, useContext, useRef } from 'react'
import { assertNever } from '~/Resources/util.js'
import { CButton, CButtonGroup } from '@coreui/react'
import { faCheck, faPlus, faSearch } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { SetupSatelliteModal, type SetupSatelliteModalRef } from './SetupSatelliteModal.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { observer } from 'mobx-react-lite'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { useSurfaceDiscoveryContext } from './SurfaceDiscoveryContext.js'

export const SurfaceDiscoveryTable = observer(function SurfaceDiscoveryTable() {
	const { discoveredSurfaces } = useSurfaceDiscoveryContext()

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

	const addRemotePluginSurfaceMutation = useMutationExt(trpc.surfaces.outbound.add2.mutationOptions())
	const addConnection = useCallback(
		(surfaceInfo: ClientDiscoveredSurfaceInfoPlugin) => {
			addRemotePluginSurfaceMutation
				.mutateAsync({
					instanceId: surfaceInfo.instanceId,
					connectionId: surfaceInfo.id,
				})
				.then(() => {
					console.log('added plugin surface', surfaceInfo)
				})
				.catch((e) => {
					console.error('Failed to add plugin surface: ', e)
				})
		},
		[addRemotePluginSurfaceMutation]
	)

	return (
		<>
			<SetupSatelliteModal ref={setupSatelliteRef} />

			<table className="table table-responsive-sm">
				<thead>
					<tr>
						<th>Name</th>
						<th>Address</th>
						<th>&nbsp;</th>
					</tr>
				</thead>
				<tbody>
					{Object.entries(discoveredSurfaces).map(([id, svc]) => {
						switch (svc?.surfaceType) {
							case 'satellite':
								return <SatelliteRow key={id} surfaceInfo={svc} showSetupSatellite={showSetupSatellite} />
							case 'streamdeck':
								return <DiscoveredSurfaceRow key={id} surfaceInfo={svc} addRemoteStreamDeck={addRemoteStreamDeck} />
							case 'plugin':
								return <DiscoveredSurfaceRow2 key={id} surfaceInfo={svc} addConnection={addConnection} />
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
			<td>
				<div className="flex flex-column">
					<b>{surfaceInfo.name}</b>
					<span className="auto-ellipsis" title="Companion Satellite">
						Companion Satellite
					</span>
				</div>
			</td>

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
			<td>
				<div className="flex flex-column">
					<b>{surfaceInfo.name}</b>
					<span className="auto-ellipsis" title={surfaceInfo.modelName}>
						{surfaceInfo.modelName}
					</span>
				</div>
			</td>
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

interface StreamDeckRow2Props {
	surfaceInfo: ClientDiscoveredSurfaceInfoPlugin
	addConnection: (surfaceInfo: ClientDiscoveredSurfaceInfoPlugin) => void
}

const DiscoveredSurfaceRow2 = observer(function DiscoveredSurfaceRow2({
	surfaceInfo,
	addConnection,
}: StreamDeckRow2Props) {
	// const { surfaces } = useContext(RootAppStoreContext)

	const isAlreadyAdded = false // TODO
	// const isAlreadyAdded = !!surfaces.getOutboundStreamDeckSurface(surfaceInfo.address, surfaceInfo.port)

	return (
		<tr>
			<td>
				<div className="flex flex-column">
					<b>{surfaceInfo.name}</b>
					<span className="auto-ellipsis" title={surfaceInfo.description}>
						{surfaceInfo.description}
					</span>
				</div>
			</td>
			<td>
				<p className="p-no-margin"></p>
			</td>
			<td>
				<CButtonGroup>
					{isAlreadyAdded ? (
						<CButton title={'Already added'} className="btn-undefined" disabled>
							<FontAwesomeIcon icon={faCheck} /> Already added
						</CButton>
					) : (
						<CButton onClick={() => addConnection(surfaceInfo)} title="Add Connection" className="btn-undefined">
							<FontAwesomeIcon icon={faPlus} /> Add Connection
						</CButton>
					)}
				</CButtonGroup>
			</td>
		</tr>
	)
})

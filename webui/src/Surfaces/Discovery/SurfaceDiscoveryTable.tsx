import type {
	ClientDiscoveredSurfaceInfoPlugin,
	ClientDiscoveredSurfaceInfoSatellite,
} from '@companion-app/shared/Model/Surfaces.js'
import React, { useCallback, useContext, useRef } from 'react'
import { assertNever, useComputed } from '~/Resources/util.js'
import { CButton, CButtonGroup } from '@coreui/react'
import { faCheck, faPlus, faSearch } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { SetupSatelliteModal, type SetupSatelliteModalRef } from './SetupSatelliteModal.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { observer } from 'mobx-react-lite'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { useSurfaceDiscoveryContext } from './SurfaceDiscoveryContext.js'
import { useNavigate } from '@tanstack/react-router'
import { ParseExpression } from '@companion-app/shared/Expression/ExpressionParse.js'
import { ResolveExpression } from '@companion-app/shared/Expression/ExpressionResolve.js'
import { ExpressionFunctions } from '@companion-app/shared/Expression/ExpressionFunctions.js'
import { toJS } from 'mobx'

export const SurfaceDiscoveryTable = observer(function SurfaceDiscoveryTable() {
	const { notifier } = useContext(RootAppStoreContext)
	const navigate = useNavigate()

	const { discoveredSurfaces } = useSurfaceDiscoveryContext()

	const setupSatelliteRef = useRef<SetupSatelliteModalRef>(null)

	const showSetupSatellite = useCallback((surfaceInfo: ClientDiscoveredSurfaceInfoSatellite) => {
		setupSatelliteRef.current?.show(surfaceInfo)
	}, [])

	const addRemotePluginSurfaceMutation = useMutationExt(trpc.surfaces.outbound.add.mutationOptions())
	const addConnection = useCallback(
		(surfaceInfo: ClientDiscoveredSurfaceInfoPlugin) => {
			addRemotePluginSurfaceMutation
				.mutateAsync({
					instanceId: surfaceInfo.instanceId,
					connectionId: surfaceInfo.id,
				})
				.then((res) => {
					if (!res.ok) {
						notifier.show('Failed to setup connection', res.error ?? 'Unknown error')
					} else {
						void navigate({ to: '/surfaces/remote/$connectionId', params: { connectionId: res.id } })
					}
					console.log('added plugin surface', surfaceInfo)
				})
				.catch((e) => {
					console.error('Failed to add plugin surface: ', e)
				})
		},
		[addRemotePluginSurfaceMutation, navigate, notifier]
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
							case 'plugin':
								return <PluginSurfaceRow key={id} surfaceInfo={svc} addConnection={addConnection} />
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

interface PluginSurfaceRowProps {
	surfaceInfo: ClientDiscoveredSurfaceInfoPlugin
	addConnection: (surfaceInfo: ClientDiscoveredSurfaceInfoPlugin) => void
}

const PluginSurfaceRow = observer(function PluginSurfaceRow({ surfaceInfo, addConnection }: PluginSurfaceRowProps) {
	const { surfaceInstances, surfaces } = useContext(RootAppStoreContext)

	const instanceInfo = surfaceInstances.instances.get(surfaceInfo.instanceId)
	const surfaceInstanceDisplayName = instanceInfo?.label ?? 'Unknown Surface Instance'

	const isAlreadyAdded = useComputed(() => {
		// If no expression, can't match
		if (!instanceInfo?.remoteConfigMatches) return false

		try {
			const expression = ParseExpression(instanceInfo.remoteConfigMatches)
			const doesMatch = (otherConfig: Record<string, any>) => {
				try {
					const val = ResolveExpression(
						expression,
						(props) => {
							if (props.label === 'objA') {
								return toJS(surfaceInfo.config[props.name])
							} else if (props.label === 'objB') {
								return toJS(otherConfig[props.name])
							} else {
								throw new Error(`Unknown variable "${props.variableId}"`)
							}
						},
						ExpressionFunctions
					)
					return !!val && val !== 'false' && val !== '0'
				} catch (e) {
					console.error('Failed to resolve expression', e)
					return false
				}
			}

			// Find a surface which matches
			for (const surface of surfaces.outboundSurfaces.values()) {
				if (surface.type === 'plugin' && surface.instanceId === surfaceInfo.instanceId && doesMatch(surface.config)) {
					return true
				}
			}

			return false
		} catch (e) {
			console.error('Failed to process remoteConfigMatches expression', e)
			return false
		}
	}, [instanceInfo, surfaceInfo, surfaces])

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
				<p className="p-no-margin">{surfaceInstanceDisplayName}</p>
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

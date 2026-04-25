import { useSubscription } from '@trpc/tanstack-react-query'
import { useState } from 'react'
import type { ClientDiscoveredSurfaceInfo } from '@companion-app/shared/Model/Surfaces.js'
import { trpc } from '~/Resources/TRPC'

export function useSurfaceDiscoverySubscription(): Record<string, ClientDiscoveredSurfaceInfo | undefined> {
	const [discoveredSurfaces, setDiscoveredSurfaces] = useState<Record<string, ClientDiscoveredSurfaceInfo | undefined>>(
		{}
	)

	/*const discoverySub = */ useSubscription(
		trpc.surfaces.outbound.discovery.watchForSurfaces.subscriptionOptions(undefined, {
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
								newSurfaces[svc.id] = svc
							}
							return newSurfaces
						}
						case 'update': {
							const newSurfaces = { ...surfaces }
							newSurfaces[data.info.id] = data.info
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

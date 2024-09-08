import { useEffect, useState } from 'react'
import { CompanionSocketType, socketEmitPromise } from '../util.js'
import type { OutboundSurfacesUpdate } from '@companion-app/shared/Model/Surfaces.js'
import type { SurfacesStore } from '../Stores/SurfacesStore.js'

export function useOutboundSurfacesSubscription(
	socket: CompanionSocketType,
	store: SurfacesStore,
	setLoadError?: ((error: string | null) => void) | undefined,
	retryToken?: string
): boolean {
	const [ready, setReady] = useState(false)

	useEffect(() => {
		setLoadError?.(null)
		store.resetOutboundSurfaces(null)
		setReady(false)

		socketEmitPromise(socket, 'surfaces:outbound:subscribe', [])
			.then((surfaces) => {
				setLoadError?.(null)
				store.resetOutboundSurfaces(surfaces)
				setReady(true)
			})
			.catch((e) => {
				setLoadError?.(`Failed to load outbound surfaces list`)
				console.error('Failed to load outbound surfaces list:', e)
				store.resetOutboundSurfaces(null)
			})

		const updateSurfaces = (changes: OutboundSurfacesUpdate[]) => {
			for (const change of changes) {
				store.applyOutboundSurfacesChange(change)
			}
		}

		socket.on('surfaces:outbound:update', updateSurfaces)

		return () => {
			store.resetOutboundSurfaces(null)

			socket.off('surfaces:outbound:update', updateSurfaces)

			socketEmitPromise(socket, 'surfaces:outbound:unsubscribe', []).catch((e) => {
				console.error('Failed to unsubscribe to outbound surfaces list', e)
			})
		}
	}, [socket, store, setLoadError, retryToken])

	return ready
}

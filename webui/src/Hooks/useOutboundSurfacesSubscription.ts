import { useEffect, useState } from 'react'
import { CompanionSocketWrapped } from '../util.js'
import type { SurfacesStore } from '../Stores/SurfacesStore.js'

export function useOutboundSurfacesSubscription(
	socket: CompanionSocketWrapped,
	store: SurfacesStore,
	setLoadError?: ((error: string | null) => void) | undefined,
	retryToken?: string
): boolean {
	const [ready, setReady] = useState(false)

	useEffect(() => {
		setLoadError?.(null)
		store.resetOutboundSurfaces(null)
		setReady(false)

		socket
			.emitPromise('surfaces:outbound:subscribe', [])
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

		const unsubUpdates = socket.on('surfaces:outbound:update', (changes) => {
			for (const change of changes) {
				store.applyOutboundSurfacesChange(change)
			}
		})

		return () => {
			store.resetOutboundSurfaces(null)

			unsubUpdates()

			socket.emitPromise('surfaces:outbound:unsubscribe', []).catch((e) => {
				console.error('Failed to unsubscribe to outbound surfaces list', e)
			})
		}
	}, [socket, store, setLoadError, retryToken])

	return ready
}

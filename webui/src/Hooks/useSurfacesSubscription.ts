import { useEffect, useState } from 'react'
import { CompanionSocketWrapped } from '../util.js'
import type { SurfacesStore } from '../Stores/SurfacesStore.js'

export function useSurfacesSubscription(
	socket: CompanionSocketWrapped,
	store: SurfacesStore,
	setLoadError?: ((error: string | null) => void) | undefined,
	retryToken?: string
): boolean {
	const [ready, setReady] = useState(false)

	useEffect(() => {
		setLoadError?.(null)
		store.resetSurfaces(null)
		setReady(false)

		socket
			.emitPromise('surfaces:subscribe', [])
			.then((surfaces) => {
				setLoadError?.(null)
				store.resetSurfaces(surfaces)
				setReady(true)
			})
			.catch((e) => {
				setLoadError?.(`Failed to load surfaces list`)
				console.error('Failed to load surfaces list:', e)
				store.resetSurfaces(null)
			})

		const unsubUpdates = socket.on('surfaces:update', (changes) => {
			for (const change of changes) {
				store.applySurfacesChange(change)
			}
		})

		return () => {
			store.resetSurfaces(null)

			unsubUpdates()

			socket.emitPromise('surfaces:unsubscribe', []).catch((e) => {
				console.error('Failed to unsubscribe to surfaces list', e)
			})
		}
	}, [socket, store, setLoadError, retryToken])

	return ready
}

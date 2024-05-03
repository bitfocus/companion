import { useEffect, useState } from 'react'
import { CompanionSocketType, socketEmitPromise } from '../util.js'
import type { SurfacesUpdate } from '@companion-app/shared/Model/Surfaces.js'
import type { SurfacesStore } from '../Stores/SurfacesStore.js'

export function useSurfacesSubscription(
	socket: CompanionSocketType,
	store: SurfacesStore,
	setLoadError?: ((error: string | null) => void) | undefined,
	retryToken?: string
): boolean {
	const [ready, setReady] = useState(false)

	useEffect(() => {
		setLoadError?.(null)
		store.reset(null)
		setReady(false)

		socketEmitPromise(socket, 'surfaces:subscribe', [])
			.then((surfaces) => {
				setLoadError?.(null)
				store.reset(surfaces)
				setReady(true)
			})
			.catch((e) => {
				setLoadError?.(`Failed to load surfaces list`)
				console.error('Failed to load surfaces list:', e)
				store.reset(null)
			})

		const updateSurfaces = (changes: SurfacesUpdate[]) => {
			for (const change of changes) {
				store.applyChange(change)
			}
		}

		socket.on('surfaces:update', updateSurfaces)

		return () => {
			store.reset(null)

			socket.off('surfaces:update', updateSurfaces)

			socketEmitPromise(socket, 'surfaces:unsubscribe', []).catch((e) => {
				console.error('Failed to unsubscribe to surfaces list', e)
			})
		}
	}, [socket, store, setLoadError, retryToken])

	return ready
}

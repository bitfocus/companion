import { useState, useEffect } from 'react'
import type { SurfacesStore } from '../Stores/SurfacesStore.js'
import { CompanionSocketType, socketEmitPromise } from '../util.js'

export function useSurfaceLayoutsSubscription(
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

		socketEmitPromise(socket, 'surfaces:get-layouts', [])
			.then((surfaceLayouts) => {
				setLoadError?.(null)
				store.resetLayouts(surfaceLayouts)
				setReady(true)
			})
			.catch((e) => {
				setLoadError?.(`Failed to load surface layouts list`)
				console.error('Failed to load surface layouts list:', e)
				store.reset(null)
			})

		return () => {
			store.resetLayouts(null)
		}
	}, [socket, store, setLoadError, retryToken])

	return ready
}

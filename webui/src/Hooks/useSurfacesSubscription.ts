import { useEffect, useState } from 'react'
import { CompanionSocketWrapped } from '~/util.js'
import type { SurfacesStore } from '~/Stores/SurfacesStore.js'

export function useSurfacesSubscription(socket: CompanionSocketWrapped, store: SurfacesStore): boolean {
	const [ready, setReady] = useState(false)

	useEffect(() => {
		store.resetSurfaces(null)
		setReady(false)

		socket
			.emitPromise('surfaces:subscribe', [])
			.then((surfaces) => {
				store.resetSurfaces(surfaces)
				setReady(true)
			})
			.catch((e) => {
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
	}, [socket, store])

	return ready
}

import { useEffect, useState } from 'react'
import { CompanionSocketWrapped } from '../util.js'
import type { ImageLibraryStore } from '~/Stores/ImageLibraryStore.js'
import type { ImageLibraryCollection } from '@companion-app/shared/Model/ImageLibraryModel.js'

export function useImageLibraryCollectionsSubscription(
	socket: CompanionSocketWrapped,
	store: ImageLibraryStore
): boolean {
	const [ready, setReady] = useState(false)

	useEffect(() => {
		store.resetCollections(null)
		setReady(false)

		socket
			.emitPromise('image-library-collections:subscribe', [])
			.then((collections: ImageLibraryCollection[]) => {
				store.resetCollections(collections)
				setReady(true)
			})
			.catch((e) => {
				store.resetCollections(null)
				console.error('Failed to load image library collections list', e)
			})

		const unsubUpdates = socket.on('image-library-collections:update', (update: ImageLibraryCollection[]) => {
			store.resetCollections(update)
		})

		return () => {
			store.resetCollections(null)
			unsubUpdates()

			socket.emitPromise('image-library-collections:unsubscribe', []).catch((e) => {
				console.error('Failed to unsubscribe from image library collections list:', e)
			})
		}
	}, [socket, store])

	return ready
}

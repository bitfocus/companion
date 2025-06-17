import { useEffect, useState } from 'react'
import { CompanionSocketWrapped } from '~/util.js'
import { ImageLibraryStore } from '~/Stores/ImageLibraryStore.js'
import type { ImageLibraryInfo } from '@companion-app/shared/Model/ImageLibraryModel.js'

export function useImageLibrarySubscription(socket: CompanionSocketWrapped, store: ImageLibraryStore): boolean {
	const [ready, setReady] = useState(false)

	useEffect(() => {
		let disposed = false

		store.reset(null)
		setReady(false)

		socket
			.emitPromise('image-library:subscribe', [])
			.then((data: ImageLibraryInfo[]) => {
				if (disposed) return
				store.reset(data)
				setReady(true)
			})
			.catch((e) => {
				if (disposed) return
				store.reset(null)
				console.error('Failed to load image library', e)
			})

		const unsubUpdated = socket.on('image-library:updated', (imageId: string, imageInfo: ImageLibraryInfo) => {
			if (disposed) return
			store.updateImage(imageId, imageInfo)
		})

		const unsubRemoved = socket.on('image-library:removed', (imageId: string) => {
			if (disposed) return
			store.removeImage(imageId)
		})

		return () => {
			disposed = true
			store.reset(null)
			unsubUpdated()
			unsubRemoved()

			socket.emitPromise('image-library:unsubscribe', []).catch((e) => {
				console.error('Failed to unsubscribe from image library', e)
			})
		}
	}, [socket, store])

	return ready
}

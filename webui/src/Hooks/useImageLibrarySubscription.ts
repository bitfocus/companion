import { useState } from 'react'
import { ImageLibraryStore } from '~/Stores/ImageLibraryStore.js'
import { useSubscription } from '@trpc/tanstack-react-query'
import { trpc } from '~/Resources/TRPC'

export function useImageLibrarySubscription(store: ImageLibraryStore): boolean {
	const [ready, setReady] = useState(false)

	useSubscription(
		trpc.imageLibrary.watch.subscriptionOptions(undefined, {
			onStarted: () => {
				store.updateStore(null)
				setReady(false)
			},
			onData: (data) => {
				store.updateStore(data)
				setReady(true)
			},
			onError: (error) => {
				store.updateStore(null)
				console.error('Failed to load image library', error)
			},
		})
	)

	return ready
}

import { useState } from 'react'
import { PagesStore } from '~/Stores/PagesStore.js'
import { useSubscription } from '@trpc/tanstack-react-query'
import { trpc } from '~/Resources/TRPC'

export function usePagesInfoSubscription(
	store: PagesStore,
	setLoadError?: ((error: string | null) => void) | undefined
): {
	ready: boolean
	reset: () => void
} {
	const [ready, setReady] = useState(false)

	const sub = useSubscription(
		trpc.pages.watch.subscriptionOptions(undefined, {
			onStarted: () => {
				setLoadError?.(null)
				store.updateStore(null)
				setReady(false)
			},
			onData: (data) => {
				setLoadError?.(null)
				store.updateStore(data)
				setReady(true)
			},
			onError: (error) => {
				console.error('Failed to load pages list:', error)
				setLoadError?.(`Failed to load pages list: ${error.message}`)
				store.updateStore(null)
			},
		})
	)

	return { ready, reset: sub.reset }
}

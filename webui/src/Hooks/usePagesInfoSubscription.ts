import { useEffect, useState } from 'react'
import { CompanionSocketWrapped } from '~/util.js'
import { PagesStore } from '~/Stores/PagesStore.js'

export function usePagesInfoSubscription(
	socket: CompanionSocketWrapped,
	store: PagesStore,
	setLoadError?: ((error: string | null) => void) | undefined,
	retryToken?: string
): boolean {
	const [ready, setReady] = useState(false)

	useEffect(() => {
		setLoadError?.(null)
		store.reset(null)
		setReady(false)

		socket
			.emitPromise('pages:subscribe', [])
			.then((newPages) => {
				setLoadError?.(null)
				store.reset(newPages)
				setReady(true)
			})
			.catch((e) => {
				console.error('Failed to load pages list:', e)
				setLoadError?.(`Failed to load pages list`)
				store.reset(null)
			})

		const unsubUpdates = socket.on('pages:update', (change) => {
			store.updatePage(change)
		})

		return () => {
			store.reset(null)

			unsubUpdates()

			socket.emitPromise('pages:unsubscribe', []).catch((e) => {
				console.error('Failed to cleanup web-buttons:', e)
			})
		}
	}, [retryToken, socket, store, setLoadError])

	return ready
}

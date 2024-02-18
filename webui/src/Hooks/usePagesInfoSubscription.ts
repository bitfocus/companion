import { useEffect, useState } from 'react'
import { CompanionSocketType, socketEmitPromise } from '../util.js'
import type { PageModel } from '@companion-app/shared/Model/PageModel.js'
import { PagesStore } from '../Stores/PagesStore.js'

export function usePagesInfoSubscription(
	socket: CompanionSocketType,
	store: PagesStore,
	setLoadError?: ((error: string | null) => void) | undefined,
	retryToken?: string
): boolean {
	const [ready, setReady] = useState(false)

	useEffect(() => {
		setLoadError?.(null)
		store.reset(null)
		setReady(false)

		socketEmitPromise(socket, 'pages:subscribe', [])
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

		const updatePageInfo = (page: number, info: PageModel) => {
			store.updatePage(page, info)
		}

		socket.on('pages:update', updatePageInfo)

		return () => {
			store.reset(null)

			socket.off('pages:update', updatePageInfo)

			socketEmitPromise(socket, 'pages:unsubscribe', []).catch((e) => {
				console.error('Failed to cleanup web-buttons:', e)
			})
		}
	}, [retryToken, socket, store])

	return ready
}

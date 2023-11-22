import { useEffect, useState } from 'react'
import { socketEmitPromise } from '../util'
import { Socket } from 'socket.io-client'
import type { PageModel } from '@companion/shared/Model/PageModel'

export function usePagesInfoSubscription(
	socket: Socket,
	setLoadError?: ((error: string | null) => void) | undefined,
	retryToken?: string
) {
	const [pages, setPages] = useState<Record<number, PageModel | undefined> | null>(null)

	useEffect(() => {
		setLoadError?.(null)
		setPages(null)

		socketEmitPromise(socket, 'pages:subscribe', [])
			.then((newPages) => {
				setLoadError?.(null)
				setPages(newPages)
			})
			.catch((e) => {
				console.error('Failed to load pages list:', e)
				setLoadError?.(`Failed to load pages list`)
				setPages(null)
			})

		const updatePageInfo = (page: number, info: PageModel) => {
			setPages((oldPages) => {
				if (oldPages) {
					return {
						...oldPages,
						[page]: info,
					}
				} else {
					return null
				}
			})
		}

		socket.on('pages:update', updatePageInfo)

		return () => {
			socket.off('pages:update', updatePageInfo)

			socketEmitPromise(socket, 'pages:unsubscribe', []).catch((e) => {
				console.error('Failed to cleanup web-buttons:', e)
			})
		}
	}, [retryToken, socket])

	return pages
}

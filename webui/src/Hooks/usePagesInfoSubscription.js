import { useEffect, useState } from 'react'
import { socketEmitPromise } from '../util'

export function usePagesInfoSubscription(socket, setLoadError, retryToken) {
	const [pages, setPages] = useState(null)

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

		const updatePageInfo = (page, info) => {
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

import { useContext, useEffect, useMemo, useState } from 'react'
import { PagesContext, socketEmitPromise } from '../util.js'
import { Socket } from 'socket.io-client'
import type { PageModel } from '@companion-app/shared/Model/PageModel.js'
import jsonPatch, { Operation as JsonPatchOperation } from 'fast-json-patch'
import { cloneDeep } from 'lodash-es'

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

		const updatePageInfo = (patch: JsonPatchOperation[]) => {
			setPages((oldPages) => {
				if (!oldPages) return oldPages
				console.log(oldPages, patch)
				return jsonPatch.applyPatch(cloneDeep(oldPages) || {}, patch).newDocument
			})
		}

		socket.on('pages:patch', updatePageInfo)

		return () => {
			socket.off('pages:patch', updatePageInfo)

			socketEmitPromise(socket, 'pages:unsubscribe', []).catch((e) => {
				console.error('Failed to cleanup web-buttons:', e)
			})
		}
	}, [retryToken, socket])

	return pages
}

export function usePageCount() {
	const pages = useContext(PagesContext)

	return useMemo(() => {
		let pageCount = 0

		for (const [pageNumber, pageInfo] of Object.entries(pages)) {
			if (pageInfo) pageCount = Math.max(pageCount, Number(pageNumber))
		}

		return pageCount
	}, [pages])
}

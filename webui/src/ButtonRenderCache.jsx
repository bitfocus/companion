import { useEffect, useState } from 'react'
import { EventEmitter } from 'events'
import { socketEmitPromise } from './util'

/**
 * The main cache store
 * It should be instantiated once and stored in a Context.
 * Accessing values must be done via useSharedPageRenderCache to get the correct reactivity
 */
export class ButtonRenderCache extends EventEmitter {
	#socket

	#pageRenders = {}
	#pageSubs = {}

	constructor(socket) {
		super()
		this.#socket = socket

		// TODO - this will leak if the Memo re-evaluates
		socket.on('preview:page-bank', this.#bankChange.bind(this))
	}

	#bankChange(location, render) {
		location.pageNumber = Number(location.pageNumber)
		if (isNaN(location.pageNumber)) return

		const subsForPage = this.#pageSubs[location.pageNumber]
		if (subsForPage && subsForPage.size) {
			const newImages = { ...this.#pageRenders[location.pageNumber] }
			newImages[location.row] = {
				...newImages[location.row],
				[location.column]: render,
			}
			this.#pageRenders[location.pageNumber] = newImages

			// TODO - debounce?
			this.emit('page', location.pageNumber, newImages)
		}
	}

	subscribePage(gridId, page) {
		let subsForPage = this.#pageSubs[page]
		if (!subsForPage) subsForPage = this.#pageSubs[page] = new Set()

		const doSubscribe = subsForPage.size === 0

		subsForPage.add(gridId)

		if (doSubscribe) {
			socketEmitPromise(this.#socket, 'preview:page:subscribe', [page])
				.then((newImages) => {
					this.#pageRenders[page] = newImages

					this.emit('page', page, newImages)
				})
				.catch((e) => {
					console.error(e)
				})
			return undefined
		} else {
			return this.#pageRenders[page]
		}
	}

	unsubscribePage(gridId, page) {
		const subsForPage = this.#pageSubs[page]
		if (subsForPage && subsForPage.size > 0) {
			subsForPage.delete(gridId)

			if (subsForPage.size === 0) {
				socketEmitPromise(this.#socket, 'preview:page:unsubscribe', [page]).catch((e) => {
					console.error(e)
				})

				delete this.#pageRenders[page]
			}
		}
	}
}

/**
 * Load and retrieve a page from the shared button render cache
 * @param {ButtonRenderCache} cacheContext The cache to use
 * @param {string} sessionId Unique id of this accessor
 * @param {number | undefined} page Page number to load and retrieve
 * @param {boolean | undefined} disable Disable loading of this page
 * @returns
 */
export function useSharedPageRenderCache(cacheContext, sessionId, page, disable = false) {
	const [imagesState, setImagesState] = useState({})

	useEffect(() => {
		const page2 = Number(page)
		if (!isNaN(page2) && !disable) {
			const updateImages = (page3, images) => {
				if (page3 === page2) setImagesState(images)
			}

			cacheContext.on('page', updateImages)

			const initialImages = cacheContext.subscribePage(sessionId, page2)
			if (initialImages) setImagesState(initialImages)

			return () => {
				cacheContext.off('page', updateImages)

				cacheContext.unsubscribePage(sessionId, page2)
			}
		}
	}, [cacheContext, sessionId, page, disable])

	return imagesState
}

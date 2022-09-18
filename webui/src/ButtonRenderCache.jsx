import { useEffect, useState } from 'react'
import { EventEmitter } from 'events'
import { dataToButtonImage } from './Components/BankButton'
import { MAX_BUTTONS } from './Constants'
import { socketEmitPromise } from './util'

/**
 * The main cache store
 * It should be instantiated once and stored in a Context.
 * Accessing values must be done via useSharedRenderCache to get the correct reactivity
 */
export class ButtonRenderCache extends EventEmitter {
	#socket

	#renders = {}
	#subs = {}

	constructor(socket) {
		super()
		this.#socket = socket

		// TODO - this will leak if the Memo re-evaluates
		socket.on('preview:page-bank', this.bankChange.bind(this))
	}

	bankChange(page, bank, render) {
		const subsForPage = this.#subs[page]
		if (subsForPage && subsForPage.size) {
			const newImages = {
				...this.#renders[page],
				[bank]: dataToButtonImage(render),
			}
			this.#renders[page] = newImages

			// TODO - debounce?
			this.emit('page', page, newImages)
		}
	}

	subscribe(gridId, page) {
		let subsForPage = this.#subs[page]
		if (!subsForPage) subsForPage = this.#subs[page] = new Set()

		const doSubscribe = subsForPage.size === 0

		subsForPage.add(gridId)

		if (doSubscribe) {
			socketEmitPromise(this.#socket, 'preview:page:subscribe', [page])
				.then((data) => {
					const newImages = {}
					for (let key = 1; key <= MAX_BUTTONS; ++key) {
						if (data[key]) {
							newImages[key] = dataToButtonImage(data[key])
						}
					}
					this.#renders[page] = newImages

					this.emit('page', page, newImages)
				})
				.catch((e) => {
					console.error(e)
				})
		}

		return this.#renders[page] ?? {}
	}

	unsubscribe(gridId, page) {
		const subsForPage = this.#subs[page]
		if (subsForPage && subsForPage.size > 0) {
			subsForPage.delete(gridId)

			socketEmitPromise(this.#socket, 'preview:page:unsubscribe', [page]).catch((e) => {
				console.error(e)
			})
		}

		delete this.#renders[page]
		this.emit('page', page, {})
	}
}

/**
 * Load and retrieve a page from the shared button render cache
 * @param {ButtonRenderCache} cacheContext The cache to use
 * @param {string} sessionId Unique id of this accessor
 * @param {number | undefined} page Page number to load and retrieve
 * @param {voolean | undefined} disable Disable loading of this page
 * @returns
 */
export function useSharedRenderCache(cacheContext, sessionId, page, disable = false) {
	const [imagesState, setImagesState] = useState({})

	useEffect(() => {
		const page2 = Number(page)
		if (!isNaN(page2) && !disable) {
			const updateImages = (page2, images) => {
				if (page === page2) setImagesState(images)
			}

			cacheContext.on('page', updateImages)

			cacheContext.subscribe(sessionId, page2)

			return () => {
				cacheContext.off('page', updateImages)

				cacheContext.unsubscribe(sessionId, page2)
			}
		}
	}, [cacheContext, sessionId, page, disable])

	return imagesState
}

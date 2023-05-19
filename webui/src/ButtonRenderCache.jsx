import { useEffect, useState } from 'react'
import { EventEmitter } from 'events'
import { BlackImage, dataToButtonImage } from './Components/ButtonPreview'
import { MAX_BUTTONS } from './Constants'
import { socketEmitPromise } from './util'
import { CreateBankControlId } from '@companion/shared/ControlId'

/**
 * The main cache store
 * It should be instantiated once and stored in a Context.
 * Accessing values must be done via useSharedPageRenderCache to get the correct reactivity
 */
export class ButtonRenderCache extends EventEmitter {
	#socket

	#pageRenders = {}
	#bankRenders = {}
	#pageSubs = {}
	#bankSubs = {}

	constructor(socket) {
		super()
		this.#socket = socket

		// TODO - this will leak if the Memo re-evaluates
		socket.on('preview:page-bank', this.#bankChange.bind(this))
	}

	#bankChange(page, controlId, render) {
		page = Number(page)
		if (isNaN(page)) return

		const newImage = dataToButtonImage(render)

		const subsForPage = this.#pageSubs[page]
		if (subsForPage && subsForPage.size) {
			const newImages = {
				...this.#pageRenders[page],
				[controlId]: newImage,
			}
			this.#pageRenders[page] = newImages

			// TODO - debounce?
			this.emit('page', page, newImages)
		}

		const subsForBank = this.#bankSubs[controlId]
		if (subsForBank && subsForBank.size > 0) {
			this.#bankRenders[controlId] = newImage

			// TODO - debounce?
			this.emit('bank', controlId, newImage)
		}
	}

	subscribePage(gridId, page) {
		let subsForPage = this.#pageSubs[page]
		if (!subsForPage) subsForPage = this.#pageSubs[page] = new Set()

		const doSubscribe = subsForPage.size === 0

		subsForPage.add(gridId)

		if (doSubscribe) {
			socketEmitPromise(this.#socket, 'preview:page:subscribe', [page])
				.then((data) => {
					const newImages = {}
					for (let key = 1; key <= MAX_BUTTONS; ++key) {
						const controlId = CreateBankControlId(page, key)
						if (data[controlId]) {
							newImages[controlId] = dataToButtonImage(data[controlId])
						}
					}
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

	subscribeBank(sessionId, controlId) {
		if (!controlId) return

		let subsForBank = this.#bankSubs[controlId]
		if (!subsForBank) subsForBank = this.#bankSubs[controlId] = new Set()

		const doSubscribe = subsForBank.size === 0

		subsForBank.add(sessionId)

		if (doSubscribe) {
			socketEmitPromise(this.#socket, 'preview:bank:subscribe', [controlId])
				.then((data) => {
					const newImage = dataToButtonImage(data)
					this.#bankRenders[controlId] = newImage

					this.emit('bank', controlId, newImage)
				})
				.catch((e) => {
					console.error(e)
				})
			return undefined
		} else {
			return this.#bankRenders[controlId]
		}
	}

	unsubscribeBank(sessionId, controlId) {
		if (!controlId) return

		const subsForBank = this.#bankSubs[controlId]
		if (subsForBank && subsForBank.size > 0) {
			subsForBank.delete(sessionId)

			if (subsForBank.size === 0) {
				socketEmitPromise(this.#socket, 'preview:bank:unsubscribe', [controlId]).catch((e) => {
					console.error(e)
				})

				delete this.#bankRenders[controlId]
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

/**
 * Load and retrieve a page from the shared button render cache
 * @param {ButtonRenderCache} cacheContext The cache to use
 * @param {string} sessionId Unique id of this accessor
 * @param {string | undefined} controlId Id of the control to load and retrieve
 * @param {boolean | undefined} disable Disable loading of this page
 * @returns
 */
export function useSharedBankRenderCache(cacheContext, sessionId, controlId, disable = false) {
	const [imageState, setImageState] = useState(BlackImage)

	useEffect(() => {
		if (!disable) {
			setImageState(BlackImage)

			const updateImage = (controlId2, image) => {
				if (controlId === controlId2) setImageState(image ?? BlackImage)
			}

			cacheContext.on('bank', updateImage)

			const initialImages = cacheContext.subscribeBank(sessionId, controlId)
			if (initialImages) setImageState(initialImages)

			return () => {
				cacheContext.off('bank', updateImage)

				cacheContext.unsubscribeBank(sessionId, controlId)
			}
		}
	}, [cacheContext, sessionId, controlId, disable])

	return imageState
}

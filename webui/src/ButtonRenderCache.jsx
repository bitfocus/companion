import { useEffect, useState } from 'react'
import { EventEmitter } from 'events'
import { dataToButtonImage } from './Components/ButtonPreview'
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
		socket.on('preview:page-bank', this.bankChange.bind(this))
	}

	bankChange(page, bank, render) {
		const subsForPage = this.#pageSubs[page]
		if (subsForPage && subsForPage.size) {
			const newImage = dataToButtonImage(render)
			const newImages = {
				...this.#pageRenders[page],
				[bank]: newImage,
			}
			this.#pageRenders[page] = newImages

			// TODO - debounce?
			this.emit('page', page, newImages)
			this.emit('bank', page, bank, newImage)
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
						if (data[key]) {
							newImages[key] = dataToButtonImage(data[key])
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

	subscribeBank(sessionId, page, bank) {
		const id = CreateBankControlId(page, bank)
		let subsForBank = this.#bankSubs[id]
		if (!subsForBank) subsForBank = this.#bankSubs[id] = new Set()

		const doSubscribe = subsForBank.size === 0

		subsForBank.add(sessionId)

		if (doSubscribe) {
			socketEmitPromise(this.#socket, 'preview:bank:subscribe', [page, bank])
				.then((data) => {
					const newImage = dataToButtonImage(data)
					this.#bankRenders[CreateBankControlId(page, bank)] = newImage

					this.emit('bank', page, bank, newImage)
				})
				.catch((e) => {
					console.error(e)
				})
			return undefined
		} else {
			return this.#bankRenders[id]
		}
	}

	unsubscribeBank(sessionId, page, bank) {
		const id = CreateBankControlId(page, bank)
		const subsForBank = this.#bankRenders[id]
		if (subsForBank && subsForBank.size > 0) {
			subsForBank.delete(sessionId)

			if (subsForBank.size === 0) {
				socketEmitPromise(this.#socket, 'preview:bank:unsubscribe', [page, bank]).catch((e) => {
					console.error(e)
				})

				delete this.#bankRenders[id]
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
 * @param {number | undefined} page Page number to load and retrieve
 * @param {number | undefined} bank Bank number to load and retrieve
 * @param {boolean | undefined} disable Disable loading of this page
 * @returns
 */
export function useSharedBankRenderCache(cacheContext, sessionId, page, bank, disable = false) {
	const [imageState, setImageState] = useState({})

	useEffect(() => {
		const page2 = Number(page)
		const bank2 = Number(bank)
		if (!isNaN(page2) && !isNaN(bank2) && !disable) {
			const updateImage = (page3, bank3, image) => {
				if (page3 === page2 && bank3 === bank2) setImageState(image)
			}

			cacheContext.on('bank', updateImage)

			const initialImages = cacheContext.subscribeBank(sessionId, page2, bank2)
			if (initialImages) setImageState(initialImages)

			return () => {
				cacheContext.off('bank', updateImage)

				cacheContext.unsubscribeBank(sessionId, page2, bank2)
			}
		}
	}, [cacheContext, sessionId, page, bank, disable])

	return imageState
}

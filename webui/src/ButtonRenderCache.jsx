import { useEffect, useState } from 'react'
import { EventEmitter } from 'events'
import { BlackImage, dataToButtonImage } from './Components/ButtonPreview'
import { FormatPageAndCoordinate, socketEmitPromise } from './util'
import { MAX_COLS, MAX_ROWS } from './Constants'
import { cloneDeep } from 'lodash-es'

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

	#bankChange(location, render) {
		location.pageNumber = Number(location.pageNumber)
		if (isNaN(location.pageNumber)) return

		const newImage = dataToButtonImage(render)

		const subsForPage = this.#pageSubs[location.pageNumber]
		if (subsForPage && subsForPage.size) {
			const newImages = { ...this.#pageRenders[location.pageNumber] }
			newImages[location.row] = {
				...newImages[location.row],
				[location.column]: newImage,
			}
			this.#pageRenders[location.pageNumber] = newImages

			// TODO - debounce?
			this.emit('page', location.pageNumber, newImages)
		}

		const id = FormatPageAndCoordinate(location)
		const subsForBank = this.#bankSubs[id]
		if (subsForBank && subsForBank.size > 0) {
			this.#bankRenders[id] = newImage

			// TODO - debounce?
			this.emit('bank', location, newImage)
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
					for (let y = 0; y < MAX_ROWS; ++y) {
						const srcImages = data[y]
						if (!srcImages) continue

						const rowImages = (newImages[y] = {})
						for (let x = 0; x < MAX_COLS; ++x) {
							if (srcImages[x]) {
								rowImages[x] = dataToButtonImage(srcImages[x])
							}
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

	subscribeBank(sessionId, location) {
		const id = FormatPageAndCoordinate(location)

		let subsForBank = this.#bankSubs[id]
		if (!subsForBank) subsForBank = this.#bankSubs[id] = new Set()

		const doSubscribe = subsForBank.size === 0

		subsForBank.add(sessionId)

		if (doSubscribe) {
			socketEmitPromise(this.#socket, 'preview:bank:subscribe', [location])
				.then((data) => {
					const newImage = dataToButtonImage(data)
					this.#bankRenders[id] = newImage

					this.emit('bank', location, newImage)
				})
				.catch((e) => {
					console.error(e)
				})
			return undefined
		} else {
			return this.#bankRenders[id]
		}
	}

	unsubscribeBank(sessionId, location) {
		const id = FormatPageAndCoordinate(location)

		const subsForBank = this.#bankSubs[id]
		if (subsForBank && subsForBank.size > 0) {
			subsForBank.delete(sessionId)

			if (subsForBank.size === 0) {
				socketEmitPromise(this.#socket, 'preview:bank:unsubscribe', [location]).catch((e) => {
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
 * @param {string | undefined} controlId Id of the control to load and retrieve
 * @param {boolean | undefined} disable Disable loading of this page
 * @returns
 */
export function useSharedBankRenderCache(cacheContext, sessionId, location, disable = false) {
	const [imageState, setImageState] = useState(BlackImage)

	useEffect(() => {
		if (!disable && location) {
			// Make sure we have a copy
			location = cloneDeep(location)

			setImageState(BlackImage)

			const updateImage = (location2, image) => {
				// Note: intentionally loose comparison
				if (
					location2.pageNumber == location.pageNumber &&
					location2.column == location.column &&
					location2.row == location.row
				)
					setImageState(image ?? BlackImage)
			}

			cacheContext.on('bank', updateImage)

			const initialImages = cacheContext.subscribeBank(sessionId, location)
			if (initialImages) setImageState(initialImages)

			return () => {
				cacheContext.off('bank', updateImage)

				cacheContext.unsubscribeBank(sessionId, location)
			}
		}
	}, [cacheContext, sessionId, location, disable])

	return imageState
}

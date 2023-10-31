/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 *
 */

class ImageWriteQueue {
	/**
	 * Images currently being processed
	 * @type {Set<number | string>}
	 * @access private
	 * @readonly
	 */
	#inProgress = new Set()

	/**
	 * Maximum number of images to process concurrently
	 * @type {number}
	 * @access private
	 * @readonly
	 */
	#maxConcurrent = 3

	/**
	 * Images pending being processed
	 * @type {{ key: number | string, args: any[] }[]}
	 * @access private
	 * @readonly
	 */
	#pendingImages = []

	/**
	 * @param {import('winston').Logger} logger
	 * @param {Function} callback
	 * @param {number=} maxConcurrent
	 */
	constructor(logger, callback, maxConcurrent) {
		this.logger = logger
		this.callback = callback

		if (maxConcurrent !== undefined) this.#maxConcurrent = maxConcurrent
	}

	/**
	 * Queue an operation for the queue
	 * @param {number | string} key
	 * @param {...any} args Arguments for the callback
	 */
	queue(key, ...args) {
		let updated = false
		// Try and replace an existing queued image first
		for (const img of this.#pendingImages) {
			if (img.key === key) {
				img.args = args
				updated = true
				break
			}
		}

		// If key isnt queued, then append
		if (!updated) {
			this.#pendingImages.push({ key: key, args: args })
		}

		this.#tryDequeue()
	}

	/**
	 * Try executing the next image in the queue
	 */
	#tryDequeue() {
		// Start another if not too many in progress
		if (this.#inProgress.size <= this.#maxConcurrent && this.#pendingImages.length > 0) {
			// Find first image where key is not being worked on
			const nextImageIndex = this.#pendingImages.findIndex((img) => !this.#inProgress.has(img.key))
			if (nextImageIndex === -1) {
				return
			}

			const nextImage = this.#pendingImages[nextImageIndex]
			this.#pendingImages.splice(nextImageIndex, 1)
			if (!nextImage) {
				return
			}

			// Track which key is being processed
			this.#inProgress.add(nextImage.key)

			this.callback(nextImage.key, ...nextImage.args)
				.catch((/** @type {any} */ e) => {
					// Ensure it doesnt error out
					this.logger.silly('fillImage error:', e)
				})
				.then(() => {
					// Stop tracking key
					this.#inProgress.delete(nextImage.key)

					// Run again
					setImmediate(() => {
						this.#tryDequeue()
					})
				})
		}
	}
}

export default ImageWriteQueue

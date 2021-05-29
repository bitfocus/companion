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
	debug = require('debug')('Resource/ImageWriteQueue')

	constructor(fillImage) {
		this.maxConcurrent = 3

		this.fillImage = fillImage
		this.pendingImages = []
		this.inProgress = []
	}

	queue(key, buffer) {
		let updated = false
		// Try and replace an existing queued image first
		for (const img of this.pendingImages) {
			if (img.key === key) {
				img.buffer = buffer
				updated = true
				break
			}
		}

		// If key isnt queued, then append
		if (!updated) {
			this.pendingImages.push({ key: key, buffer: buffer })
		}

		this.tryDequeue()
	}

	tryDequeue() {
		// Start another if not too many in progress
		if (this.inProgress.length <= this.maxConcurrent && this.pendingImages.length > 0) {
			// Find first image where key is not being worked on
			const nextImageIndex = this.pendingImages.findIndex((img) => this.inProgress.indexOf(img.key) === -1)

			if (nextImageIndex === -1) {
				return
			}

			const nextImage = this.pendingImages[nextImageIndex]
			this.pendingImages.splice(nextImageIndex, 1)

			if (!nextImage) {
				return
			}

			// Track which key is being processed
			this.inProgress.push(nextImage.key)

			this.fillImage(nextImage.key, nextImage.buffer)
				.catch((e) => {
					// Ensure it doesnt error out
					this.debug('fillImage error:', e)
				})
				.then(() => {
					// Stop tracking key
					this.inProgress = this.inProgress.filter((k) => k !== nextImage.key)

					// Run again
					setImmediate(() => {
						this.tryDequeue()
					})
				})
		}
	}
}

exports = module.exports = ImageWriteQueue

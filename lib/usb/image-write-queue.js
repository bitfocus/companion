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

var debug = require('debug')('lib/usb/image_write_queue')

function image_write_queue(fillImage) {
	var self = this

	self.maxConcurrent = 3

	self.fillImage = fillImage
	self.pendingImages = []
	self.inProgress = []
}
image_write_queue.prototype.queue = function (key, buffer) {
	var self = this

	let updated = false
	// Try and replace an existing queued image first
	for (const img of self.pendingImages) {
		if (img.key === key) {
			img.buffer = buffer
			updated = true
			break
		}
	}

	// If key isnt queued, then append
	if (!updated) {
		self.pendingImages.push({ key: key, buffer: buffer })
	}

	self.tryDequeue()
}
image_write_queue.prototype.tryDequeue = function () {
	var self = this

	// Start another if not too many in progress
	if (self.inProgress.length <= self.maxConcurrent && self.pendingImages.length > 0) {
		// Find first image where key is not being worked on
		const nextImageIndex = self.pendingImages.findIndex((img) => self.inProgress.indexOf(img.key) === -1)
		if (nextImageIndex === -1) {
			return
		}

		const nextImage = self.pendingImages[nextImageIndex]
		self.pendingImages.splice(nextImageIndex, 1)
		if (!nextImage) {
			return
		}

		// Track which key is being processed
		self.inProgress.push(nextImage.key)

		self
			.fillImage(nextImage.key, nextImage.buffer)
			.catch((e) => {
				// Ensure it doesnt error out
				debug('fillImage error:', e)
			})
			.then(() => {
				// Stop tracking key
				self.inProgress = self.inProgress.filter((k) => k !== nextImage.key)

				// Run again
				setImmediate(() => {
					self.tryDequeue()
				})
			})
	}
}

exports = module.exports = image_write_queue

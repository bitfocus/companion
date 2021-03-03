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

var util = require('util')
var debug = require('debug')('lib/usb/elgato_xl')
var elgato_base = require('./elgato-base')
var sharp = require('sharp')
var image_write_queue = require('./image-write-queue')

function elgato_xl(system, devicepath) {
	var self = this

	elgato_base.apply(this, [system, devicepath, 'Elgato Streamdeck XL'])

	self.write_queue = new image_write_queue(function (key, buffer) {
		return sharp(buffer, { raw: { width: 72, height: 72, channels: 3 } })
			.resize(96, 96)
			.raw()
			.toBuffer()
			.catch(function (e) {
				self.system.emit('log', 'device(' + self.serialnumber + ')', 'debug', `scale image failed: ${e}`)
				self.system.emit('elgatodm_remove_device', self.devicepath)
			})
			.then(function (newbuffer) {
				if (newbuffer) {
					self.streamDeck.fillImage(key, newbuffer)
				}
			})
			.catch(function (e) {
				self.system.emit('log', 'device(' + self.serialnumber + ')', 'debug', `fillImage failed: ${e}`)
				self.system.emit('elgatodm_remove_device', self.devicepath)
			})
	})

	return self
}
elgato_xl.device_type = 'StreamDeck XL'

elgato_xl.prototype.draw = function (key, buffer, ts) {
	var self = this

	buffer = self.handleBuffer(buffer)

	self.write_queue.queue(key, buffer)

	return true
}

util.inherits(elgato_xl, elgato_base)

exports = module.exports = elgato_xl

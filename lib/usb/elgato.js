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
var debug = require('debug')('lib/usb/elgato')
var elgato_base = require('./elgato-base')

function elgato(system, devicepath) {
	var self = this

	elgato_base.apply(this, [system, devicepath, 'Elgato Streamdeck'])

	return self
}
elgato.device_type = 'StreamDeck'

elgato.prototype.draw = function (key, buffer, attempts) {
	var self = this

	// null/undefined => 0
	attempts = ~~attempts

	if (attempts === 0) {
		buffer = self.handleBuffer(buffer)
	}

	attempts++

	var drawKey = self.toDeviceKey(key)

	try {
		if (drawKey !== undefined && drawKey >= 0 && drawKey < self.info.keysTotal) {
			self.streamDeck.fillImage(drawKey, buffer)
		}

		return true
	} catch (e) {
		self.log('StreamDeck USB Exception: ' + e.message)

		if (attempts > 2) {
			self.log('Giving up USB device ' + self.devicepath)
			self.system.emit('elgatodm_remove_device', self.devicepath)

			return false
		}

		setTimeout(self.draw.bind(self), 20, key, buffer, attempts)
		// alternatively a setImmediate() or nextTick()
	}
}

util.inherits(elgato, elgato_base)

exports = module.exports = elgato

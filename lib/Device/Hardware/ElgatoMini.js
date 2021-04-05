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

var DeviceHardwareElgatoBase = require('./ElgatoBase')

var debug = require('debug')('Device/Hardware/ElgatoMini')
var sharp = require('sharp')
var ImageWriteQueue = require('../../Resources/ImageWriteQueue')

class DeviceHardwareElgatoMini extends DeviceHardwareElgatoBase {
	static deviceType = 'StreamDeck Mini'

	constructor(system, devicepath) {
		super(system, devicepath, 'Elgato Streamdeck Mini')

		this.write_queue = new ImageWriteQueue((key, buffer) => {
			return sharp(buffer, { raw: { width: 72, height: 72, channels: 3 } })
				.resize(80, 80)
				.raw()
				.toBuffer()
				.catch((e) => {
					this.system.emit('log', 'device(' + this.serialnumber + ')', 'debug', `scale image failed: ${e}`)
					this.system.emit('device_remove', this.devicepath)
				})
				.then((newbuffer) => {
					if (newbuffer) {
						this.streamDeck.fillImage(key, newbuffer)
					}
				})
				.catch((e) => {
					this.system.emit('log', 'device(' + this.serialnumber + ')', 'debug', `fillImage failed: ${e}`)
					this.system.emit('device_remove', this.devicepath)
				})
		})
	}

	draw(key, buffer) {
		var button = this.toDeviceKey(key)

		if (button < 0 || button >= 6) {
			return true
		}

		buffer = this.handleBuffer(buffer)

		this.write_queue.queue(button, buffer)

		return true
	}
}

exports = module.exports = DeviceHardwareElgatoMini

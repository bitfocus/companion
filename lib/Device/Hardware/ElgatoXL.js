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

var debug = require('debug')('Device/Hardware/ElgatoXL')
var sharp = require('sharp')
var ImageWriteQueue = require('../Resources/ImageWriteQueue')

class DeviceHardwareElgatoXL extends DeviceHardwareElgatoBase {
	static deviceType = 'StreamDeck XL'

	constructor(system, devicepath) {
		super(system, devicepath, 'Elgato Streamdeck XL')

		this.write_queue = new ImageWriteQueue((key, buffer) => {
			return sharp(buffer, { raw: { width: 72, height: 72, channels: 3 } })
				.resize(96, 96)
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

		return this
	}

	draw(key, buffer, ts) {
		buffer = this.handleBuffer(buffer)

		this.write_queue.queue(key, buffer)

		return true
	}
}

exports = module.exports = DeviceHardwareElgatoXL

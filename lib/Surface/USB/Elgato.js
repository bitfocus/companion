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

const SurfaceUSBElgatoBase = require('./ElgatoBase')

class SurfaceUSBElgato extends SurfaceUSBElgatoBase {
	debug = require('debug')('lib/Surface/USB/Elgato')

	constructor(system, devicepath) {
		super(system, devicepath, 'Elgato Streamdeck')
	}

	draw(key, buffer, style, attempts) {
		// null/undefined => 0
		attempts = ~~attempts

		if (attempts === 0) {
			buffer = this.handleBuffer(buffer)
		}

		attempts++

		let drawKey = this.toDeviceKey(key)

		try {
			if (drawKey !== undefined && drawKey >= 0 && drawKey < this.info.keysTotal) {
				this.streamDeck.fillImage(drawKey, buffer)
			}

			return true
		} catch (e) {
			this.log('StreamDeck USB Exception: ' + e.message)

			if (attempts > 2) {
				this.log('Giving up USB device ' + this.devicepath)
				this.system.emit('elgatodm_remove_device', this.devicepath)

				return false
			}

			setTimeout(this.draw.bind(this), 20, key, buffer, style, attempts)
			// alternatively a setImmediate() or nextTick()
		}
	}
}

exports = module.exports = SurfaceUSBElgato

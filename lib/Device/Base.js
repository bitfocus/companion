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

class DeviceBase {
	constructor() {}

	checkKeyValues() {
		if (this.keysTotal === undefined) {
			this.keysTotal = this.info.keysTotal
		}

		if (this.keysPerRow === undefined) {
			this.keysPerRow = this.info.keysPerRow
		}
	}

	getConfig() {
		this.log('getConfig')

		return this.config
	}

	handleBuffer(buffer) {
		if (buffer.type == 'Buffer') {
			buffer = Buffer.from(buffer.data)
		}

		if (buffer === undefined || buffer.length != 15552) {
			this.log('buffer was not 15552, but ' + buffer.length)
			var args = [].slice.call(arguments)
			return false
		}

		if (this.config.rotation === -90) {
			var buf = Buffer.alloc(15552)

			for (var x = 0; x < 72; ++x) {
				for (var y = 0; y < 72; ++y) {
					buf.writeUIntBE(buffer.readUIntBE(x * 72 * 3 + y * 3, 3), y * 72 * 3 + (71 - x) * 3, 3)
				}
			}
			buffer = buf
		}

		if (this.config.rotation === 180) {
			var buf = Buffer.alloc(15552)

			for (var x = 0; x < 72; ++x) {
				for (var y = 0; y < 72; ++y) {
					buf.writeUIntBE(buffer.readUIntBE(x * 72 * 3 + y * 3, 3), (71 - x) * 72 * 3 + (71 - y) * 3, 3)
				}
			}
			buffer = buf
		}

		if (this.config.rotation === 90) {
			var buf = Buffer.alloc(15552)

			for (var x = 0; x < 72; ++x) {
				for (var y = 0; y < 72; ++y) {
					buf.writeUIntBE(buffer.readUIntBE(x * 72 * 3 + y * 3, 3), (71 - y) * 72 * 3 + x * 3, 3)
				}
			}
			buffer = buf
		}

		return buffer
	}

	log() {
		console.log.apply(console, arguments)
	}

	// From Global key number 0->31, to Device key f.ex 0->14
	// 0-4 would be 0-4, but 5-7 would be -1
	// and 8-12 would be 5-9
	toDeviceKey(key) {
		if (this.keysTotal == global.MAX_BUTTONS) {
			return key
		}

		if (key % global.MAX_BUTTONS_PER_ROW > this.keysPerRow) {
			return -1
		}

		var row = Math.floor(key / global.MAX_BUTTONS_PER_ROW)
		var col = key % global.MAX_BUTTONS_PER_ROW

		if (row >= this.keysTotal / this.keysPerRow || col >= this.keysPerRow) {
			return -1
		}

		return row * this.keysPerRow + col
	}

	// From device key number to global key number
	// Reverse of toDeviceKey
	toGlobalKey(key) {
		var rows = Math.floor(key / this.keysPerRow)
		var col = key % this.keysPerRow

		return rows * global.MAX_BUTTONS_PER_ROW + col
	}
}

exports = module.exports = DeviceBase

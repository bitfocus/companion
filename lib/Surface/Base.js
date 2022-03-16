import { toDeviceKey, toGlobalKey } from '../Resources/Util.js'

class SurfaceBase {
	constructor() {}

	// From Global key number 0->31, to Device key f.ex 0->14
	// 0-4 would be 0-4, but 5-7 would be -1
	// and 8-12 would be 5-9
	toDeviceKey(key) {
		return toDeviceKey(this.keysTotal, this.keysPerRow, key)
	}

	// From device key number to global key number
	// Reverse of toDeviceKey
	toGlobalKey(key) {
		return toGlobalKey(this.keysPerRow, key)
	}

	handleBuffer(buffer) {
		if (this.config.rotation === -90) {
			let buf = Buffer.alloc(15552)

			for (let x = 0; x < 72; ++x) {
				for (let y = 0; y < 72; ++y) {
					buf.writeUIntBE(buffer.readUIntBE(x * 72 * 3 + y * 3, 3), y * 72 * 3 + (71 - x) * 3, 3)
				}
			}
			buffer = buf
		}

		if (this.config.rotation === 180) {
			let buf = Buffer.alloc(15552)

			for (let x = 0; x < 72; ++x) {
				for (let y = 0; y < 72; ++y) {
					buf.writeUIntBE(buffer.readUIntBE(x * 72 * 3 + y * 3, 3), (71 - x) * 72 * 3 + (71 - y) * 3, 3)
				}
			}
			buffer = buf
		}

		if (this.config.rotation === 90) {
			let buf = Buffer.alloc(15552)

			for (let x = 0; x < 72; ++x) {
				for (let y = 0; y < 72; ++y) {
					buf.writeUIntBE(buffer.readUIntBE(x * 72 * 3 + y * 3, 3), (71 - y) * 72 * 3 + x * 3, 3)
				}
			}
			buffer = buf
		}

		return buffer
	}
}

export default SurfaceBase

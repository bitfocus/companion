/*
 * This file is part of the Companion project
 * Copyright (c) 2023 Peter Newman
 * Author: Peter Newman
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

import shuttleControlUSB from 'shuttle-control-usb'
import util from 'util'
const setTimeoutPromise = util.promisify(setTimeout)

const shuttleXpressInfo = {
	// Treat as:
	// 3 buttons
	// button, two encoders (jog and shuttle), button
	// Map the encoders in the same position (but a different row) for consistency and compatibility
	totalCols: 4,
	totalRows: 2,

	// TODO(Someone with hardware): This mapping is guesswork and hasn't been tested
	encoders: [5, 6],
	buttons: [4, 0, 1, 2, 7],
}
const shuttleProV1Info = {
	// Same as Pro V2 only without the buttons either side of the encoders
	// Map the same for consistency and compatibility
	totalCols: 5,
	totalRows: 4,

	// TODO(Someone with hardware): This mapping is guesswork and hasn't been tested
	encoders: [11, 12],
	buttons: [0, 1, 2, 3, 5, 6, 7, 8, 9, 15, 18, 16, 17],
}
const shuttleProV2Info = {
	// 4 buttons
	// 5 buttons
	// button, two encoders (jog and shuttle), button
	// 2 buttons (combine with the row below)
	// 2 buttons
	totalCols: 5,
	totalRows: 4,

	encoders: [11, 12],
	buttons: [0, 1, 2, 3, 5, 6, 7, 8, 9, 15, 18, 16, 17, 10, 13],
}

const encoders = Object.freeze({
	JOG: 1,
	SHUTTLE: 2,
})

function buttonToIndex(modelInfo, info) {
	const index = modelInfo.buttons[info - 1]
	if (index !== undefined) {
		return index
	}

	return undefined
}

function rotaryToButtonIndex(modelInfo, info) {
	const index = modelInfo.encoders[info - 1]
	if (index !== undefined) {
		return index
	}

	return undefined
}

class SurfaceUSBShuttle {
	constructor(ipcWrapper, devicepath, shuttle, modelInfo, deviceInfo) {
		this.ipcWrapper = ipcWrapper
		this.shuttle = shuttle
		this.deviceInfo = deviceInfo
		this.modelInfo = modelInfo

		this.config = {
			// No config currently present
		}

		this.ipcWrapper.log('debug', `Adding Contour Shuttle USB device ${devicepath}`)

		this.info = {
			type: `Shuttle ${this.deviceInfo.name}`,
			devicepath: devicepath,
			configFields: [],
			keysPerRow: this.modelInfo.totalCols,
			keysTotal: this.modelInfo.totalCols * this.modelInfo.totalRows,
			deviceId: `shuttle:${this.deviceInfo.id}`,
		}

		this.shuttle.on('error', (error) => {
			console.error(error)
			this.ipcWrapper.remove()
		})

		this.shuttle.on('buttondown', (info) => {
			const keyIndex = buttonToIndex(this.modelInfo, info) ?? rotaryToButtonIndex(this.modelInfo, info)
			if (keyIndex === undefined) {
				return
			}

			this.ipcWrapper.click(keyIndex, true)
		})

		this.shuttle.on('buttonup', (info) => {
			const keyIndex = buttonToIndex(this.modelInfo, info) ?? rotaryToButtonIndex(this.modelInfo, info)
			if (keyIndex === undefined) {
				return
			}

			this.ipcWrapper.click(keyIndex, false)
		})

		this.shuttle.on('jog-dir', (delta) => {
			const keyIndex = rotaryToButtonIndex(this.modelInfo, encoders.JOG)
			if (keyIndex === undefined) {
				return
			}

			this.ipcWrapper.rotate(keyIndex, delta == 1)
		})

		this.shuttle.on('shuttle-trans', (previous, current) => {
			const keyIndex = rotaryToButtonIndex(this.modelInfo, encoders.SHUTTLE)
			if (keyIndex === undefined) {
				return
			}

			this.ipcWrapper.rotate(keyIndex, previous < current)
		})

		this.shuttle.on('disconnect', (error) => {
			console.error(error)
			this.ipcWrapper.remove()
		})
	}

	async #init() {
		this.ipcWrapper.log('debug', `Contour Shuttle ${this.deviceInfo.name} detected`)
	}

	static async create(ipcWrapper, devicepath) {
		const shuttle = shuttleControlUSB
		// We're doing device search via Companion so don't run it here too
		shuttle.start(false)
		try {
			let deviceInfo = null
			let info = null
			shuttle.connect(devicepath)
			deviceInfo = shuttle.getDeviceByPath(devicepath)
			switch (deviceInfo.name) {
				case 'ShuttleXpress':
					info = shuttleXpressInfo
					break
				case 'ShuttlePro v1':
					info = shuttleProV1Info
					break
				case 'ShuttlePro v2':
					info = shuttleProV2Info
					break
				default:
					this.ipcWrapper.log('debug', `Unknown Contour Shuttle device detected: ${this.deviceInfo.name}`)
			}
			if (!info) {
				throw new Error('Unsupported model ')
			}

			const self = new SurfaceUSBShuttle(ipcWrapper, devicepath, shuttle, info, deviceInfo)

			await self.#init()

			return self
		} catch (e) {
			shuttle.stop()

			throw e
		}
	}

	setConfig(config, force) {
		// No config currently present
		this.config = config
	}

	quit() {
		try {
			this.clearDeck()
		} catch (e) {}

		this.shuttle.close()
	}

	draw() {
		// Should never be fired
	}

	clearDeck() {
		// Not relevant for this device
	}
}

export default SurfaceUSBShuttle

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
	// TODO(Peter): Populate this info
	/*	totalCols: 8,
	totalRows: 4,

	encoders: [0, 8, 16, 7, 15, 23],
	buttons: [24, 25, 26, 27, 28, 29, 30, 31],*/
}
const shuttleProV1Info = {
	// TODO(Peter): Populate this info
	/*	totalCols: 7,
	totalRows: 3,

	encoders: [0, 7],
	buttons: [14, 6, 13, 20],*/
}
const shuttleProV2Info = {
	// TODO(Peter): Improve this mapping
	totalCols: 5,
	totalRows: 3,

	encoders: [16],
	buttons: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
}

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
			console.log('button down', info)
			const keyIndex = buttonToIndex(this.modelInfo, info) ?? rotaryToButtonIndex(this.modelInfo, info)
			console.log('button down key index', keyIndex)
			if (keyIndex === undefined) {
				return
			}

			this.ipcWrapper.click(keyIndex, true)
		})

		this.shuttle.on('buttonup', (info) => {
			console.log('button up', info)
			const keyIndex = buttonToIndex(this.modelInfo, info) ?? rotaryToButtonIndex(this.modelInfo, info)
			console.log('button up key index', keyIndex)
			if (keyIndex === undefined) {
				return
			}

			this.ipcWrapper.click(keyIndex, false)
		})
		this.shuttle.on('jog', (info, delta) => {
			const keyIndex = rotaryToButtonIndex(this.modelInfo, info)
			if (keyIndex === undefined) {
				return
			}

			this.ipcWrapper.rotate(keyIndex, delta == 1)
		})

		this.shuttle.on('disconnect', (error) => {
			console.error(error)
			this.ipcWrapper.remove()
		})
	}

	async #init() {
		this.ipcWrapper.log('debug', `Contour Shuttle ${this.deviceInfo.name} detected`)

		// Make sure the first clear happens properly
		// TODO(Peter): Is this required?
		//await this.loupedeck.blankDevice(true, true)
	}

	static async create(ipcWrapper, devicepath) {
		const shuttle = shuttleControlUSB
		shuttle.start()
		try {
			let deviceInfo = null
			let info = null
			deviceInfo = shuttle.getDeviceByPath(devicepath)
			console.log(deviceInfo)
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
			console.log('Got info', info)
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
		this.ipcWrapper.log('debug', 'shuttle.clearDeck()')

		this.shuttle.blankDevice(true, true).catch((e) => {
			this.ipcWrapper.log('debug', `blank failed: ${e}`)
		})
	}
}

export default SurfaceUSBShuttle

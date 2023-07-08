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

import CoreBase from '../Core/Base.js'
import { toDeviceKey, toGlobalKey } from '../Resources/Util.js'
import { CreateBankControlId } from '../Shared/ControlId.js'
import { cloneDeep } from 'lodash-es'

const PINCODE_NUMBER_POSITIONS = [12, 17, 18, 19, 9, 10, 11, 1, 2, 3]
const PINCODE_CODE_POSITION = 8

class SurfaceHandler extends CoreBase {
	static PanelDefaults = {
		// defaults from the panel - TODO properly
		brightness: 100,
		rotation: 0,

		// companion owned defaults
		use_last_page: true,
		never_lock: false,
		page: 1,
		xOffset: 0,
		yOffset: 0,
	}

	/**
	 * Current pincode entry if locked
	 */
	currentPincodeEntry = ''

	/** Currently pressed buttons, and what they are keeping pressed  */
	#currentButtonPresses = {}

	/**
	 * Whether the surface is currently locked
	 */
	isSurfaceLocked = false

	/**
	 * Calculated info about the panel
	 */
	panelInfo = {
		xOffsetMax: 0,
		yOffsetMax: 0,
	}

	/**
	 * Xkeys: How many pages of colours it has asked for
	 */
	#xkeysPageCount = 0

	constructor(registry, integrationType, panel, isLocked) {
		super(registry, `device(${panel.info.deviceId})`, `Surface/Handler/${panel.info.deviceId}`)
		this.logger.silly('loading for ' + panel.info.devicepath)

		this.panel = panel
		this.isSurfaceLocked = isLocked
		this.pincodeNumberPositions = PINCODE_NUMBER_POSITIONS
		this.pincodeCodePosition = PINCODE_CODE_POSITION

		// some surfaces need different positions for the pincode numbers
		if (
			this.panel.info.type === 'Loupedeck Live' ||
			this.panel.info.type === 'Loupedeck Live S' ||
			this.panel.info.type === 'Razer Stream Controller' ||
			this.panel.info.type === 'Razer Stream Controller X'
		) {
			this.pincodeNumberPositions = [13, 18, 19, 20, 10, 11, 12, 2, 3, 4]
			this.pincodeCodePosition = 21
		}
		if (this.panel.info.type === 'Loupedeck CT') {
			this.pincodeNumberPositions = [13, 18, 19, 20, 10, 11, 12, 2, 3, 4]
			this.pincodeCodePosition = 35
		}

		this.currentPage = 1 // The current page of the device

		// Fill in max offsets
		const keysPerRow = this.panel.info.keysPerRow || 0
		const keysTotal = this.panel.info.keysTotal || 0
		if (keysPerRow && keysTotal) {
			const maxRows = Math.ceil(global.MAX_BUTTONS / global.MAX_BUTTONS_PER_ROW)
			this.panelInfo.xOffsetMax = Math.max(Math.floor(global.MAX_BUTTONS_PER_ROW - keysPerRow), 0)
			this.panelInfo.yOffsetMax = Math.max(Math.floor(maxRows - Math.ceil(keysTotal / keysPerRow)), 0)
		}

		{
			const rawConfig = this.db.getKey('deviceconfig', {})
			this.panelconfig = rawConfig[this.deviceId]
			if (!this.panelconfig) {
				this.panelconfig = {}
				this.logger.silly(`Creating config for newly discovered device ${this.deviceId}`)

				rawConfig[this.deviceId] = this.panelconfig
				this.db.setKey('deviceconfig', rawConfig)
			} else {
				this.logger.silly(`Reusing config for device ${this.deviceId} was on page ${this.currentPage}`)
			}
		}

		// Persist the type in the db for use when it is disconnected
		this.panelconfig.type = this.panel.info.type || 'Unknown'
		this.panelconfig.integrationType = integrationType

		if (!this.panelconfig.config) {
			this.panelconfig.config = cloneDeep(SurfaceHandler.PanelDefaults)
		}

		if (this.panelconfig.config.xOffset === undefined || this.panelconfig.config.yOffset === undefined) {
			// Fill in missing default offsets
			this.panelconfig.config.xOffset = 0
			this.panelconfig.config.yOffset = 0
		}

		if (this.panelconfig.config.use_last_page === undefined) {
			// Fill in the new field based on previous behaviour:
			// If a page had been chosen, then it would start on that
			this.panelconfig.config.use_last_page = this.panelconfig.config.page === undefined
		}

		if (this.panelconfig.config.use_last_page) {
			if (this.panelconfig.page !== undefined) {
				// use last page if defined
				this.currentPage = this.panelconfig.page
			}
		} else {
			if (this.panelconfig.config.page !== undefined) {
				// use startup page if defined
				this.currentPage = this.panelconfig.page = this.panelconfig.config.page
			}
		}

		if (this.panelconfig.config.never_lock) {
			// if device can't be locked, then make sure it isnt already locked
			this.isSurfaceLocked = false
		}

		this.onBankInvalidated = this.onBankInvalidated.bind(this)

		this.graphics.on('bank_invalidated', this.onBankInvalidated)

		this.panel.on('click', this.#onDeviceClick.bind(this))
		this.panel.on('rotate', this.#onDeviceRotate.bind(this))
		this.panel.on('remove', this.#onDeviceRemove.bind(this))

		// subscribe to some xkeys specific events
		this.panel.on('xkeys-subscribePage', this.#onXkeysSubscribePages.bind(this))
		this.panel.on('xkeys-setVariable', this.#onXkeysSetVariable.bind(this))

		setImmediate(() => {
			this.saveConfig()

			if (this.panel.setConfig) {
				const config = this.panelconfig.config
				this.panel.setConfig(config, true)
			}

			this.surfaces.emit('surface_page', this.deviceId, this.currentPage)

			this.drawPage()
		})
	}

	get deviceId() {
		return this.panel.info.deviceId
	}

	#deviceIncreasePage() {
		this.currentPage++
		if (this.currentPage >= 100) {
			this.currentPage = 1
		}
		if (this.currentPage <= 0) {
			this.currentPage = 99
		}

		this.#storeNewDevicePage(this.currentPage)
	}

	#deviceDecreasePage() {
		this.currentPage--
		if (this.currentPage >= 100) {
			this.currentPage = 1
		}
		if (this.currentPage <= 0) {
			this.currentPage = 99
		}

		this.#storeNewDevicePage(this.currentPage)
	}

	drawPage() {
		if (this.panel) {
			if (this.isSurfaceLocked) {
				const buffers = this.graphics.getImagesForPincode(this.currentPincodeEntry)
				this.panel.clearDeck()
				this.#drawButton(this.pincodeCodePosition, buffers.code.buffer)

				this.pincodeNumberPositions.forEach((key, i) => {
					if (buffers[i]) {
						this.#drawButton(key, buffers[i].buffer)
					}
				})
			} else if (this.#xkeysPageCount > 0) {
				this.#xkeysDrawPages()
			} else if (this.panel.info.type === 'Loupedeck CT') {
				for (let i = 0; i < 56; ++i) {
					// Note: the maths looks inverted, but it goes through the toDeviceKey still
					const key = i
					const pageOffset = Math.floor(i / 32)
					const image = this.graphics.getBank(this.currentPage + pageOffset, (i % 32) + 1)
					this.#drawButton(key, image.buffer, image.style)
				}
			} else {
				const xOffset = Math.min(Math.max(this.panelconfig.config.xOffset || 0, 0), this.panelInfo.xOffsetMax)
				const yOffset = Math.min(Math.max(this.panelconfig.config.yOffset || 0, 0), this.panelInfo.yOffsetMax)

				for (let i = 0; i < global.MAX_BUTTONS; ++i) {
					// Note: the maths looks inverted, but it goes through the toDeviceKey still
					const key = i - xOffset - yOffset * global.MAX_BUTTONS_PER_ROW

					const image = this.graphics.getBank(this.currentPage, i + 1)
					this.#drawButton(key, image.buffer, image.style)
				}
			}
		}
	}

	#drawButton(key, buffer, style) {
		const localKey = toDeviceKey(this.panel.info.keysTotal, this.panel.info.keysPerRow, key)
		if (localKey >= 0 && localKey < this.panel.info.keysTotal) {
			this.panel.draw(localKey, buffer, style)
		}
	}

	getPanelConfig() {
		return this.panelconfig.config
	}

	getPanelInfo() {
		return this.panelInfo
	}

	setLocked(locked) {
		// skip if surface can't be locked
		if (this.panelconfig.config.never_lock) return

		// If it changed, redraw
		if (this.isSurfaceLocked != locked) {
			this.isSurfaceLocked = !!locked

			this.drawPage()
		}
	}

	onBankInvalidated(page, bank, render) {
		// If device is locked ignore updates. pincode updates are handled separately
		if (this.isSurfaceLocked) return

		if (this.#xkeysPageCount > 0) {
			// xkeys mode
			const pageOffset = page - this.currentPage
			if (pageOffset >= 0 && pageOffset < this.#xkeysPageCount) {
				this.panel.drawColor(pageOffset, bank, render.style?.bgcolor || 0)
			}
		} else if (
			this.panel.info.type === 'Loupedeck CT' &&
			(page - this.currentPage == 1 || (page == 1 && this.currentPage == 99)) &&
			bank <= 24
		) {
			// Loupdeck CT lower half, draw buttun with number offset by 32
			this.#drawButton(bank + 31, render.buffer, render.style)
		} else if (page == this.currentPage) {
			// normal mode
			const xOffset = Math.min(Math.max(this.panelconfig.config.xOffset || 0, 0), this.panelInfo.xOffsetMax)
			const yOffset = Math.min(Math.max(this.panelconfig.config.yOffset || 0, 0), this.panelInfo.yOffsetMax)

			// Note: the maths looks inverted, but it goes through the toDeviceKey still
			const key = bank - 1 - xOffset - yOffset * global.MAX_BUTTONS_PER_ROW

			this.#drawButton(key, render.buffer, render.style)
		}
	}

	setBrightness(brightness) {
		if (this.panel) {
			if (this.panel.setConfig) {
				const config = {
					...this.panelconfig.config,
					brightness: brightness,
				}

				setImmediate(() => {
					this.panel.setConfig(config)
				})
			}
		}
	}

	#onDeviceRemove() {
		if (this.panel) {
			this.surfaces.removeDevice(this.panel.info.devicepath)
		}
	}

	#onDeviceClick(key, pressed, pageOffset) {
		if (this.panel) {
			key = toGlobalKey(this.panel.info.keysPerRow, key)

			if (!this.isSurfaceLocked) {
				this.emit('interaction')

				// Translate key for offset
				const xOffset = Math.min(Math.max(this.panelconfig.config.xOffset || 0, 0), this.panelInfo.xOffsetMax)
				const yOffset = Math.min(Math.max(this.panelconfig.config.yOffset || 0, 0), this.panelInfo.yOffsetMax)

				// Note: the maths looks inverted, but its already been through toGlobalKey
				key = parseInt(key) + xOffset + yOffset * global.MAX_BUTTONS_PER_ROW

				let thisPage = this.currentPage

				if (pressed) {
					// Track what page was pressed for this key
					this.#currentButtonPresses[key] = thisPage
				} else {
					// Release the same page that was previously pressed
					thisPage = this.#currentButtonPresses[key] ?? thisPage
					delete this.#currentButtonPresses[key]
				}

				// allow the xkeys to span pages
				thisPage += pageOffset ?? 0

				const controlId = CreateBankControlId(thisPage, key + 1)
				this.controls.pressControl(controlId, pressed, this.deviceId)
				this.logger.debug('Button ' + thisPage + '.' + (key + 1) + ' ' + (pressed ? 'pressed' : 'released'))
			} else {
				if (pressed) {
					const pressCode = this.pincodeNumberPositions.indexOf(key)
					if (pressCode !== -1) {
						this.currentPincodeEntry += pressCode.toString()
					}

					if (this.currentPincodeEntry == this.userconfig.getKey('pin').toString()) {
						this.isSurfaceLocked = false
						this.currentPincodeEntry = ''

						this.emit('unlocked')

						this.drawPage()
					} else if (this.currentPincodeEntry.length >= this.userconfig.getKey('pin').toString().length) {
						this.currentPincodeEntry = ''
					}
				}

				if (this.isSurfaceLocked) {
					// Update lockout button
					const datap = this.graphics.getImagesForPincode(this.currentPincodeEntry)
					this.#drawButton(this.pincodeCodePosition, datap.code.buffer)
				}
			}
		}
	}

	#onDeviceRotate(key, direction, pageOffset) {
		if (this.panel) {
			key = toGlobalKey(this.panel.info.keysPerRow, key)

			if (!this.isSurfaceLocked) {
				this.emit('interaction')

				// Translate key for offset
				const xOffset = Math.min(Math.max(this.panelconfig.config.xOffset || 0, 0), this.panelInfo.xOffsetMax)
				const yOffset = Math.min(Math.max(this.panelconfig.config.yOffset || 0, 0), this.panelInfo.yOffsetMax)

				// Note: the maths looks inverted, but its already been through toGlobalKey
				key = parseInt(key) + xOffset + yOffset * global.MAX_BUTTONS_PER_ROW

				let thisPage = this.currentPage

				// allow the xkeys to span pages
				thisPage += pageOffset ?? 0

				const controlId = CreateBankControlId(thisPage, key + 1)
				this.controls.rotateControl(controlId, direction, this.deviceId)
				this.logger.debug('Rotary ' + thisPage + '.' + (key + 1) + ' rotated ' + (direction ? 'right' : 'left'))
			} else {
				// Ignore when locked out
			}
		}
	}

	#onXkeysSubscribePages(pageCount) {
		this.#xkeysPageCount = pageCount

		this.#xkeysDrawPages()
	}

	#xkeysDrawPages() {
		for (let page = 0; page < this.#xkeysPageCount; page++) {
			for (let bank = 0; bank < global.MAX_BUTTONS; bank++) {
				const render = this.graphics.getBank(this.currentPage + page, bank)

				this.panel.drawColor(page, bank, render.style?.bgcolor || 0)
			}
		}
	}

	#onXkeysSetVariable(name, value) {
		this.instance.variable.setVariableValues('internal', {
			[name]: value,
		})
	}

	doPageDown() {
		if (this.userconfig.getKey('page_direction_flipped') === true) {
			this.#deviceIncreasePage()
		} else {
			this.#deviceDecreasePage()
		}
	}

	setCurrentPage(page, defer = false) {
		this.currentPage = page
		if (this.currentPage == 100) {
			this.currentPage = 1
		}
		if (this.currentPage == 0) {
			this.currentPage = 99
		}
		this.#storeNewDevicePage(this.currentPage, defer)
	}

	getCurrentPage() {
		return this.currentPage
	}

	doPageUp() {
		if (this.userconfig.getKey('page_direction_flipped') === true) {
			this.#deviceDecreasePage()
		} else {
			this.#deviceIncreasePage()
		}
	}

	resetConfig() {
		this.setPanelConfig(cloneDeep(SurfaceHandler.PanelDefaults))
	}

	saveConfig() {
		const deviceConfig = this.db.getKey('deviceconfig', {})
		deviceConfig[this.deviceId] = this.panelconfig
		this.db.setKey('deviceconfig', deviceConfig)
	}

	setPanelConfig(newconfig) {
		if (!newconfig.use_last_page && newconfig.page !== undefined && newconfig.page !== this.panelconfig.config.page) {
			// Startup page has changed, so change over to it
			this.#storeNewDevicePage(newconfig.page)
		}

		let redraw = false
		if (newconfig.xOffset != this.panelconfig.config.xOffset || newconfig.yOffset != this.panelconfig.config.yOffset)
			redraw = true
		if (newconfig.rotation != this.panelconfig.config.rotation) redraw = true

		if (newconfig.never_lock && newconfig.never_lock != this.panelconfig.config.never_lock) {
			this.isSurfaceLocked = false
			redraw = true
		}

		this.panelconfig.config = newconfig
		this.saveConfig()

		if (this.panel.setConfig) {
			this.panel.setConfig(newconfig)
		}

		if (redraw) {
			this.drawPage()
		}
	}

	setPanelName(newname) {
		if (typeof newname === 'string') {
			this.panelconfig.name = newname

			// save it
			this.saveConfig()
		}
	}

	#storeNewDevicePage(newpage, defer = false) {
		this.panelconfig.page = this.currentPage = newpage
		this.saveConfig()

		this.surfaces.emit('surface_page', this.deviceId, newpage)

		if (defer) {
			setImmediate(() => {
				this.drawPage()
			})
		} else {
			this.drawPage()
		}
	}

	unload(purge) {
		this.logger.error(this.panel.info.type + ' disconnected')
		this.logger.silly('unloading for ' + this.panel.info.devicepath)
		this.graphics.off('bank_invalidated', this.onBankInvalidated)

		try {
			this.panel.quit()
		} catch (e) {}

		const deviceId = this.deviceId

		delete this.panel.device
		delete this.panel

		if (purge && deviceId) {
			this.panelconfig = undefined

			const deviceConfig = this.db.getKey('deviceconfig', {})
			delete deviceConfig[deviceId]
			this.db.setKey('deviceconfig', deviceConfig)
		}
	}
}

export default SurfaceHandler

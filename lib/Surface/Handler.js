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
import debug0 from 'debug'
import { toDeviceKey, toGlobalKey } from '../Resources/Util.js'

class SurfaceHandler extends CoreBase {
	debug = debug0('lib/Surface/Handler')

	constructor(registry, panel) {
		super(registry, `device(${panel.serialnumber})`, `lib/Surface/Handler/${panel.serialnumber}`)
		this.debug('loading for ' + panel.info.devicepath)

		this.panel = panel
		this.isSurfaceLocked = this.userconfig.getKey('pin_enable')

		this.lastinteraction = Date.now()
		this.lockoutat = Date.now()
		this.currentpin = ''
		this.devicepath = panel.info.devicepath
		this.currentPage = 1 // The current page of the device
		this.lastpress = ''
		this.lastpage = 0
		this.deviceconfig = this.db.getKey('deviceconfig', {})
		this.panelconfig = {}
		this.panelinfo = {}

		this.panelinfo = {
			xOffsetMax: 0,
			yOffsetMax: 0,
		}

		// Fill in max offsets
		const keysPerRow = this.panel.info.keysPerRow || 0
		const keysTotal = this.panel.info.keysTotal || 0
		if (keysPerRow && keysTotal) {
			const maxRows = Math.ceil(global.MAX_BUTTONS / global.MAX_BUTTONS_PER_ROW)
			this.panelinfo.xOffsetMax = Math.max(Math.floor(global.MAX_BUTTONS_PER_ROW - keysPerRow), 0)
			this.panelinfo.yOffsetMax = Math.max(Math.floor(maxRows - Math.ceil(keysTotal / keysPerRow)), 0)
		}

		if (!this.deviceconfig[this.panel.info.serialnumber]) {
			this.deviceconfig[(this.panel.info, serialnumber)] = this.panelconfig = {}
			this.debug(`Creating config for newly discovered device ${this.panel.info.serialnumber}`)
		} else {
			this.debug(`Reusing config for device ${this.panel.info.serialnumber} was on page ${this.currentPage}`)
		}

		// Load existing config
		this.panelconfig = this.deviceconfig[this.panel.info.serialnumber]
		if (!this.panelconfig.config) {
			this.panelconfig.config = {
				// defaults from the panel - TODO properly
				brightness: 100,
				rotation: 0,

				// companion owned defaults
				use_last_page: true,
				page: 1,
				xOffset: 0,
				yOffset: 0,
			}
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

		this.onBankInvalidated = this.onBankInvalidated.bind(this)

		this.system.on('graphics_bank_invalidated', this.onBankInvalidated)

		this.timeouttimer = setInterval(() => {
			if (
				this.userconfig.getKey('pin_timeout') != 0 &&
				this.userconfig.getKey('pin_enable') == true &&
				Date.now() >= this.lockoutat &&
				!this.isSurfaceLocked
			) {
				if (this.userconfig.getKey('link_lockouts')) {
					this.system.emit('lockoutall')
				} else {
					this.isSurfaceLocked = true
					this.drawPage()
				}
			}
			if (this.isSurfaceLocked && !this.userconfig.getKey('pin_enable')) {
				this.isSurfaceLocked = false
				this.drawPage()
			}
		}, 1000)

		this.onDeviceClick = this.onDeviceClick.bind(this)

		this.system.on('device_click', this.onDeviceClick)

		setImmediate(() => {
			if (this.panel.setConfig) {
				const config = this.panelconfig.config
				this.panel.setConfig(config, true)
			}

			this.drawPage()
		})
	}

	get deviceId() {
		return this.panel.info.serialnumber
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
		if (!this.isSurfaceLocked) {
			const data = this.graphics.getImagesForPage(this.currentPage)

			const xOffset = Math.min(Math.max(this.panelconfig.config.xOffset || 0, 0), this.panelinfo.xOffsetMax)
			const yOffset = Math.min(Math.max(this.panelconfig.config.yOffset || 0, 0), this.panelinfo.yOffsetMax)

			for (let i in data) {
				// Note: the maths looks inverted, but it goes through the toDeviceKey still
				const key = i - xOffset - yOffset * global.MAX_BUTTONS_PER_ROW

				this.#drawButton(key, data[i].buffer, data[i].style)
			}
		} else {
			/* TODO: We should move this to the device module */
			const datap = this.graphics.getImagesForPincode(this.currentpin)
			this.panel.clearDeck()
			this.#drawButton(12, datap[0].buffer)
			this.#drawButton(17, datap[1].buffer)
			this.#drawButton(18, datap[2].buffer)
			this.#drawButton(19, datap[3].buffer)
			this.#drawButton(9, datap[4].buffer)
			this.#drawButton(10, datap[5].buffer)
			this.#drawButton(11, datap[6].buffer)
			this.#drawButton(1, datap[7].buffer)
			this.#drawButton(2, datap[8].buffer)
			this.#drawButton(3, datap[9].buffer)
			this.#drawButton(8, datap[10].buffer)
		}
	}

	#drawButton(key, buffer, style) {
		const localKey = toDeviceKey(this.panel.info.keysTotal, this.panel.info.keysPerRow, key)
		if (localKey >= 0 && localKey < this.panel.info.keysTotal) {
			this.panel.draw(localKey, buffer, style)
		}
	}

	getDeviceInfo() {
		return {
			id: this.panel.info.serialnumber || '',
			type: this.panel.info.type || '',
			name: this.panelconfig.name || '',
			configFields: this.panel.info.configFields || [], // config fields
		}
	}

	getPanelConfig() {
		return this.panelconfig.config
	}

	getPanelInfo() {
		return this.panelinfo
	}

	setLocked(locked) {
		if (!locked) {
			// Reset timers for next auto-lock
			this.lastinteraction = Date.now()
			this.lockoutat = this.userconfig.getKey('pin_timeout') * 1000 + Date.now()
		}

		// If it changed, redraw
		if (this.isSurfaceLocked != locked) {
			this.isSurfaceLocked = !!locked

			this.drawPage()
		}
	}

	quit() {
		this.unload()
	}

	onBankInvalidated(page, bank) {
		this.updateBank(page, bank)
	}

	setBrightness(brightness) {
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

	onDeviceClick(devicepath, key, state) {
		if (devicepath != this.devicepath) {
			return
		}
		if (!this.isSurfaceLocked) {
			key = toGlobalKey(this.panel.info.keysPerRow, key)

			this.lastinteraction = Date.now()
			this.lockoutat = this.userconfig.getKey('pin_timeout') * 1000 + Date.now()

			// Translate key for offset
			const xOffset = Math.min(Math.max(this.panelconfig.config.xOffset || 0, 0), this.panelinfo.xOffsetMax)
			const yOffset = Math.min(Math.max(this.panelconfig.config.yOffset || 0, 0), this.panelinfo.yOffsetMax)

			// Note: the maths looks inverted, but its already been through toGlobalKey
			key = parseInt(key) + xOffset + yOffset * global.MAX_BUTTONS_PER_ROW

			let thispress = this.deviceId + '_' + this.currentPage
			if (state) {
				this.lastpress = thispress
				this.lastpage = this.currentPage
			} else if (thispress != this.lastpress) {
				// page changed on this device before button released
				// release the old page+bank
				this.bank.action.pressBank(this.lastpage, key + 1, false, this.deviceId)
				this.lastpress = ''
				return
			} else {
				this.lastpress = ''
			}

			this.bank.action.pressBank(this.currentPage, key + 1, state, this.deviceId)
			this.log('debug', 'Button ' + this.currentPage + '.' + (key + 1) + ' ' + (state ? 'pressed' : 'released'))
		} else {
			if (state) {
				const decode = [12, 17, 18, 19, 9, 10, 11, 1, 2, 3]

				if (decode.indexOf(key).toString() != -1) {
					this.currentpin += decode.indexOf(key).toString()
				}

				if (this.currentpin == this.userconfig.getKey('pin').toString()) {
					this.isSurfaceLocked = false
					this.currentpin = ''
					this.lastinteraction = Date.now()
					this.lockoutat = this.userconfig.getKey('pin_timeout') * 1000 + Date.now()

					this.drawPage()

					if (this.userconfig.getKey('link_lockouts')) {
						this.system.emit('unlockoutall')
					}
				} else if (this.currentpin.length >= this.userconfig.getKey('pin').toString().length) {
					this.currentpin = ''
				}
			}

			if (this.isSurfaceLocked) {
				// Update lockout button
				const datap = this.graphics.getImagesForPincode(this.currentpin)
				this.#drawButton(8, datap[10].buffer)
			}
		}
	}

	doPageDown() {
		if (this.userconfig.getKey('page_direction_flipped') === true) {
			this.#deviceIncreasePage()
		} else {
			this.#deviceDecreasePage()
		}
	}

	setCurrentPage(page) {
		this.currentPage = page
		if (this.currentPage == 100) {
			this.currentPage = 1
		}
		if (this.currentPage == 0) {
			this.currentPage = 99
		}
		this.#storeNewDevicePage(this.currentPage)
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

	setPanelConfig(newconfig) {
		if (!newconfig.use_last_page && newconfig.page !== undefined && newconfig.page !== this.panelconfig.config.page) {
			// Startup page has changed, so change over to it
			this.#storeNewDevicePage(newconfig.page)
		}

		let redraw = false
		if (newconfig.xOffset != this.panelconfig.config.xOffset || newconfig.yOffset != this.panelconfig.config.yOffset)
			redraw = true
		if (newconfig.rotation != this.panelconfig.config.rotation) redraw = true

		this.panelconfig.config = newconfig
		this.db.setKey('deviceconfig', this.deviceconfig)

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
			this.db.setKey('deviceconfig', this.deviceconfig)
		}
	}

	#storeNewDevicePage(newpage) {
		this.panelconfig.page = this.currentPage = newpage
		this.db.setKey('deviceconfig', this.deviceconfig)

		this.drawPage()
	}

	unload() {
		this.log('error', this.panel.info.type + ' disconnected')
		this.debug('unloading for ' + this.devicepath)
		this.system.removeListener('graphics_bank_invalidated', this.onBankInvalidated)
		this.system.removeListener('device_click', this.onDeviceClick)

		try {
			this.panel.quit()
		} catch (e) {}

		delete this.panel.device
		delete this.panel
	}

	updateBank(page, bank) {
		// If device is locked ignore updates. pincode updates are handled separately
		if (!this.isSurfaceLocked) {
			let img = this.graphics.getBank(page, bank)

			if (page == this.currentPage) {
				const xOffset = Math.min(Math.max(this.panelconfig.config.xOffset || 0, 0), this.panelinfo.xOffsetMax)
				const yOffset = Math.min(Math.max(this.panelconfig.config.yOffset || 0, 0), this.panelinfo.yOffsetMax)

				// Note: the maths looks inverted, but it goes through the toDeviceKey still
				const key = bank - 1 - xOffset - yOffset * global.MAX_BUTTONS_PER_ROW

				// 12-Jan-2020: was wrapped with setImmediate
				// which delays the button draw.
				// if the page changed, the old button gfx gets put on the new page
				this.#drawButton(key, img.buffer, img.style)
			}
		}
	}
}

export default SurfaceHandler

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

exports = module.exports = function (system, panel) {
	return new SurfaceHandler(system, panel)
}

class SurfaceHandler {
	debug = require('debug')('lib/Surface/Handler')

	constructor(system, panel) {
		this.system = system
		this.debug('loading for ' + panel.devicepath)

		this.panel = panel
		this.lockedout = true
		this.lastinteraction = Date.now()
		this.lockoutat = Date.now()
		this.currentpin = ''
		this.devicepath = panel.devicepath
		this.page = 1 // The current page of the device
		this.lastpress = ''
		this.lastpage = 0
		this.userconfig = {}
		this.deviceconfig = {}
		this.panelconfig = {}
		this.panelinfo = {}

		this.system.emit('db_get', 'deviceconfig', (res) => {
			if (res !== undefined && res !== null) {
				this.deviceconfig = res
			} else {
				// Make sure we have a working reference
				this.deviceconfig = {}
				this.system.emit('db_set', 'deviceconfig', this.deviceconfig)
			}
		})

		this.panelinfo = {
			xOffsetMax: 0,
			yOffsetMax: 0,
		}

		// Fill in max offsets
		const keysPerRow = this.panel.keysPerRow || 0
		const keysTotal = this.panel.keysTotal || 0
		if (keysPerRow && keysTotal) {
			const maxRows = Math.ceil(global.MAX_BUTTONS / global.MAX_BUTTONS_PER_ROW)
			this.panelinfo.xOffsetMax = Math.max(Math.floor(global.MAX_BUTTONS_PER_ROW - keysPerRow), 0)
			this.panelinfo.yOffsetMax = Math.max(Math.floor(maxRows - Math.ceil(keysTotal / keysPerRow)), 0)
		}

		if (!this.deviceconfig[this.panel.serialnumber]) {
			this.deviceconfig[this.panel.serialnumber] = this.panelconfig = {}
			this.debug(`Creating config for newly discovered device ${this.panel.serialnumber}`)
		} else {
			this.debug(`Reusing config for device ${this.panel.serialnumber} was on page ${this.page}`)
		}

		// Load existing config
		this.panelconfig = this.deviceconfig[this.panel.serialnumber]
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
				this.page = this.panelconfig.page
			}
		} else {
			if (this.panelconfig.config.page !== undefined) {
				// use startup page if defined
				this.page = this.panelconfig.page = this.panelconfig.config.page
			}
		}

		if (this.panel && this.panel.setConfig) {
			const config = this.panelconfig.config
			setImmediate(() => {
				this.panel.setConfig(config, (redraw) => {
					if (redraw) {
						// device wants a redraw
						this.drawPage()
					}
				})
			})
		}

		// get userconfig object
		this.system.emit('get_userconfig', (userconfig) => {
			this.userconfig = userconfig
		})

		this.lockedout = this.userconfig.pin_enable

		this.system.emit('graphics_get', (_graphics) => {
			this.graphics = _graphics
		})

		this.onBankInvalidated = this.onBankInvalidated.bind(this)
		this.lockoutAll = this.lockoutAll.bind(this)
		this.unlockoutAll = this.unlockoutAll.bind(this)

		this.system.on('graphics_bank_invalidated', this.onBankInvalidated)
		this.system.on('lockoutall', this.lockoutAll)
		this.system.on('unlockoutall', this.unlockoutAll)

		this.timeouttimer = setInterval(() => {
			if (
				this.userconfig.pin_timeout != 0 &&
				this.userconfig.pin_enable == true &&
				Date.now() >= this.lockoutat &&
				!this.lockedout
			) {
				if (this.userconfig.link_lockouts) {
					this.system.emit('lockoutall')
				} else {
					this.lockedout = true
					this.drawPage()
				}
			}
			if (this.lockedout && !this.userconfig.pin_enable) {
				this.lockedout = false
				this.drawPage()
			}
		}, 1000)

		this.onElgatoReady = this.onElgatoReady.bind(this)
		this.onDevicePageSet = this.onDevicePageSet.bind(this)
		this.onDevicePageGet = this.onDevicePageGet.bind(this)
		this.onDeviceBrightnessSet = this.onDeviceBrightnessSet.bind(this)
		this.lockoutDevice = this.lockoutDevice.bind(this)
		this.unlockoutDevice = this.unlockoutDevice.bind(this)
		this.onDevicePageDown = this.onDevicePageDown.bind(this)
		this.onDevicePageUp = this.onDevicePageUp.bind(this)
		this.onElgatoClick = this.onElgatoClick.bind(this)

		this.system.on('elgato_ready', this.onElgatoReady)
		this.system.on('device_page_set', this.onDevicePageSet)
		this.system.on('device_page_get', this.onDevicePageGet)
		this.system.on('device_brightness_set', this.onDeviceBrightnessSet)
		this.system.on('lockout_device', this.lockoutDevice)
		this.system.on('unlockout_device', this.unlockoutDevice)
		this.system.on('device_page_down', this.onDevicePageDown)
		this.system.on('device_page_up', this.onDevicePageUp)
		this.system.on('elgato_click', this.onElgatoClick)

		this.system.emit('bank_update_request')
	}

	deviceIncreasePage(deviceid) {
		if (this.panel.serialnumber == deviceid) {
			this.page++
			if (this.page >= 100) {
				this.page = 1
			}
			if (this.page <= 0) {
				this.page = 99
			}

			this.storeNewDevicePage(this.page)
		}
	}

	deviceDecreasePage(deviceid) {
		if (this.panel.serialnumber == deviceid) {
			this.page--
			if (this.page >= 100) {
				this.page = 1
			}
			if (this.page <= 0) {
				this.page = 99
			}

			this.storeNewDevicePage(this.page)
		}
	}

	drawPage() {
		if (!this.lockedout) {
			const data = this.graphics.getImagesForPage(this.page)

			const xOffset = Math.min(Math.max(this.panelconfig.config.xOffset || 0, 0), this.panelinfo.xOffsetMax)
			const yOffset = Math.min(Math.max(this.panelconfig.config.yOffset || 0, 0), this.panelinfo.yOffsetMax)

			for (let i in data) {
				// Note: the maths looks inverted, but it goes through the toDeviceKey still
				const key = i - xOffset - yOffset * global.MAX_BUTTONS_PER_ROW

				this.panel.draw(key, data[i].buffer, data[i].style)
			}
		} else {
			/* TODO: We should move this to the device module */
			const datap = this.graphics.getImagesForPincode(this.currentpin)
			this.panel.clearDeck()
			this.panel.draw(12, datap[0].buffer)
			this.panel.draw(17, datap[1].buffer)
			this.panel.draw(18, datap[2].buffer)
			this.panel.draw(19, datap[3].buffer)
			this.panel.draw(9, datap[4].buffer)
			this.panel.draw(10, datap[5].buffer)
			this.panel.draw(11, datap[6].buffer)
			this.panel.draw(1, datap[7].buffer)
			this.panel.draw(2, datap[8].buffer)
			this.panel.draw(3, datap[9].buffer)
			this.panel.draw(8, datap[10].buffer)
		}
	}

	getDeviceInfo() {
		return {
			id: this.panel.id || '',
			serialnumber: this.panel.serialnumber || '',
			type: this.panel.type || '',
			name: this.panelconfig.name || '',
			config: this.panel.config || [], // config fields
		}
	}

	getPanelConfig() {
		return this.panelconfig.config
	}

	getPanelInfo() {
		return this.panelinfo
	}

	lockoutAll() {
		this.lockedout = true
		this.drawPage()
	}

	lockoutDevice(deviceid) {
		if (this.panel.serialnumber == deviceid) {
			this.lockedout = true
			this.drawPage()
		}
	}

	quit() {
		this.unload()
	}

	onBankInvalidated(page, bank) {
		this.updateBank(page, bank)
	}

	onDeviceBrightnessSet(deviceid, brightness) {
		if (this.panel.serialnumber == deviceid) {
			const config = {
				...this.panelconfig.config,
				brightness: brightness,
			}

			setImmediate(() => {
				this.panel.setConfig(config, (redraw) => {})
			})
		}
	}

	onDevicePageDown(deviceid) {
		if (this.userconfig.page_direction_flipped === true) {
			this.deviceIncreasePage(deviceid)
		} else {
			this.deviceDecreasePage(deviceid)
		}
	}

	onDevicePageGet(deviceid, cb) {
		if (this.panel.serialnumber == deviceid) {
			cb(this.page)
		}
	}

	onDevicePageSet(deviceid, page) {
		if (this.panel.serialnumber == deviceid) {
			this.page = page
			if (this.page == 100) {
				this.page = 1
			}
			if (this.page == 0) {
				this.page = 99
			}
			this.storeNewDevicePage(this.page)
		}
	}

	onDevicePageUp(deviceid) {
		if (this.userconfig.page_direction_flipped === true) {
			this.deviceDecreasePage(deviceid)
		} else {
			this.deviceIncreasePage(deviceid)
		}
	}

	onElgatoClick(devicepath, key, state) {
		if (devicepath != this.devicepath) {
			return
		}
		if (!this.lockedout) {
			this.lastinteraction = Date.now()
			this.lockoutat = this.userconfig.pin_timeout * 1000 + Date.now()

			// Translate key for offset
			const xOffset = Math.min(Math.max(this.panelconfig.config.xOffset || 0, 0), this.panelinfo.xOffsetMax)
			const yOffset = Math.min(Math.max(this.panelconfig.config.yOffset || 0, 0), this.panelinfo.yOffsetMax)

			// Note: the maths looks inverted, but its already been through toGlobalKey
			key = parseInt(key) + xOffset + yOffset * global.MAX_BUTTONS_PER_ROW

			let thispress = this.panel.serialnumber + '_' + this.page
			if (state) {
				this.lastpress = thispress
				this.lastpage = this.page
			} else if (thispress != this.lastpress) {
				// page changed on this device before button released
				// release the old page+bank
				this.system.emit('bank_pressed', this.lastpage, key + 1, false, this.panel.serialnumber)
				this.lastpress = ''
				return
			} else {
				this.lastpress = ''
			}

			this.system.emit('bank_pressed', this.page, key + 1, state, this.panel.serialnumber)
			this.system.emit(
				'log',
				'device(' + this.panel.serialnumber + ')',
				'debug',
				'Button ' + this.page + '.' + (key + 1) + ' ' + (state ? 'pressed' : 'released')
			)
		} else {
			if (state) {
				const decode = [12, 17, 18, 19, 9, 10, 11, 1, 2, 3]

				if (decode.indexOf(key).toString() != -1) {
					this.currentpin += decode.indexOf(key).toString()
				}

				if (this.currentpin == this.userconfig.pin.toString()) {
					this.lockedout = false
					this.currentpin = ''
					this.lastinteraction = Date.now()
					this.lockoutat = this.userconfig.pin_timeout * 1000 + Date.now()

					this.drawPage()

					if (this.userconfig.link_lockouts) {
						this.system.emit('unlockoutall')
					}
				} else if (this.currentpin.length >= this.userconfig.pin.toString().length) {
					this.currentpin = ''
				}
			}

			if (this.lockedout) {
				// Update lockout button
				const datap = this.graphics.getImagesForPincode(this.currentpin)
				this.panel.draw(8, datap[10].buffer)
			}
		}
	}

	onElgatoReady(devicepath) {
		if (devicepath == this.devicepath) {
			this.panel.begin()
			this.drawPage()
		}
	}

	setPanelConfig(newconfig) {
		if (!newconfig.use_last_page && newconfig.page !== undefined && newconfig.page !== this.panelconfig.config.page) {
			// Startup page has changed, so change over to it
			this.storeNewDevicePage(newconfig.page)
		}

		let redraw = false
		if (newconfig.xOffset != this.panelconfig.config.xOffset || newconfig.yOffset != this.panelconfig.config.yOffset)
			redraw = true

		this.panelconfig.config = newconfig
		this.system.emit('db_set', 'deviceconfig', this.deviceconfig)
		this.system.emit('db_save')

		if (this.panel && this.panel.setConfig) {
			this.panel.setConfig(newconfig, (_redraw) => {
				if (redraw || _redraw) {
					// device wants a redraw
					this.drawPage()
				}
			})
		} else {
			if (redraw) {
				this.drawPage()
			}
		}
	}

	setPanelName(newname) {
		if (typeof newname === 'string') {
			this.panelconfig.name = newname

			// save it
			this.system.emit('db_set', 'deviceconfig', this.deviceconfig)
			this.system.emit('db_save')
		}
	}

	storeNewDevicePage(newpage) {
		this.panelconfig.page = this.page = newpage
		this.system.emit('db_set', 'deviceconfig', this.deviceconfig)
		this.system.emit('db_save')

		this.drawPage()
	}

	unload() {
		this.system.emit('log', 'device(' + this.panel.serialnumber + ')', 'error', this.panel.type + ' disconnected')
		this.debug('unloading for ' + this.devicepath)
		this.system.removeListener('graphics_bank_invalidated', this.onBankInvalidated)
		this.system.removeListener('elgato_ready', this.onElgatoReady)
		this.system.removeListener('elgato_click', this.onElgatoClick)
		this.system.removeListener('lockoutall', this.lockoutAll)
		this.system.removeListener('unlockoutall', this.unlockoutAll)
		this.system.removeListener('lockout_device', this.lockoutDevice)
		this.system.removeListener('unlockout_device', this.unlockoutDevice)
		this.system.removeListener('device_page_set', this.onDevicePageSet)
		this.system.removeListener('device_page_get', this.onDevicePageGet)
		this.system.removeListener('device_brightness_set', this.onDeviceBrightnessSet)
		this.system.removeListener('device_page_down', this.onDevicePageDown)
		this.system.removeListener('device_page_up', this.onDevicePageUp)

		try {
			this.panel.quit()
		} catch (e) {}

		delete this.panel.device
		delete this.panel
	}

	unlockoutAll() {
		this.lockedout = false
		this.lastinteraction = Date.now()
		this.lockoutat = this.userconfig.pin_timeout * 1000 + Date.now()
		this.drawPage()
	}

	unlockoutDevice(deviceid) {
		if (this.panel.serialnumber == deviceid) {
			this.lockedout = false
			this.lastinteraction = Date.now()
			this.lockoutat = this.userconfig.pin_timeout * 1000 + Date.now()
			this.drawPage()
		}
	}

	updateBank(page, bank) {
		// If device is locked ignore updates. pincode updates are handled separately
		if (!this.lockedout) {
			let img = this.graphics.getBank(page, bank)

			if (page == this.page) {
				const xOffset = Math.min(Math.max(this.panelconfig.config.xOffset || 0, 0), this.panelinfo.xOffsetMax)
				const yOffset = Math.min(Math.max(this.panelconfig.config.yOffset || 0, 0), this.panelinfo.yOffsetMax)

				// Note: the maths looks inverted, but it goes through the toDeviceKey still
				const key = bank - 1 - xOffset - yOffset * global.MAX_BUTTONS_PER_ROW

				// 12-Jan-2020: was wrapped with setImmediate
				// which delays the button draw.
				// if the page changed, the old button gfx gets put on the new page
				this.panel.draw(key, img.buffer, img.style)
			}
		}
	}
}

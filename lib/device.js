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

var system
var debug = require('debug')('lib/device')
var graphics

function device(_system, panel) {
	var self = this

	debug('loading for ' + panel.devicepath)

	system = _system
	self.panel = panel
	self.lockedout = true
	self.lastinteraction = Date.now()
	self.lockoutat = Date.now()
	self.currentpin = ''
	self.devicepath = panel.devicepath
	self.page = 1 // The current page of the device
	self.lastpress = ''
	self.lastpage = 0
	self.userconfig = {}
	self.deviceconfig = {}
	self.panelconfig = {}
	self.panelinfo = {}

	system.emit('db_get', 'deviceconfig', function (res) {
		if (res !== undefined && res !== null) {
			self.deviceconfig = res
		} else {
			// Make sure we have a working reference
			self.deviceconfig = {}
			system.emit('db_set', 'deviceconfig', self.deviceconfig)
		}
	})

	self.panelinfo = {
		xOffsetMax: 0,
		yOffsetMax: 0,
	}

	// Fill in max offsets
	const keysPerRow = self.panel.keysPerRow || 0
	const keysTotal = self.panel.keysTotal || 0
	if (keysPerRow && keysTotal) {
		const maxRows = Math.ceil(global.MAX_BUTTONS / global.MAX_BUTTONS_PER_ROW)
		self.panelinfo.xOffsetMax = Math.max(Math.floor(global.MAX_BUTTONS_PER_ROW - keysPerRow), 0)
		self.panelinfo.yOffsetMax = Math.max(Math.floor(maxRows - Math.ceil(keysTotal / keysPerRow)), 0)
	}

	if (!self.deviceconfig[self.panel.serialnumber]) {
		self.deviceconfig[self.panel.serialnumber] = self.panelconfig = {}
		debug(`Creating config for newly discovered device ${self.panel.serialnumber}`)
	} else {
		debug(`Reusing config for device ${self.panel.serialnumber} was on page ${self.page}`)
	}

	// Load existing config
	self.panelconfig = self.deviceconfig[self.panel.serialnumber]
	if (!self.panelconfig.config) {
		self.panelconfig.config = {
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

	if (self.panelconfig.config.xOffset === undefined || self.panelconfig.config.yOffset === undefined) {
		// Fill in missing default offsets
		self.panelconfig.config.xOffset = 0
		self.panelconfig.config.yOffset = 0
	}

	if (self.panelconfig.config.use_last_page === undefined) {
		// Fill in the new field based on previous behaviour:
		// If a page had been chosen, then it would start on that
		self.panelconfig.config.use_last_page = self.panelconfig.config.page === undefined
	}

	if (self.panelconfig.config.use_last_page) {
		if (self.panelconfig.page !== undefined) {
			// use last page if defined
			self.page = self.panelconfig.page
		}
	} else {
		if (self.panelconfig.config.page !== undefined) {
			// use startup page if defined
			self.page = self.panelconfig.page = self.panelconfig.config.page
		}
	}

	if (self.panel && self.panel.setConfig) {
		const config = self.panelconfig.config
		setImmediate(function () {
			self.panel.setConfig(config, function (redraw) {
				if (redraw) {
					// device wants a redraw
					self.drawPage()
				}
			})
		})
	}

	// get userconfig object
	system.emit('get_userconfig', function (userconfig) {
		self.userconfig = userconfig
	})

	self.lockedout = self.userconfig.pin_enable

	graphics = new require('./graphics')(system)

	self.on_bank_invalidated = function (page, bank) {
		self.updateBank(page, bank)
	}

	system.on('graphics_bank_invalidated', self.on_bank_invalidated)

	self.on_elgato_ready = function (devicepath) {
		if (devicepath == self.devicepath) {
			self.panel.begin()
			self.drawPage()
		}
	}

	self.lockoutAll = function () {
		self.lockedout = true
		self.drawPage()
	}

	self.unlockoutAll = function () {
		self.lockedout = false
		self.lastinteraction = Date.now()
		self.lockoutat = self.userconfig.pin_timeout * 1000 + Date.now()
		self.drawPage()
	}

	system.on('lockoutall', self.lockoutAll)

	system.on('unlockoutall', self.unlockoutAll)

	self.timeouttimer = setInterval(function () {
		if (
			self.userconfig.pin_timeout != 0 &&
			self.userconfig.pin_enable == true &&
			Date.now() >= self.lockoutat &&
			!self.lockedout
		) {
			if (self.userconfig.link_lockouts) {
				system.emit('lockoutall')
			} else {
				self.lockedout = true
				self.drawPage()
			}
		}
		if (self.lockedout && !self.userconfig.pin_enable) {
			self.lockedout = false
			self.drawPage()
		}
	}, 1000)

	system.on('elgato_ready', self.on_elgato_ready)

	self.on_device_page_set = function (deviceid, page) {
		if (self.panel.serialnumber == deviceid) {
			self.page = page
			if (self.page == 100) {
				self.page = 1
			}
			if (self.page == 0) {
				self.page = 99
			}
			self.storeNewDevicePage(self.page)
		}
	}
	system.on('device_page_set', self.on_device_page_set)

	self.on_device_page_get = function (deviceid, cb) {
		if (self.panel.serialnumber == deviceid) {
			cb(self.page)
		}
	}
	system.on('device_page_get', self.on_device_page_get)

	self.on_device_brightness_set = function (deviceid, brightness) {
		if (self.panel.serialnumber == deviceid && self.panel && self.panel.setConfig) {
			const config = {
				...self.panelconfig.config,
				brightness: brightness,
			}

			setImmediate(function () {
				self.panel.setConfig(config, function (redraw) {})
			})
		}
	}
	system.on('device_brightness_set', self.on_device_brightness_set)

	self.lockoutDevice = function (deviceid) {
		if (self.panel.serialnumber == deviceid) {
			self.lockedout = true
			self.drawPage()
		}
	}

	self.unlockoutDevice = function (deviceid) {
		if (self.panel.serialnumber == deviceid) {
			self.lockedout = false
			self.lastinteraction = Date.now()
			self.lockoutat = self.userconfig.pin_timeout * 1000 + Date.now()
			self.drawPage()
		}
	}

	system.on('lockout_device', self.lockoutDevice)

	system.on('unlockout_device', self.unlockoutDevice)

	self.on_device_page_down = function (deviceid) {
		if (self.userconfig.page_direction_flipped === true) {
			deviceIncreasePage(deviceid)
		} else {
			deviceDecreasePage(deviceid)
		}
	}
	system.on('device_page_down', self.on_device_page_down)

	self.on_device_page_up = function (deviceid) {
		if (self.userconfig.page_direction_flipped === true) {
			deviceDecreasePage(deviceid)
		} else {
			deviceIncreasePage(deviceid)
		}
	}
	system.on('device_page_up', self.on_device_page_up)

	function deviceIncreasePage(deviceid) {
		if (self.panel.serialnumber == deviceid) {
			self.page++
			if (self.page >= 100) {
				self.page = 1
			}
			if (self.page <= 0) {
				self.page = 99
			}

			self.storeNewDevicePage(self.page)
		}
	}

	function deviceDecreasePage(deviceid) {
		if (self.panel.serialnumber == deviceid) {
			self.page--
			if (self.page >= 100) {
				self.page = 1
			}
			if (self.page <= 0) {
				self.page = 99
			}

			self.storeNewDevicePage(self.page)
		}
	}

	self.on_elgato_click = function (devicepath, key, state) {
		if (devicepath != self.devicepath) {
			return
		}
		if (!self.lockedout) {
			self.lastinteraction = Date.now()
			self.lockoutat = self.userconfig.pin_timeout * 1000 + Date.now()

			// Translate key for offset
			const xOffset = Math.min(Math.max(self.panelconfig.config.xOffset || 0, 0), self.panelinfo.xOffsetMax)
			const yOffset = Math.min(Math.max(self.panelconfig.config.yOffset || 0, 0), self.panelinfo.yOffsetMax)

			// Note: the maths looks inverted, but its already been through toGlobalKey
			key = parseInt(key) + xOffset + yOffset * global.MAX_BUTTONS_PER_ROW

			var thispress = self.panel.serialnumber + '_' + self.page
			if (state) {
				self.lastpress = thispress
				self.lastpage = self.page
			} else if (thispress != self.lastpress) {
				// page changed on this device before button released
				// release the old page+bank
				system.emit('bank_pressed', self.lastpage, key + 1, false, self.panel.serialnumber)
				self.lastpress = ''
				return
			} else {
				self.lastpress = ''
			}

			system.emit('bank_pressed', self.page, key + 1, state, self.panel.serialnumber)
			system.emit(
				'log',
				'device(' + self.panel.serialnumber + ')',
				'debug',
				'Button ' + self.page + '.' + (key + 1) + ' ' + (state ? 'pressed' : 'released')
			)
		} else {
			if (state) {
				var decode = [12, 17, 18, 19, 9, 10, 11, 1, 2, 3]

				if (decode.indexOf(key).toString() != -1) {
					self.currentpin += decode.indexOf(key).toString()
				}

				if (self.currentpin == self.userconfig.pin.toString()) {
					self.lockedout = false
					self.currentpin = ''
					self.lastinteraction = Date.now()
					self.lockoutat = self.userconfig.pin_timeout * 1000 + Date.now()

					self.drawPage()

					if (self.userconfig.link_lockouts) {
						system.emit('unlockoutall')
					}
				} else if (self.currentpin.length >= self.userconfig.pin.toString().length) {
					self.currentpin = ''
				}
			}

			if (self.lockedout) {
				// Update lockout button
				const datap = graphics.getImagesForPincode(self.currentpin)
				self.panel.draw(8, datap[10].buffer)
			}
		}
	}
	system.on('elgato_click', self.on_elgato_click)

	system.emit('bank_update_request')
}

device.prototype.getDeviceInfo = function () {
	var self = this
	return {
		id: self.panel.id || '',
		serialnumber: self.panel.serialnumber || '',
		type: self.panel.type || '',
		name: self.panelconfig.name || '',
		config: self.panel.config || [], // config fields
	}
}
device.prototype.setPanelName = function (newname) {
	var self = this
	if (typeof newname === 'string') {
		self.panelconfig.name = newname

		// save it
		system.emit('db_set', 'deviceconfig', self.deviceconfig)
		system.emit('db_save')
	}
}

device.prototype.getPanelInfo = function () {
	var self = this
	return self.panelinfo
}
device.prototype.getPanelConfig = function () {
	var self = this
	return self.panelconfig.config
}
device.prototype.setPanelConfig = function (newconfig) {
	var self = this

	if (!newconfig.use_last_page && newconfig.page !== undefined && newconfig.page !== self.panelconfig.config.page) {
		// Startup page has changed, so change over to it
		self.storeNewDevicePage(newconfig.page)
	}

	let redraw = false
	if (newconfig.xOffset != self.panelconfig.config.xOffset || newconfig.yOffset != self.panelconfig.config.yOffset)
		redraw = true

	self.panelconfig.config = newconfig
	system.emit('db_set', 'deviceconfig', self.deviceconfig)
	system.emit('db_save')

	if (self.panel && self.panel.setConfig) {
		self.panel.setConfig(newconfig, function (_redraw) {
			if (redraw || _redraw) {
				// device wants a redraw
				self.drawPage()
			}
		})
	} else {
		if (redraw) {
			self.drawPage()
		}
	}
}

device.prototype.storeNewDevicePage = function (newpage) {
	var self = this

	self.panelconfig.page = self.page = newpage
	system.emit('db_set', 'deviceconfig', self.deviceconfig)
	system.emit('db_save')

	self.drawPage()
}

device.prototype.drawPage = function () {
	var self = this

	if (!self.lockedout) {
		const data = graphics.getImagesForPage(self.page)

		const xOffset = Math.min(Math.max(self.panelconfig.config.xOffset || 0, 0), self.panelinfo.xOffsetMax)
		const yOffset = Math.min(Math.max(self.panelconfig.config.yOffset || 0, 0), self.panelinfo.yOffsetMax)

		for (let i in data) {
			// Note: the maths looks inverted, but it goes through the toDeviceKey still
			const key = i - xOffset - yOffset * global.MAX_BUTTONS_PER_ROW

			let pressed = false
			system.emit('graphics_is_pushed', self.page, i, function (_pressed) {
				pressed = _pressed
			})

			self.panel.draw(key, data[i].buffer, data[i].style, pressed)
		}
	} else {
		/* TODO: We should move this to the device module */
		const datap = graphics.getImagesForPincode(self.currentpin)
		self.panel.clearDeck()
		self.panel.draw(12, datap[0].buffer)
		self.panel.draw(17, datap[1].buffer)
		self.panel.draw(18, datap[2].buffer)
		self.panel.draw(19, datap[3].buffer)
		self.panel.draw(9, datap[4].buffer)
		self.panel.draw(10, datap[5].buffer)
		self.panel.draw(11, datap[6].buffer)
		self.panel.draw(1, datap[7].buffer)
		self.panel.draw(2, datap[8].buffer)
		self.panel.draw(3, datap[9].buffer)
		self.panel.draw(8, datap[10].buffer)
	}
}

device.prototype.updateBank = function (page, bank) {
	var self = this

	// If device is locked ignore updates. pincode updates are handled separately
	if (!self.lockedout) {
		var img = graphics.getBank(page, bank)

		if (page == self.page) {
			const xOffset = Math.min(Math.max(self.panelconfig.config.xOffset || 0, 0), self.panelinfo.xOffsetMax)
			const yOffset = Math.min(Math.max(self.panelconfig.config.yOffset || 0, 0), self.panelinfo.yOffsetMax)

			// Note: the maths looks inverted, but it goes through the toDeviceKey still
			const key = bank - 1 - xOffset - yOffset * global.MAX_BUTTONS_PER_ROW

			let pressed = false
			system.emit('graphics_is_pushed', page, bank, function (_pressed) {
				pressed = _pressed
			})

			// 12-Jan-2020: was wrapped with setImmediate
			// which delays the button draw.
			// if the page changed, the old button gfx gets put on the new page
			self.panel.draw(key, img.buffer, img.style, pressed)
		}
	}
}

device.prototype.unload = function () {
	var self = this

	system.emit('log', 'device(' + self.panel.serialnumber + ')', 'error', self.panel.type + ' disconnected')
	debug('unloading for ' + self.devicepath)
	system.removeListener('graphics_bank_invalidated', self.on_bank_invalidated)
	system.removeListener('elgato_ready', self.on_elgato_ready)
	system.removeListener('elgato_click', self.on_elgato_click)
	system.removeListener('lockoutall', self.lockoutAll)
	system.removeListener('unlockoutall', self.unlockoutAll)
	system.removeListener('lockout_device', self.lockoutDevice)
	system.removeListener('unlockout_device', self.unlockoutDevice)
	system.removeListener('device_page_set', self.on_device_page_set)
	system.removeListener('device_page_get', self.on_device_page_get)
	system.removeListener('device_brightness_set', self.on_device_brightness_set)
	system.removeListener('device_page_down', self.on_device_page_down)
	system.removeListener('device_page_up', self.on_device_page_up)

	try {
		self.panel.quit()
	} catch (e) {}

	delete self.panel.device
	delete self.panel
}

device.prototype.quit = function () {
	this.unload()
}

exports = module.exports = function (system, panel) {
	return new device(system, panel)
}

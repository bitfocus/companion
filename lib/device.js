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
var Image = require('./image')
var debug = require('debug')('lib/device')
var i = new Image(1, 1) // TODO: export the .rgb function
var graphics

var debug = require('debug')('lib/device')

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
	self.page = 1
	self.lastpress = ''
	self.lastpage = 0
	self.config = {}
	self.userconfig = {}
	self.deviceconfig = {}

	system.emit('db_get', 'deviceconfig', function (res) {
		if (res !== undefined && res !== null) {
			self.deviceconfig = res
		} else {
			// Make sure we have a working reference
			self.deviceconfig = {}
			system.emit('db_set', 'deviceconfig', self.deviceconfig)
		}
	})

	if (self.panel !== undefined && self.deviceconfig[self.panel.serialnumber] !== undefined) {
		if (self.deviceconfig[self.panel.serialnumber].page !== undefined) {
			self.page = self.deviceconfig[self.panel.serialnumber].page
		}

		var config = self.deviceconfig[self.panel.serialnumber].config

		if (config !== undefined) {
			setImmediate(function () {
				self.panel.setConfig(config)
			})
		}
		debug('Device ' + self.panel.serialnumber + ' was on page ' + self.page)
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

	self.on_graphics_page_controls_invalidated = function () {
		self.updateControls()
	}
	system.on('graphics_page_controls_invalidated', self.on_graphics_page_controls_invalidated)

	self.on_ready = function () {
		self.on_bank_update()
	}

	system.on('ready', self.on_ready)

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

	self.on_device_redraw = function (id) {
		if (id == self.devicepath) {
			self.drawPage()
		}
	}
	system.on('device_redraw', self.on_device_redraw)

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
			self.updatePagedevice()
		}
	}
	system.on('device_page_set', self.on_device_page_set)

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

			self.updatePagedevice()
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

			self.updatePagedevice()
		}
	}

	self.on_elgato_click = function (devicepath, key, state, obj) {
		if (devicepath != self.devicepath) {
			return
		}
		if (!self.lockedout) {
			self.lastinteraction = Date.now()
			self.lockoutat = self.userconfig.pin_timeout * 1000 + Date.now()

			var thispress = self.panel.serialnumber + '_' + self.page
			if (state) {
				self.lastpress = thispress
				self.lastpage = self.page
			} else if (thispress != self.lastpress) {
				// page changed on this device before button released
				// release the old page+bank
				system.emit('bank_pressed', self.lastpage, parseInt(key) + 1, false, self.panel.serialnumber)
				self.lastpress = ''
				return
			} else {
				self.lastpress = ''
			}

			system.emit('bank_pressed', self.page, parseInt(key) + 1, state, self.panel.serialnumber)
			system.emit(
				'log',
				'device(' + self.panel.serialnumber + ')',
				'debug',
				'Button ' + self.page + '.' + (parseInt(key) + 1) + ' ' + (state ? 'pressed' : 'released')
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
					self.updateControls()

					if (self.userconfig.link_lockouts) {
						system.emit('unlockoutall')
					}
				} else if (self.currentpin.length >= self.userconfig.pin.toString().length) {
					self.currentpin = ''
				}
			}

			if (self.lockedout) {
				// Update lockout button
				self.datap = graphics.getImagesForPincode(self.currentpin)
				self.panel.draw(8, self.datap[10].buffer)
			}
		}
	}
	system.on('elgato_click', self.on_elgato_click)

	system.emit('bank_update_request')
}

device.prototype.updatePagedevice = function () {
	var self = this

	if (self.deviceconfig[self.panel.serialnumber] == undefined) {
		self.deviceconfig[self.panel.serialnumber] = {}
	}
	self.deviceconfig[self.panel.serialnumber].page = self.page
	system.emit('db_set', 'deviceconfig', self.deviceconfig)
	system.emit('db_save')

	self.drawPage()
}

device.prototype.updatedConfig = function () {
	var self = this

	if (self.deviceconfig[self.panel.serialnumber] == undefined) {
		self.deviceconfig[self.panel.serialnumber] = {}
	}
	self.deviceconfig[self.panel.serialnumber].config = self.panel.deviceconfig
	system.emit('db_set', 'deviceconfig', self.deviceconfig)
	system.emit('db_save')
}

device.prototype.updateControls = function () {
	var self = this

	/*
	self.data = graphics.getImagesForPage(self.page);
	self.panel.draw(0, self.data[0].buffer);
	self.panel.draw(5, self.data[5].buffer);
	self.panel.draw(10, self.data[10].buffer);
	*/

	debug('updateControls() IS OBSOLETE, AND SHOULD BE FIXED')
}

device.prototype.drawPage = function () {
	var self = this

	if (!self.lockedout) {
		self.data = graphics.getImagesForPage(self.page)

		for (var i in self.data) {
			self.panel.draw(i, self.data[i].buffer)
		}
	} else {
		/* TODO: We should move this to the device module */
		self.datap = graphics.getImagesForPincode(self.currentpin)
		self.panel.clearDeck()
		self.panel.draw(12, self.datap[0].buffer)
		self.panel.draw(17, self.datap[1].buffer)
		self.panel.draw(18, self.datap[2].buffer)
		self.panel.draw(19, self.datap[3].buffer)
		self.panel.draw(9, self.datap[4].buffer)
		self.panel.draw(10, self.datap[5].buffer)
		self.panel.draw(11, self.datap[6].buffer)
		self.panel.draw(1, self.datap[7].buffer)
		self.panel.draw(2, self.datap[8].buffer)
		self.panel.draw(3, self.datap[9].buffer)
		self.panel.draw(8, self.datap[10].buffer)

		/*		self.panel.draw(0, self.datap[11].buffer);
		self.panel.draw(4, self.datap[11].buffer);
		self.panel.draw(16, self.datap[11].buffer);
		self.panel.draw(20, self.datap[11].buffer);
*/
	}
}

device.prototype.updateBank = function (page, bank) {
	var self = this

	if (!self.lockedout) {
		var img = graphics.getBank(page, bank)

		if (page == self.page) {
			// 12-Jan-2020: was wrapped with setImmediate
			// which delays the button draw.
			// if the page changed, the old button gfx gets put on the new page
			self.panel.draw(bank - 1, img.buffer)
		}
	} else {
		self.datap = graphics.getImagesForPincode(self.currentpin)

		/* TODO: Find bank */
		/* TODO: We should move this to the device module */
		self.panel.clearDeck()
		self.panel.draw(12, self.datap[0].buffer)
		self.panel.draw(17, self.datap[1].buffer)
		self.panel.draw(18, self.datap[2].buffer)
		self.panel.draw(19, self.datap[3].buffer)
		self.panel.draw(9, self.datap[4].buffer)
		self.panel.draw(10, self.datap[5].buffer)
		self.panel.draw(11, self.datap[6].buffer)
		self.panel.draw(1, self.datap[7].buffer)
		self.panel.draw(2, self.datap[8].buffer)
		self.panel.draw(3, self.datap[9].buffer)
		self.panel.draw(8, self.datap[10].buffer)

		self.panel.draw(0, self.datap[11].buffer)
		self.panel.draw(4, self.datap[11].buffer)
		self.panel.draw(16, self.datap[11].buffer)
		self.panel.draw(20, self.datap[11].buffer)
	}
}

device.prototype.unload = function () {
	var self = this

	system.emit('log', 'device(' + self.panel.serialnumber + ')', 'error', self.panel.type + ' disconnected')
	debug('unloading for ' + self.devicepath)
	system.removeListener('graphics_bank_invalidated', self.on_bank_invalidated)
	system.removeListener('graphics_page_controls_invalidated', self.on_graphics_page_controls_invalidated)
	system.removeListener('ready', self.on_ready)
	system.removeListener('elgato_ready', self.on_elgato_ready)
	system.removeListener('elgato_click', self.on_elgato_click)
	system.removeListener('lockoutall', self.lockoutAll)
	system.removeListener('unlockoutall', self.unlockoutAll)
	system.removeListener('lockout_device', self.lockoutDevice)
	system.removeListener('unlockout_device', self.unlockoutDevice)
	system.removeListener('device_redraw', self.on_device_redraw)
	system.removeListener('device_page_set', self.on_device_page_set)
	system.removeListener('device_page_down', self.on_device_page_down)
	system.removeListener('device_page_up', self.on_device_page_up)
	self.panel.device = undefined
}

device.prototype.quit = function () {
	this.unload()
}

exports = module.exports = function (system, panel) {
	return new device(system, panel)
}

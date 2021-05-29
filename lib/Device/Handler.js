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

var Image = require('../Graphics/Image')
var debug = require('debug')('Device/Handler')
var i = new Image(1, 1) // TODO: export the .rgb function

class DeviceHandler {
	constructor(registry, panel) {
		debug('loading for ' + panel.devicepath)

		this.registry = registry
		this.system = this.registry.system
		this.graphics = this.registry.graphics
		this.db = this.registry.db

		this.panel = panel
		this.lockedout = true
		this.lastinteraction = Date.now()
		this.lockoutat = Date.now()
		this.currentpin = ''
		this.devicepath = panel.devicepath
		this.page = 1
		this.lastpress = ''
		this.lastpage = 0
		this.config = {}
		this.deviceconfig = this.db.getKey('deviceconfig', {})

		if (this.panel !== undefined && this.deviceconfig[this.panel.serialnumber] !== undefined) {
			if (this.deviceconfig[this.panel.serialnumber].page !== undefined) {
				this.page = this.deviceconfig[this.panel.serialnumber].page
			}

			var config = this.deviceconfig[this.panel.serialnumber].config

			if (config !== undefined) {
				setImmediate(() => {
					this.panel.setConfig(config)
				})
			}
			debug('Device ' + this.panel.serialnumber + ' was on page ' + this.page)
		}

		this.lockedout = this.userconfig.getKey('pin_enable')

		this.onDevicePageSet = this.onDevicePageSet.bind(this)
		this.onDevicePageDown = this.onDevicePageDown.bind(this)
		this.onDeviceRedraw = this.onDeviceRedraw.bind(this)
		this.onDevicePageUp = this.onDevicePageUp.bind(this)
		this.onDevicePress = this.onDevicePress.bind(this)
		this.onDeviceReady = this.onDeviceReady.bind(this)
		this.onBankInvalidated = this.onBankInvalidated.bind(this)
		this.lockoutAll = this.lockoutAll.bind(this)
		this.lockoutDevice = this.lockoutDevice.bind(this)
		this.unlockoutAll = this.unlockoutAll.bind(this)
		this.unlockoutDevice = this.unlockoutDevice.bind(this)

		this.system.on('device_page_set', this.onDevicePageSet)
		this.system.on('device_page_down', this.onDevicePageDown)
		this.system.on('device_redraw', this.onDeviceRedraw)
		this.system.on('device_page_up', this.onDevicePageUp)
		this.system.on('device_press', this.onDevicePress)
		this.system.on('device_ready', this.onDeviceReady)
		this.system.on('graphics_bank_invalidated', this.onBankInvalidated)
		this.system.on('lockoutall', this.lockoutAll)
		this.system.on('lockout_device', this.lockoutDevice)
		this.system.on('unlockoutall', this.unlockoutAll)
		this.system.on('unlockout_device', this.unlockoutDevice)

		this.timeouttimer = setInterval(this.checkTimeout.bind(this), 1000)

		//this.system.emit('bank_update_request');
	}

	checkTimeout() {
		if (
			this.userconfig.getKey('pin_timeout') != 0 &&
			this.userconfig.getKey('pin_enable') == true &&
			Date.now() >= this.lockoutat &&
			!this.lockedout
		) {
			if (this.userconfig.getKey('link_lockouts')) {
				this.system.emit('lockoutall')
			} else {
				this.lockedout = true
				this.drawPage()
			}
		}

		if (this.lockedout && !this.userconfig.getKey('pin_enable')) {
			this.lockedout = false
			this.drawPage()
		}
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

			this.updatePagedevice()
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

			this.updatePagedevice()
		}
	}

	drawPage() {
		if (!this.lockedout) {
			this.data = this.graphics.getImagesForPage(this.page)

			for (var i in this.data) {
				this.panel.draw(i, this.data[i].buffer)
			}
		} else {
			/* TODO: We should move this to the device module */
			this.datap = this.graphics.getImagesForPincode(this.currentpin)
			this.panel.clearDeck()
			this.panel.draw(12, this.datap[0].buffer)
			this.panel.draw(17, this.datap[1].buffer)
			this.panel.draw(18, this.datap[2].buffer)
			this.panel.draw(19, this.datap[3].buffer)
			this.panel.draw(9, this.datap[4].buffer)
			this.panel.draw(10, this.datap[5].buffer)
			this.panel.draw(11, this.datap[6].buffer)
			this.panel.draw(1, this.datap[7].buffer)
			this.panel.draw(2, this.datap[8].buffer)
			this.panel.draw(3, this.datap[9].buffer)
			this.panel.draw(8, this.datap[10].buffer)

			/*		this.panel.draw(0, this.datap[11].buffer);
			this.panel.draw(4, this.datap[11].buffer);
			this.panel.draw(16, this.datap[11].buffer);
			this.panel.draw(20, this.datap[11].buffer);
	*/
		}
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

	onBankInvalidated(page, bank) {
		this.updateBank(page, bank)
	}

	onDevicePageDown(deviceid) {
		if (this.userconfig.getKey('page_direction_flipped') === true) {
			this.deviceIncreasePage(deviceid)
		} else {
			this.deviceDecreasePage(deviceid)
		}
	}

	onDevicePageUp(deviceid) {
		if (this.userconfig.getKey('page_direction_flipped') === true) {
			this.deviceDecreasePage(deviceid)
		} else {
			this.deviceIncreasePage(deviceid)
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

			this.updatePagedevice()
		}
	}

	onDevicePress(devicepath, key, state, obj) {
		if (devicepath != this.devicepath) {
			return
		}

		if (!this.lockedout) {
			this.lastinteraction = Date.now()
			this.lockoutat = this.userconfig.getKey('pin_timeout') * 1000 + Date.now()

			var thispress = this.panel.serialnumber + '_' + this.page

			if (state) {
				this.lastpress = thispress
				this.lastpage = this.page
			} else if (thispress != this.lastpress) {
				// page changed on this device before button released
				// release the old page+bank
				this.system.emit('bank_pressed', this.lastpage, parseInt(key) + 1, false, this.panel.serialnumber)
				this.lastpress = ''
				return
			} else {
				this.lastpress = ''
			}

			this.system.emit('bank_pressed', this.page, parseInt(key) + 1, state, this.panel.serialnumber)
			this.system.emit(
				'log',
				'device(' + this.panel.serialnumber + ')',
				'debug',
				'Button ' + this.page + '.' + (parseInt(key) + 1) + ' ' + (state ? 'pressed' : 'released')
			)
		} else {
			if (state) {
				var decode = [12, 17, 18, 19, 9, 10, 11, 1, 2, 3]

				if (decode.indexOf(key).toString() != -1) {
					this.currentpin += decode.indexOf(key).toString()
				}

				if (this.currentpin == this.userconfig.getKey('pin').toString()) {
					this.lockedout = false
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

			if (this.lockedout) {
				// Update lockout button
				this.datap = this.graphics.getImagesForPincode(this.currentpin)
				this.panel.draw(8, this.datap[10].buffer)
			}
		}
	}

	onDeviceReady(devicepath) {
		if (devicepath == this.devicepath) {
			this.panel.begin()
			this.drawPage()
		}
	}

	onDeviceRedraw(id) {
		if (id == this.devicepath) {
			this.drawPage()
		}
	}

	quit() {
		this.unload()
	}

	unload() {
		this.system.emit('log', 'device(' + this.panel.serialnumber + ')', 'error', this.panel.type + ' disconnected')
		debug('unloading for ' + this.devicepath)
		this.system.removeListener('graphics_bank_invalidated', this.onBankInvalidated)
		this.system.removeListener('device_ready', this.onDeviceReady)
		this.system.removeListener('device_press', this.onDevicePress)
		this.system.removeListener('lockoutall', this.lockoutAll)
		this.system.removeListener('unlockoutall', this.unlockoutAll)
		this.system.removeListener('lockout_device', this.lockoutDevice)
		this.system.removeListener('unlockout_device', this.unlockoutDevice)
		this.system.removeListener('device_redraw', this.onDeviceRedraw)
		this.system.removeListener('device_page_set', this.onDevicePageSet)
		this.system.removeListener('device_page_down', this.onDevicePageDown)
		this.system.removeListener('device_page_up', this.onDevicePageUp)
		this.panel.device = undefined
	}

	unlockoutAll() {
		this.lockedout = false
		this.lastinteraction = Date.now()
		this.lockoutat = this.userconfig.getKey('pin_timeout') * 1000 + Date.now()
		this.drawPage()
	}

	unlockoutDevice(deviceid) {
		if (this.panel.serialnumber == deviceid) {
			this.lockedout = false
			this.lastinteraction = Date.now()
			this.lockoutat = this.userconfig.getKey('pin_timeout') * 1000 + Date.now()
			this.drawPage()
		}
	}

	updateBank(page, bank) {
		// TODO: There needs to be some additional logic to prevent
		//       constant redraw of the pincode image as background changes happen
		if (!this.lockedout) {
			if (page == this.page) {
				let img = this.graphics.getBank(page, bank)
				this.panel.draw(bank - 1, img.buffer)
			}
		} else {
			this.datap = this.graphics.getImagesForPincode(this.currentpin)

			/* TODO: Find bank */
			/* TODO: We should move this to the device module */
			this.panel.clearDeck()
			this.panel.draw(12, this.datap[0].buffer)
			this.panel.draw(17, this.datap[1].buffer)
			this.panel.draw(18, this.datap[2].buffer)
			this.panel.draw(19, this.datap[3].buffer)
			this.panel.draw(9, this.datap[4].buffer)
			this.panel.draw(10, this.datap[5].buffer)
			this.panel.draw(11, this.datap[6].buffer)
			this.panel.draw(1, this.datap[7].buffer)
			this.panel.draw(2, this.datap[8].buffer)
			this.panel.draw(3, this.datap[9].buffer)
			this.panel.draw(8, this.datap[10].buffer)

			this.panel.draw(0, this.datap[11].buffer)
			this.panel.draw(4, this.datap[11].buffer)
			this.panel.draw(16, this.datap[11].buffer)
			this.panel.draw(20, this.datap[11].buffer)
		}
	}

	updatePagedevice() {
		if (this.deviceconfig[this.panel.serialnumber] == undefined) {
			this.deviceconfig[this.panel.serialnumber] = {}
		}

		this.deviceconfig[this.panel.serialnumber].page = this.page
		this.db.setKey('deviceconfig', this.deviceconfig)
		//this.db.setDirty();

		this.drawPage()
	}

	updatedConfig() {
		if (this.deviceconfig[this.panel.serialnumber] == undefined) {
			this.deviceconfig[this.panel.serialnumber] = {}
		}

		this.deviceconfig[this.panel.serialnumber].config = this.panel.deviceconfig
		this.db.setKey('deviceconfig', this.deviceconfig)
		//this.db.setDirty();
	}

	userconfig() {
		return this.registry.userconfig
	}
}

exports = module.exports = DeviceHandler

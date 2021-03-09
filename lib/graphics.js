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
var debug = require('debug')('lib/graphics')
var Image = require('./image')
var fs = require('fs')
var _ = require('lodash')
var rgb = Image.rgb
var instance
var cfgDir

function graphics(_system) {
	var self = this

	self.buffers = {}
	self.page_direction_flipped = false
	self.page_plusminus = false
	self.remove_topbar = false

	system = _system
	self.system = system
	self.pushed = {}
	self.userconfig = {}
	self.page = {}
	self.style = {}
	self.pincodebuffer = {}

	system.on('graphics_bank_invalidate', self.invalidateBank.bind(self))
	system.on('graphics_indicate_push', self.indicatePush.bind(self))
	system.on('graphics_is_pushed', self.isPushed.bind(self))

	// get page object
	system.emit('get_page', function (page) {
		self.page = page
	})

	// get userconfig object
	system.emit('get_userconfig', function (userconfig) {
		self.page_direction_flipped = userconfig.page_direction_flipped
		self.page_plusminus = userconfig.page_plusminus
		self.remove_topbar = userconfig.remove_topbar
	})

	// when page names are updated
	system.on('page_update', function (page, obj) {
		debug('page controls invalidated for page', page)
		system.emit('graphics_page_controls_invalidated', page)
	})

	system.on('action_bank_status_set', function (page, bank, status) {
		self.invalidateBank(page, bank)
	})

	system.on('graphics_page_controls_invalidated', function (page) {
		if (page !== undefined) {
			for (var bank = 1; bank <= global.MAX_BUTTONS; bank++) {
				var style = self.style[page + '_' + bank]
				if (style == 'pageup' || style == 'pagedown' || style == 'pagenum') {
					system.emit('bank_style', page, bank, style)
					self.invalidateBank(page, bank)
				}
			}
		} else {
			for (var page = 1; page <= 99; page++) {
				for (var bank = 1; bank <= global.MAX_BUTTONS; bank++) {
					var style = self.style[page + '_' + bank]
					if (style == 'pageup' || style == 'pagedown' || style == 'pagenum') {
						system.emit('bank_style', page, bank, style)
						self.invalidateBank(page, bank)
					}
				}
			}
		}
	})

	// if settings are changed, draw new up/down buttons
	system.on('set_userconfig_key', function (key, val) {
		if (key == 'page_direction_flipped') {
			self.page_direction_flipped = val
			debug('page controls invalidated')
			system.emit('graphics_page_controls_invalidated')
		}
		if (key == 'page_plusminus') {
			self.page_plusminus = val
			debug('page controls invalidated')
			system.emit('graphics_page_controls_invalidated')
		}
		if (key == 'remove_topbar') {
			self.remove_topbar = val
			debug('Topbar removed')
			self.generate(true)
		}
	})

	// draw custom bank (presets, previews etc)
	system.on('graphics_preview_generate', function (config, cb) {
		if (typeof cb == 'function') {
			var img = self.drawBankImage(config)
			if (img !== undefined) {
				cb(img.buffer())
			} else {
				cb(null)
			}
		}
	})

	system.once('bank_update', function (config) {
		if (config !== undefined) {
			self.config = config
		}

		debug('Generating buffers')
		self.generate()
		debug('Done')
	})
}

graphics.prototype.invalidateBank = function (page, bank) {
	var self = this
	self.buffers[page + '_' + bank] = undefined
	self.style[page + '_' + bank] = undefined
	self.drawBank(page, bank)

	system.emit('graphics_bank_invalidated', page, bank)
}

graphics.prototype.indicatePush = function (page, bank, state) {
	var self = this
	self.buffers[page + '_' + bank] = undefined

	if (state) {
		/* indicate push */
		self.buffers[page + '_' + bank] = undefined
		self.pushed[page + '_' + bank] = 1
	} else {
		self.buffers[page + '_' + bank] = undefined
		delete self.pushed[page + '_' + bank]
	}

	self.drawBank(page, bank)
	system.emit('graphics_bank_invalidated', page, bank)
}

graphics.prototype.isPushed = function (page, bank, cb) {
	var self = this

	cb(self.pushed[page + '_' + bank])
}

graphics.prototype.generate = function (invalidate) {
	var self = this

	for (var p = 1; p <= 99; p++) {
		self.drawPage(p, invalidate)
	}
}

graphics.prototype.drawBankImage = function (c, page, bank) {
	var self = this
	var img
	var notStatic = page === undefined || bank === undefined

	self.style[page + '_' + bank] = c.style

	if (page !== undefined && bank !== undefined) {
		if (self.buffers[page + '_' + bank] === undefined) {
			img = self.buffers[page + '_' + bank] = new Image(72, 72)
		} else {
			img = self.buffers[page + '_' + bank]
			img.boxFilled(0, 0, 71, 14, rgb(0, 0, 0))
		}
	} else {
		img = new Image(72, 72)
	}
	// Don't draw the line on page buttons
	if (c.style !== 'pageup' && c.style !== 'pagedown' && c.style !== 'pagenum') {
		img.horizontalLine(13, img.rgb(255, 198, 0))
	} else {
		if (c.style == 'pageup') {
			img.backgroundColor(img.rgb(15, 15, 15))

			if (self.page_plusminus) {
				img.drawLetter(30, 20, self.page_direction_flipped ? '-' : '+', img.rgb(255, 255, 255), 0, 1)
			} else {
				img.drawLetter(26, 20, 'arrow_up', img.rgb(255, 255, 255), 'icon')
			}

			img.drawAlignedText(0, 39, 72, 8, 'UP', img.rgb(255, 198, 0), 0, undefined, 1, 'center', 'center')
		} else if (c.style == 'pagedown') {
			img.backgroundColor(img.rgb(15, 15, 15))

			if (self.page_plusminus) {
				img.drawLetter(30, 40, self.page_direction_flipped ? '+' : '-', img.rgb(255, 255, 255), 0, 1)
			} else {
				img.drawLetter(26, 40, 'arrow_down', img.rgb(255, 255, 255), 'icon')
			}

			img.drawCenterText(36, 28, 'DOWN', img.rgb(255, 198, 0), 0)
		} else if (c.style == 'pagenum') {
			img.backgroundColor(img.rgb(15, 15, 15))

			if (page === undefined) {
				// Preview (no page/bank)
				img.drawAlignedText(0, 0, 72, 30, 'PAGE', img.rgb(255, 198, 0), 0, undefined, 1, 'center', 'bottom')
				img.drawAlignedText(0, 32, 72, 30, 'x', img.rgb(255, 255, 255), 18, undefined, 1, 'center', 'top')
			} else if (self.page[page] === undefined || self.page[page].name === 'PAGE' || self.page[page].name === '') {
				img.drawAlignedText(0, 0, 72, 30, 'PAGE', img.rgb(255, 198, 0), 0, undefined, 1, 'center', 'bottom')
				img.drawAlignedText(0, 32, 72, 30, '' + page, img.rgb(255, 255, 255), 18, undefined, 1, 'center', 'top')
			} else {
				var pagename = self.page[page].name
				img.drawAlignedText(0, 0, 72, 72, pagename, img.rgb(255, 255, 255), '18', 2, 0, 'center', 'center')
			}
		}
	}

	// handle upgrade from pre alignment-support configuration
	if (c.alignment === undefined) {
		c.alignment = 'center:center'
	}
	if (c.pngalignment === undefined) {
		c.pngalignment = 'center:center'
	}
	if (c.style == 'png' || c.style == 'text') {
		self.remove_topbar ? img.boxFilled(0, 0, 71, 71, c.bgcolor) : img.boxFilled(0, 14, 71, 71, c.bgcolor)
		self.system.emit('graphics_set_bank_bg', page, bank, c.bgcolor)
	} else {
		// ensure any previous colour is cleared
		self.system.emit('graphics_set_bank_bg', page, bank, 0)
	}

	if (!notStatic) {
		system.emit('action_bank_status_get', page, bank, function (status) {
			var colors = [0, img.rgb(255, 127, 0), img.rgb(255, 0, 0)]

			if (status > 0) {
				img.boxFilled(62, 2, 70, 10, colors[status])
			}
		})

		system.emit('action_running_get', page, bank, function (status) {
			if (status) {
				img.drawLetter(55, 3, 'play', img.rgb(0, 255, 0), 'icon')
			}
		})
	}

	if (c.style == 'png' || c.style == 'text') {
		if (c.png64 !== undefined) {
			try {
				var data = Buffer.from(c.png64, 'base64')
				var halign = c.pngalignment.split(':', 2)[0]
				var valign = c.pngalignment.split(':', 2)[1]

				self.remove_topbar
					? img.drawFromPNGdata(data, 0, 0, 72, 72, halign, valign)
					: img.drawFromPNGdata(data, 0, 14, 72, 58, halign, valign)
			} catch (e) {
				img.boxFilled(0, 14, 71, 57, 0)
				img.drawAlignedText(2, 18, 68, 52, 'PNG ERROR', img.rgb(255, 0, 0), 0, 2, 1, 'center', 'center')
				return img
			}
		} else {
			if (cfgDir === undefined) {
				system.emit('configdir_get', function (_cfgDir) {
					cfgDir = _cfgDir
				})
			}

			if (fs.existsSync(cfgDir + '/banks/' + page + '_' + bank + '.png')) {
				// one last time
				img.drawFromPNG(cfgDir + '/banks/' + page + '_' + bank + '.png', 0, 14)

				// Upgrade config with base64 and delete file
				try {
					data = fs.readFileSync(cfgDir + '/banks/' + page + '_' + bank + '.png')
					system.emit('bank_set_key', page, bank, 'png64', data.toString('base64'))
					fs.unlink(cfgDir + '/banks/' + page + '_' + bank + '.png')
				} catch (e) {
					debug('Error upgrading config to inline png for bank ' + page + '.' + bank)
					debug('Reason:' + e.message)
				}
			}
		}

		/* raw image buffers */
		if (c.img64 !== undefined) {
			self.remove_topbar
				? img.drawPixelBuffer(0, 0, 72, 72, c.img64, 'base64')
				: img.drawPixelBuffer(0, 14, 72, 58, c.img64, 'base64')
		}
	}

	if (c.style == 'text' || c.style == 'png') {
		var text
		system.emit('variable_parse', c.text, function (str) {
			text = str
		})

		var halign = c.alignment.split(':', 2)[0]
		var valign = c.alignment.split(':', 2)[1]
		if (c.size == 'small') c.size = 0
		if (c.size == 'large') c.size = 14
		if (c.size == 7) c.size = 0

		if (c.size != 'auto') {
			if (self.remove_topbar) {
				img.drawAlignedText(2, 2, 68, 68, text, c.color, parseInt(c.size), 2, 1, halign, valign)
			} else {
				img.drawAlignedText(2, 18, 68, 52, text, c.color, parseInt(c.size), 2, 1, halign, valign)
			}
		} else {
			if (self.remove_topbar) {
				img.drawAlignedText(2, 2, 68, 68, text, c.color, 'auto', 2, 1, halign, valign)
			} else {
				img.drawAlignedText(2, 18, 68, 52, text, c.color, 'auto', 2, 1, halign, valign)
			}
		}
	}

	if (page === undefined) {
		// Preview (no page/bank)

		img.drawTextLine(3, 3, 'x.x', img.rgb(255, 198, 0), 0)
	} else if (self.pushed[page + '_' + bank] !== undefined) {
		// Pushed
		if (c.style !== 'pageup' && c.style !== 'pagedown' && c.style !== 'pagenum') {
			if (self.remove_topbar) {
				img.drawBorder(3, rgb(255, 198, 0))
			} else {
				img.boxFilled(0, 0, 71, 14, rgb(255, 198, 0))
				img.drawTextLine(3, 3, page + '.' + bank, img.rgb(0, 0, 0), 0)
			}
		}
	} else {
		// not pushed
		if (c.style !== 'pageup' && c.style !== 'pagedown' && c.style !== 'pagenum' && !self.remove_topbar) {
			img.drawTextLine(3, 3, page + '.' + bank, img.rgb(255, 198, 0), 0)
		}
	}

	return img
}

graphics.prototype.drawBank = function (page, bank) {
	var self = this
	var img

	page = parseInt(page)
	bank = parseInt(bank)

	if (
		self.config[page] !== undefined &&
		self.config[page][bank] !== undefined &&
		self.config[page][bank].style !== undefined
	) {
		var c = _.cloneDeep(self.config[page][bank])

		// Fetch feedback-overrides for bank
		system.emit('feedback_get_style', page, bank, function (style) {
			if (style !== undefined) {
				for (var key in style) {
					c[key] = style[key]
				}
			}
		})

		img = self.drawBankImage(c, page, bank)
	} else {
		img = self.buffers[page + '_' + bank] = new Image(72, 72)

		img.drawTextLine(2, 3, page + '.' + bank, img.rgb(50, 50, 50), 0)
		img.horizontalLine(13, img.rgb(30, 30, 30))
	}

	return img
}

graphics.prototype.drawPage = function (page, invalidate) {
	var self = this

	for (var bank = 1; bank <= global.MAX_BUTTONS; ++bank) {
		var img = self.drawBank(page, bank)

		if (invalidate) {
			system.emit('graphics_bank_invalidated', page, bank)
		}
	}
}

graphics.prototype.drawControls = function () {
	var self = this

	// page up
	var img = (self.buffers['up'] = new Image(72, 72))
	img.backgroundColor(img.rgb(15, 15, 15))
	if (self.page_plusminus) {
		img.drawLetter(30, 20, self.page_direction_flipped ? '-' : '+', img.rgb(255, 255, 255), 0, 1)
	} else {
		img.drawLetter(26, 20, 'arrow_up', img.rgb(255, 255, 255), 'icon')
	}
	img.drawAlignedText(0, 39, 72, 8, 'PAGE UP', img.rgb(255, 198, 0), 0, undefined, 1, 'center', 'center')

	// page down
	var img = (self.buffers['down'] = new Image(72, 72))
	img.backgroundColor(img.rgb(15, 15, 15))
	if (self.page_plusminus) {
		img.drawLetter(30, 40, self.page_direction_flipped ? '+' : '-', img.rgb(255, 255, 255), 0, 1)
	} else {
		img.drawLetter(26, 40, 'arrow_down', img.rgb(255, 255, 255), 'icon')
	}
	img.drawCenterText(36, 28, 'PAGE DOWN', img.rgb(255, 198, 0), 0)
}

graphics.prototype.getImagesForPincode = function (pincode) {
	var self = this
	var b = '1 2 3 4 6 7 8 9 11 12 13 14'.split(/ /)
	var img

	if (self.pincodebuffer[0] === undefined) {
		for (var i = 0; i < 10; i++) {
			img = new Image(72, 72)
			img.backgroundColor(img.rgb(15, 15, 15))
			img.drawAlignedText(0, 0, 72, 72, i.toString(), img.rgb(255, 255, 255), 44, undefined, 44, 'center', 'center')
			self.pincodebuffer[i] = img.bufferAndTime()
		}
	}
	img = new Image(72, 72)
	img.backgroundColor(img.rgb(15, 15, 15))
	img.drawAlignedText(0, -10, 72, 72, 'Lockout', img.rgb(255, 198, 0), 14, undefined, 44, 'center', 'center')
	if (!(pincode === undefined)) {
		img.drawAlignedText(
			0,
			15,
			72,
			72,
			pincode.replace(/[a-z0-9]/gi, '*'),
			img.rgb(255, 255, 255),
			18,
			undefined,
			44,
			'center',
			'center'
		)
	}
	self.pincodebuffer[10] = img.bufferAndTime()
	img = new Image(72, 72)
	img.backgroundColor(img.rgb(15, 15, 15))
	self.pincodebuffer[11] = img.bufferAndTime()

	return self.pincodebuffer
}

graphics.prototype.getImagesForPage = function (page) {
	var self = this

	var result = {}

	for (var i = 0; i < global.MAX_BUTTONS; ++i) {
		if (self.buffers[page + '_' + (parseInt(i) + 1)] === undefined) {
			result[i] = new Image(72, 72).bufferAndTime()
		} else {
			result[i] = self.buffers[page + '_' + (parseInt(i) + 1)].bufferAndTime()
		}
	}

	return result
}

graphics.prototype.getBank = function (page, bank) {
	var self = this
	var img = self.buffers[page + '_' + bank]

	if (img === undefined) {
		self.drawBank(page, bank)
		img = self.buffers[page + '_' + bank]
	}

	if (img === undefined) {
		debug('!!!! ERROR: UNEXPECTED ERROR while fetching image for unbuffered bank: ' + page + '.' + bank)

		// continue gracefully, even though something is terribly wrong
		return {
			buffer: new Image(72, 72),
			updated: Date.now(),
		}
	}

	return {
		buffer: img.buffer(),
		updated: img.lastUpdate,
	}
}

graphics.prototype.getPageButton = function (page) {
	var self = this
	var img = new Image(72, 72)

	img.backgroundColor(img.rgb(15, 15, 15))
	img.drawAlignedText(
		0,
		0,
		72,
		30,
		self.page[page] !== undefined ? self.page[page].name : '',
		img.rgb(255, 198, 0),
		0,
		undefined,
		1,
		'center',
		'bottom'
	)
	img.drawAlignedText(0, 32, 72, 30, '' + page, img.rgb(255, 255, 255), 18, undefined, 1, 'center', 'top')
	return img
}

// Graphics is a singleton class
exports = module.exports = function (system) {
	if (instance === undefined) {
		return (instance = new graphics(system))
	} else {
		return instance
	}
}

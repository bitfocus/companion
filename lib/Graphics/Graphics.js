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

const debug = require('debug')('Graphics/Graphics')
const CoreBase = require('../Core/Base')
const Image = require('./Image')
const fs = require('fs')
const { cloneDeep } = require('lodash')

class Graphics extends CoreBase {
	constructor(registry) {
		super(registry, 'graphics')

		this.buffers = {}

		this.cfgDir = this.registry.cfgDir

		this.pushed = {}
		this.page = {}
		this.style = {}
		this.pincodebuffer = {}

		this.system.on('graphics_bank_invalidate', this.invalidateBank.bind(this))
		this.system.on('graphics_indicate_push', this.indicatePush.bind(this))
		this.system.on('graphics_is_pushed', this.isPushed.bind(this))

		// get page object
		this.system.emit('get_page', (page) => {
			this.page = page
		})

		// when page names are updated
		this.system.on('page_update', (page, obj) => {
			debug('page controls invalidated for page', page)
			this.system.emit('graphics_page_controls_invalidated', page)
		})

		this.system.on('graphics_page_controls_invalidated', (page) => {
			if (page !== undefined) {
				for (let bank = 1; bank <= global.MAX_BUTTONS; bank++) {
					let style = this.style[page + '_' + bank]
					if (style == 'pageup' || style == 'pagedown' || style == 'pagenum') {
						this.system.emit('bank_style', page, bank, style)
						this.invalidateBank(page, bank)
					}
				}
			} else {
				for (let page = 1; page <= 99; page++) {
					for (let bank = 1; bank <= global.MAX_BUTTONS; bank++) {
						let style = this.style[page + '_' + bank]
						if (style == 'pageup' || style == 'pagedown' || style == 'pagenum') {
							this.system.emit('bank_style', page, bank, style)
							this.invalidateBank(page, bank)
						}
					}
				}
			}
		})

		// draw custom bank (presets, previews etc)
		this.system.on('graphics_preview_generate', (config, cb) => {
			if (typeof cb == 'function') {
				let img = this.drawBankImage(config)
				if (img !== undefined) {
					cb(img.buffer())
				} else {
					cb(null)
				}
			}
		})

		this.generate()
	}

	drawBank(page, bank) {
		let img

		page = parseInt(page)
		bank = parseInt(bank)

		let c = this.bank.getBankWithFeedback(page, bank)

		if (c !== undefined && c.style !== undefined) {
			img = this.drawBankImage(c, page, bank)
		} else {
			img = this.buffers[page + '_' + bank] = new Image(72, 72)

			img.drawTextLine(2, 3, page + '.' + bank, Image.rgb(50, 50, 50), 0)
			img.horizontalLine(13, Image.rgb(30, 30, 30))
		}

		return img
	}

	drawBankImage(c, page, bank) {
		let img
		let notStatic = page === undefined || bank === undefined

		this.style[page + '_' + bank] = c.style

		if (page !== undefined && bank !== undefined) {
			if (this.buffers[page + '_' + bank] === undefined) {
				img = this.buffers[page + '_' + bank] = new Image(72, 72)
			} else {
				img = this.buffers[page + '_' + bank]
				img.boxFilled(0, 0, 71, 14, Image.rgb(0, 0, 0))
			}
		} else {
			img = new Image(72, 72)
		}

		// Don't draw the line on page buttons
		if (c.style !== 'pageup' && c.style !== 'pagedown' && c.style !== 'pagenum') {
			img.horizontalLine(13, Image.rgb(255, 198, 0))
		} else {
			if (c.style == 'pageup') {
				img.backgroundColor(Image.rgb(15, 15, 15))

				if (this.userconfig.getKey('page_plusminus')) {
					img.drawLetter(
						30,
						20,
						this.userconfig.getKey('page_direction_flipped') ? '-' : '+',
						Image.rgb(255, 255, 255),
						0,
						1
					)
				} else {
					img.drawLetter(26, 20, 'arrow_up', Image.rgb(255, 255, 255), 'icon')
				}

				img.drawAlignedText(0, 39, 72, 8, 'UP', Image.rgb(255, 198, 0), 0, undefined, 1, 'center', 'center')
			} else if (c.style == 'pagedown') {
				img.backgroundColor(Image.rgb(15, 15, 15))

				if (this.userconfig.getKey('page_plusminus')) {
					img.drawLetter(
						30,
						40,
						this.userconfig.getKey('page_direction_flipped') ? '+' : '-',
						Image.rgb(255, 255, 255),
						0,
						1
					)
				} else {
					img.drawLetter(26, 40, 'arrow_down', Image.rgb(255, 255, 255), 'icon')
				}

				img.drawCenterText(36, 28, 'DOWN', Image.rgb(255, 198, 0), 0)
			} else if (c.style == 'pagenum') {
				img.backgroundColor(Image.rgb(15, 15, 15))

				if (page === undefined) {
					// Preview (no page/bank)
					img.drawAlignedText(0, 0, 72, 30, 'PAGE', Image.rgb(255, 198, 0), 0, undefined, 1, 'center', 'bottom')
					img.drawAlignedText(0, 32, 72, 30, 'x', Image.rgb(255, 255, 255), 18, undefined, 1, 'center', 'top')
				} else if (this.page[page] === undefined || this.page[page].name === 'PAGE' || this.page[page].name === '') {
					img.drawAlignedText(0, 0, 72, 30, 'PAGE', Image.rgb(255, 198, 0), 0, undefined, 1, 'center', 'bottom')
					img.drawAlignedText(0, 32, 72, 30, '' + page, Image.rgb(255, 255, 255), 18, undefined, 1, 'center', 'top')
				} else {
					let pagename = this.page[page].name
					img.drawAlignedText(0, 0, 72, 72, pagename, Image.rgb(255, 255, 255), '18', 2, 0, 'center', 'center')
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
			if (this.userconfig.getKey('remove_topbar')) {
				img.boxFilled(0, 0, 71, 71, c.bgcolor)
			} else {
				img.boxFilled(0, 14, 71, 71, c.bgcolor)
			}

			this.system.emit('graphics_set_bank_bg', page, bank, c.bgcolor)
		} else {
			// ensure any previous colour is cleared
			this.system.emit('graphics_set_bank_bg', page, bank, 0)
		}

		if (!notStatic) {
			let colors = [0, Image.rgb(255, 127, 0), Image.rgb(255, 0, 0)]
			let status = this.bank.getBankStatus(page, bank)

			if (status > 0) {
				img.boxFilled(62, 2, 70, 10, colors[status])
			}

			if (this.bank.getRunningActions(page, bank)) {
				img.drawLetter(55, 3, 'play', Image.rgb(0, 255, 0), 'icon')
			}
		}

		if (c.style == 'png' || c.style == 'text') {
			if (c.png64 !== undefined) {
				try {
					let data = Buffer.from(c.png64, 'base64')
					let halign = c.pngalignment.split(':', 2)[0]
					let valign = c.pngalignment.split(':', 2)[1]

					if (this.userconfig.getKey('remove_topbar')) {
						img.drawFromPNGdata(data, 0, 0, 72, 72, halign, valign)
					} else {
						img.drawFromPNGdata(data, 0, 14, 72, 58, halign, valign)
					}
				} catch (e) {
					img.boxFilled(0, 14, 71, 57, 0)
					img.drawAlignedText(2, 18, 68, 52, 'PNG ERROR', Image.rgb(255, 0, 0), 0, 2, 1, 'center', 'center')
					return img
				}
			} else {
				if (fs.existsSync(this.cfgDir + '/banks/' + page + '_' + bank + '.png')) {
					// one last time
					img.drawFromPNG(this.cfgDir + '/banks/' + page + '_' + bank + '.png', 0, 14)

					// Upgrade config with base64 and delete file
					try {
						data = fs.readFileSync(this.cfgDir + '/banks/' + page + '_' + bank + '.png')
						this.system.emit('bank_set_key', page, bank, 'png64', data.toString('base64'))
						fs.unlink(this.cfgDir + '/banks/' + page + '_' + bank + '.png')
					} catch (e) {
						debug('Error upgrading config to inline png for bank ' + page + '.' + bank)
						debug('Reason:' + e.message)
					}
				}
			}

			/* raw image buffers */
			if (c.img64 !== undefined) {
				if (this.userconfig.getKey('remove_topbar')) {
					img.drawPixelBuffer(0, 0, 72, 72, c.img64, 'base64')
				} else {
					img.drawPixelBuffer(0, 14, 72, 58, c.img64, 'base64')
				}
			}
		}

		if (c.style == 'text' || c.style == 'png') {
			let text

			this.system.emit('variable_parse', c.text, (str) => {
				text = str
			})

			var halign = c.alignment.split(':', 2)[0]
			var valign = c.alignment.split(':', 2)[1]

			if (c.size == 'small') {
				c.size = 0
			} else if (c.size == 'large') {
				c.size = 14
			} else if (c.size == 7) {
				c.size = 0
			}

			if (c.size != 'auto') {
				if (this.userconfig.getKey('remove_topbar')) {
					img.drawAlignedText(2, 2, 68, 68, text, c.color, parseInt(c.size), 2, 1, halign, valign)
				} else {
					img.drawAlignedText(2, 18, 68, 52, text, c.color, parseInt(c.size), 2, 1, halign, valign)
				}
			} else {
				if (this.userconfig.getKey('remove_topbar')) {
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
				if (this.userconfig.getKey('remove_topbar')) {
					img.drawBorder(3, rgb(255, 198, 0))
				} else {
					img.boxFilled(0, 0, 71, 14, rgb(255, 198, 0))
					img.drawTextLine(3, 3, page + '.' + bank, img.rgb(0, 0, 0), 0)
				}
			}
		} else {
			// not pushed
			if (
				c.style !== 'pageup' &&
				c.style !== 'pagedown' &&
				c.style !== 'pagenum' &&
				!this.userconfig.getKey('remove_topbar')
			) {
				img.drawTextLine(3, 3, page + '.' + bank, img.rgb(255, 198, 0), 0)
			}
		}

		return img
	}

	drawControls() {
		// page up
		let img = (this.buffers['up'] = new Image(72, 72))
		img.backgroundColor(Image.rgb(15, 15, 15))

		if (this.userconfig.getKey('page_plusminus')) {
			img.drawLetter(
				30,
				20,
				this.userconfig.getKey('page_direction_flipped') ? '-' : '+',
				Image.rgb(255, 255, 255),
				0,
				1
			)
		} else {
			img.drawLetter(26, 20, 'arrow_up', Image.rgb(255, 255, 255), 'icon')
		}

		img.drawAlignedText(0, 39, 72, 8, 'PAGE UP', Image.rgb(255, 198, 0), 0, undefined, 1, 'center', 'center')

		// page down
		img = this.buffers['down'] = new Image(72, 72)
		img.backgroundColor(Image.rgb(15, 15, 15))

		if (this.userconfig.getKey('page_plusminus')) {
			img.drawLetter(
				30,
				40,
				this.userconfig.getKey('page_direction_flipped') ? '+' : '-',
				Image.rgb(255, 255, 255),
				0,
				1
			)
		} else {
			img.drawLetter(26, 40, 'arrow_down', Image.rgb(255, 255, 255), 'icon')
		}

		img.drawCenterText(36, 28, 'PAGE DOWN', Image.rgb(255, 198, 0), 0)
	}

	drawPage(page, invalidate) {
		for (let bank = 1; bank <= global.MAX_BUTTONS; ++bank) {
			this.drawBank(page, bank)

			if (invalidate) {
				this.system.emit('graphics_bank_invalidated', page, bank)
			}
		}
	}

	generate(invalidate) {
		for (let p = 1; p <= 99; p++) {
			this.drawPage(p, invalidate)
		}
	}

	getBank(page, bank) {
		let img = this.buffers[page + '_' + bank]

		if (img === undefined) {
			this.drawBank(page, bank)
			img = this.buffers[page + '_' + bank]
		}

		if (img === undefined) {
			debug('!!!! ERROR: UNEXPECTED ERROR while fetching image for unbuffered bank: ' + page + '.' + bank)

			// continue gracefully, even though something is terribly wrong
			return { buffer: new Image(72, 72), updated: Date.now() }
		}

		return { buffer: img.buffer(), updated: img.lastUpdate }
	}

	getImagesForPage(page) {
		let result = {}

		for (let i = 0; i < global.MAX_BUTTONS; ++i) {
			if (this.buffers[page + '_' + (parseInt(i) + 1)] === undefined) {
				result[i] = new Image(72, 72).bufferAndTime()
			} else {
				result[i] = this.buffers[page + '_' + (parseInt(i) + 1)].bufferAndTime()
			}
		}

		return result
	}

	getImagesForPincode(pincode) {
		let b = '1 2 3 4 6 7 8 9 11 12 13 14'.split(/ /)
		let img

		if (this.pincodebuffer[0] === undefined) {
			for (let i = 0; i < 10; i++) {
				img = new Image(72, 72)
				img.backgroundColor(Image.rgb(15, 15, 15))
				img.drawAlignedText(0, 0, 72, 72, i.toString(), Image.rgb(255, 255, 255), 44, undefined, 44, 'center', 'center')
				this.pincodebuffer[i] = img.bufferAndTime()
			}
		}

		img = new Image(72, 72)
		img.backgroundColor(Image.rgb(15, 15, 15))
		img.drawAlignedText(0, -10, 72, 72, 'Lockout', Image.rgb(255, 198, 0), 14, undefined, 44, 'center', 'center')

		if (!(pincode === undefined)) {
			img.drawAlignedText(
				0,
				15,
				72,
				72,
				pincode.replace(/[a-z0-9]/gi, '*'),
				Image.rgb(255, 255, 255),
				18,
				undefined,
				44,
				'center',
				'center'
			)
		}

		this.pincodebuffer[10] = img.bufferAndTime()

		img = new Image(72, 72)
		img.backgroundColor(Image.rgb(15, 15, 15))
		this.pincodebuffer[11] = img.bufferAndTime()

		return this.pincodebuffer
	}

	getPageButton(page) {
		let img = new Image(72, 72)

		img.backgroundColor(Image.rgb(15, 15, 15))
		img.drawAlignedText(
			0,
			0,
			72,
			30,
			this.page[page] !== undefined ? this.page[page].name : '',
			Image.rgb(255, 198, 0),
			0,
			undefined,
			1,
			'center',
			'bottom'
		)
		img.drawAlignedText(0, 32, 72, 30, '' + page, Image.rgb(255, 255, 255), 18, undefined, 1, 'center', 'top')
		return img
	}

	indicatePush(page, bank, state) {
		this.buffers[page + '_' + bank] = undefined

		if (state) {
			/* indicate push */
			this.buffers[page + '_' + bank] = undefined
			this.pushed[page + '_' + bank] = 1
		} else {
			this.buffers[page + '_' + bank] = undefined
			delete this.pushed[page + '_' + bank]
		}

		this.drawBank(page, bank)
		this.system.emit('graphics_bank_invalidated', page, bank)
	}

	invalidateBank(page, bank) {
		this.buffers[page + '_' + bank] = undefined
		this.style[page + '_' + bank] = undefined
		this.drawBank(page, bank)

		this.system.emit('graphics_bank_invalidated', page, bank)
	}

	isPushed(page, bank, cb) {
		cb(this.pushed[page + '_' + bank])
	}

	updateUserconfig(key, value) {
		if (key == 'remove_topbar') {
			this.generate(true)
		}
	}
}

// Graphics is a singleton class
exports = module.exports = Graphics

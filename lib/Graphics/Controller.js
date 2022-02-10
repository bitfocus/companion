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

const Image = require('./Image')
const { cloneDeep } = require('lodash')
const { rgb } = require('../Resources/Util')

const colorButtonYellow = rgb(255, 198, 0)
const colorWhite = rgb(255, 255, 255)
const colorBlack = rgb(0, 0, 0)
const charCodePlus = '+'.charCodeAt(0)
const charCodeMinus = '-'.charCodeAt(0)

const CoreBase = require('../Core/Base')

const internalIcons = {
	// 15x8 argb
	cloud: Buffer.from(
		'AAAAAAAAAAAAAAAAAAAAAAAAAAAD////D////4L////7//////////D+/v51+/v7A////wAAAAAAAAAAAAAAAAAAA' +
			'AAAAAAAAAAAAAAAAABN////kf///////////v7+//z8/P/5+fn/9vb2RfDw8AAAAAAAAAAAAAAAAAAAAAB7///////////////0/////' +
			'P7+/v/9/f3/+vr6//b29v/y8vL/7e3tf+np6QAAAAAAAAAAAv///xz///+k/////////////////f39//r6+v/39/f/8/Pz/+7u7v/p6' +
			'en/5OTkquDg4DDV1dUC////N////6v////s/v7+//39/f/7+/v/+Pj4//T09P/v7+//6urq/+Xl5f/g4OD/3Nzc8dfX18DS0tJKz8/Pt' +
			'P/////+/v7/+/v7//n5+f/09PT/8PDw/+vr6//m5ub/4eHh/9zc3P/Y2Nj/1NTU/9HR0f/Ozs7HzMzM2Pv7+//5+fn/9fX1//Hx8f/s7' +
			'Oz/5+fn/+Li4v/d3d3/2dnZ/9TU1P/R0dH/z8/P/83Nzf/MzMzGy8vLVvb29u7y8vL/7e3t/+jo6P/j4+P/3t7e/9nZ2f/V1dX/0dHR/' +
			'87Ozv/Nzc3/zMzM/8zMzOHMzMwwysrK',
		'base64'
	),
}

class GraphicsController extends CoreBase {
	constructor(registry) {
		super(registry, 'graphics', 'lib/Graphics/Controller')

		this.buffers = {}
		this.page_direction_flipped = false
		this.page_plusminus = false
		this.remove_topbar = false

		this.pushed = {}
		this.style = {}
		this.pincodebuffer = {}
		this.lastdrawproperties = {}

		this.system.on('graphics_bank_invalidate', this.invalidateBank.bind(this))
		this.system.on('graphics_indicate_push', this.indicatePush.bind(this))
		this.system.on('graphics_is_pushed', this.isPushed.bind(this))

		// get userconfig object
		this.system.emit('get_userconfig', (userconfig) => {
			this.page_direction_flipped = userconfig.page_direction_flipped
			this.page_plusminus = userconfig.page_plusminus
			this.remove_topbar = userconfig.remove_topbar
		})

		this.system.on('action_bank_status_set', (page, bank, status) => {
			this.invalidateBank(page, bank)
		})

		this.system.on('graphics_page_controls_invalidated', (page) => {
			if (page !== undefined) {
				for (let bank = 1; bank <= global.MAX_BUTTONS; bank++) {
					let style = this.style[page + '_' + bank]
					if (style == 'pageup' || style == 'pagedown' || style == 'pagenum') {
						this.invalidateBank(page, bank)
					}
				}
			} else {
				for (let page = 1; page <= 99; page++) {
					for (let bank = 1; bank <= global.MAX_BUTTONS; bank++) {
						let style = this.style[page + '_' + bank]
						if (style == 'pageup' || style == 'pagedown' || style == 'pagenum') {
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

		this.system.on('io_connect', (client) => {
			client.on('graphics_preview_generate', (config, answer) => {
				this.system.emit('graphics_preview_generate', config, (img) => {
					answer(img)
				})
			})
		})
	}

	updateUserConfig(key, value) {
		if (key == 'page_direction_flipped') {
			this.page_direction_flipped = value
			this.debug('page controls invalidated')
			this.system.emit('graphics_page_controls_invalidated')
		}
		if (key == 'page_plusminus') {
			this.page_plusminus = value
			this.debug('page controls invalidated')
			this.system.emit('graphics_page_controls_invalidated')
		}
		if (key == 'remove_topbar') {
			this.remove_topbar = value
			this.debug('Topbar removed')
			// Delay redrawing to give instances a chance to adjust
			setTimeout(() => {
				this.system.emit('feedback_check_all_banks')
				this.generate(true)
			}, 1000)
		}
	}

	invalidateBank(page, bank) {
		this.buffers[page + '_' + bank] = undefined
		this.style[page + '_' + bank] = undefined
		this.drawBank(page, bank)

		this.system.emit('graphics_bank_invalidated', page, bank)
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

	isPushed(page, bank, cb) {
		cb(!!this.pushed[page + '_' + bank])
	}

	generate(invalidate) {
		for (let page = 1; page <= 99; page++) {
			for (let bank = 1; bank <= global.MAX_BUTTONS; ++bank) {
				this.drawBank(page, bank)

				if (invalidate) {
					this.system.emit('graphics_bank_invalidated', page, bank)
				}
			}
		}
	}

	drawBankImage(c, page, bank) {
		let img

		this.style[page + '_' + bank] = c.style

		if (page !== undefined && bank !== undefined) {
			if (this.buffers[page + '_' + bank] === undefined) {
				img = this.buffers[page + '_' + bank] = new Image(72, 72)
			} else {
				img = this.buffers[page + '_' + bank]
				img.boxFilled(0, 0, 71, 14, colorBlack)
			}
		} else {
			img = new Image(72, 72)
		}

		// clear the lastdrawproperties, it gets set again if it was used
		delete this.lastdrawproperties[page + '_' + bank]

		// special button types
		if (c.style == 'pageup') {
			this.lastdrawproperties[page + '_' + bank] = 'pageup'

			img.fillColor(img.rgb(15, 15, 15))

			// ensure any previous colour is cleared
			this.system.emit('graphics_set_bank_bg', page, bank, 0)

			if (this.page_plusminus) {
				img.drawChar(30, 20, this.page_direction_flipped ? charCodeMinus : charCodePlus, colorWhite, 0, 1)
			} else {
				img.drawChar(26, 20, 'arrow_up', colorWhite, 'icon')
			}

			img.drawAlignedText(0, 39, 72, 8, 'UP', colorButtonYellow, 0, undefined, 1, 'center', 'center')
		} else if (c.style == 'pagedown') {
			this.lastdrawproperties[page + '_' + bank] = 'pagedown'

			img.fillColor(img.rgb(15, 15, 15))

			// ensure any previous colour is cleared
			this.system.emit('graphics_set_bank_bg', page, bank, 0)

			if (this.page_plusminus) {
				img.drawChar(30, 40, this.page_direction_flipped ? charCodePlus : charCodeMinus, colorWhite, 0, 1)
			} else {
				img.drawChar(26, 40, 'arrow_down', colorWhite, 'icon')
			}

			img.drawAlignedText(0, 25, 72, 8, 'DOWN', colorButtonYellow, 0, undefined, 1, 'center', 'center')
		} else if (c.style == 'pagenum') {
			this.lastdrawproperties[page + '_' + bank] = 'pagenum'

			img.fillColor(img.rgb(15, 15, 15))

			// ensure any previous colour is cleared
			this.system.emit('graphics_set_bank_bg', page, bank, 0)

			let pagename = this.page.getPageName(page)

			if (page === undefined) {
				// Preview (no page/bank)
				img.drawAlignedText(0, 0, 72, 30, 'PAGE', colorButtonYellow, 0, undefined, 1, 'center', 'bottom')
				img.drawAlignedText(0, 32, 72, 30, 'x', colorWhite, 18, undefined, 1, 'center', 'top')
			} else if (pagename === '') {
				img.drawAlignedText(0, 0, 72, 30, 'PAGE', colorButtonYellow, 0, undefined, 1, 'center', 'bottom')
				img.drawAlignedText(0, 32, 72, 30, '' + page, colorWhite, 18, undefined, 1, 'center', 'top')
			} else {
				img.drawAlignedText(0, 0, 72, 72, pagename, colorWhite, '18', 2, 0, 'center', 'center')
			}
		} else if (c.style) {
			this.lastdrawproperties[page + '_' + bank] = c

			// handle upgrade from pre alignment-support configuration
			if (c.alignment === undefined) {
				c.alignment = 'center:center'
			}
			if (c.pngalignment === undefined) {
				c.pngalignment = 'center:center'
			}

			// Background
			this.remove_topbar ? img.boxFilled(0, 0, 71, 71, c.bgcolor) : img.boxFilled(0, 14, 71, 71, c.bgcolor)
			this.system.emit('graphics_set_bank_bg', page, bank, c.bgcolor)

			if (c.png64 !== undefined && c.png64 !== null) {
				try {
					let data = Buffer.from(c.png64, 'base64')
					let halign = c.pngalignment.split(':', 2)[0]
					let valign = c.pngalignment.split(':', 2)[1]

					this.remove_topbar
						? img.drawFromPNGdata(data, 0, 0, 72, 72, halign, valign)
						: img.drawFromPNGdata(data, 0, 14, 72, 58, halign, valign)
				} catch (e) {
					img.boxFilled(0, 14, 71, 57, 0)
					this.remove_topbar
						? img.drawAlignedText(2, 2, 68, 68, 'PNG ERROR', img.rgb(255, 0, 0), 0, 2, 1, 'center', 'center')
						: img.drawAlignedText(2, 18, 68, 52, 'PNG ERROR', img.rgb(255, 0, 0), 0, 2, 1, 'center', 'center')
					this.drawTopbar(img, c, page, bank)
					return img
				}
			}

			/* raw image buffers */
			if (c.img64 !== undefined) {
				try {
					this.remove_topbar
						? img.drawPixelBuffer(0, 0, 72, 72, c.img64, 'base64')
						: img.drawPixelBuffer(0, 14, 72, 58, c.img64, 'base64')
				} catch (e) {
					img.boxFilled(0, 14, 71, 57, 0)
					this.remove_topbar
						? img.drawAlignedText(2, 2, 68, 68, 'IMAGE\\nDRAW\\nERROR', img.rgb(255, 0, 0), 0, 2, 1, 'center', 'center')
						: img.drawAlignedText(
								2,
								18,
								68,
								52,
								'IMAGE\\nDRAW\\nERROR',
								img.rgb(255, 0, 0),
								0,
								2,
								1,
								'center',
								'center'
						  )
					this.drawTopbar(img, c, page, bank)
					return img
				}
			}

			let halign = c.alignment.split(':', 2)[0]
			let valign = c.alignment.split(':', 2)[1]
			if (c.size == 'small') c.size = 0
			if (c.size == 'large') c.size = 14
			if (c.size == 7) c.size = 0

			if (this.remove_topbar) {
				img.drawAlignedText(2, 2, 68, 68, c.text, c.color, c.size, 2, 1, halign, valign)
			} else {
				img.drawAlignedText(2, 18, 68, 52, c.text, c.color, c.size, 2, 1, halign, valign)
			}

			this.drawTopbar(img, c, page, bank)
		}

		return img
	}

	drawTopbar(img, c, page, bank) {
		if (this.remove_topbar) {
			if (this.pushed[page + '_' + bank]) {
				img.drawBorder(3, colorButtonYellow)
			}
		} else {
			let step = ''
			img.horizontalLine(13, colorButtonYellow)

			if (c.style == 'step' && page !== undefined) {
				step = `.${c.step_cycle}`
			}

			if (page === undefined) {
				// Preview (no page/bank)
				img.drawTextLine(3, 3, `x.x.${step}`, colorButtonYellow, 0)
			} else if (this.pushed[page + '_' + bank]) {
				img.boxFilled(0, 0, 71, 14, colorButtonYellow)
				img.drawTextLine(3, 3, `${page}.${bank}${step}`, colorBlack, 0)
			} else {
				img.drawTextLine(3, 3, `${page}.${bank}${step}`, colorButtonYellow, 0)
			}
		}

		if (page !== undefined || bank !== undefined) {
			this.system.emit('action_bank_status_get', page, bank, (status) => {
				let colors = [0, img.rgb(255, 127, 0), img.rgb(255, 0, 0)]

				if (status > 0) {
					img.boxFilled(62, 2, 70, 10, colors[status])
				}
			})

			this.system.emit('action_running_get', page, bank, (running) => {
				if (running) {
					img.drawChar(55, 3, 'play', img.rgb(0, 255, 0), 'icon')
				}
			})
		}

		if (c.cloud && !this.remove_topbar) {
			img.drawPixelBuffer(35, 3, 15, 8, internalIcons.cloud)
		}

		return img
	}

	drawBank(page, bank) {
		let img

		page = parseInt(page)
		bank = parseInt(bank)

		if (
			this.bank.config[page] !== undefined &&
			this.bank.config[page][bank] !== undefined &&
			this.bank.config[page][bank].style !== undefined
		) {
			let c = cloneDeep(this.bank.config[page][bank])

			// Fetch feedback-overrides for bank
			this.system.emit('feedback_get_style', page, bank, (style) => {
				if (style !== undefined) {
					for (const key in style) {
						c[key] = style[key]
					}
				}
			})

			this.system.emit('variable_parse', c.text, (str) => {
				c.text = str
			})

			if (c.style == 'step') {
				this.system.emit('action_get_bank_active_step', page, bank, (step) => {
					c['step_cycle'] = parseInt(step) + 1
				})
			}

			img = this.drawBankImage(c, page, bank)
			this.system.emit('graphics_bank_redrawn', page, bank, c)
		} else {
			img = this.buffers[page + '_' + bank] = new Image(72, 72)

			img.drawTextLine(2, 3, page + '.' + bank, img.rgb(50, 50, 50), 0)
			img.horizontalLine(13, img.rgb(30, 30, 30))

			delete this.lastdrawproperties[page + '_' + bank]
		}

		return img
	}

	getImagesForPincode(pincode) {
		let img

		if (this.pincodebuffer[0] === undefined) {
			for (let i = 0; i < 10; i++) {
				img = new Image(72, 72)
				img.fillColor(img.rgb(15, 15, 15))
				img.drawAlignedText(0, 0, 72, 72, i.toString(), colorWhite, 44, undefined, 44, 'center', 'center')
				this.pincodebuffer[i] = img.bufferAndTime()
			}
		}
		img = new Image(72, 72)
		img.fillColor(img.rgb(15, 15, 15))
		img.drawAlignedText(0, -10, 72, 72, 'Lockout', colorButtonYellow, 14, undefined, 44, 'center', 'center')
		if (pincode !== undefined) {
			img.drawAlignedText(
				0,
				15,
				72,
				72,
				pincode.replace(/[a-z0-9]/gi, '*'),
				colorWhite,
				18,
				undefined,
				44,
				'center',
				'center'
			)
		}
		this.pincodebuffer[10] = img.bufferAndTime()

		return this.pincodebuffer
	}

	getImagesForPage(page) {
		let result = {}

		for (let i = 0; i < global.MAX_BUTTONS; ++i) {
			const bankId = `${page}_${i + 1}`
			if (this.buffers[bankId] === undefined) {
				result[i] = Image.emptyAndTime()
			} else {
				result[i] = this.buffers[bankId].bufferAndTime()
				result[i].style = this.lastdrawproperties[bankId]
			}
		}

		return result
	}

	getBank(page, bank) {
		let img = this.buffers[page + '_' + bank]

		if (img === undefined) {
			this.drawBank(page, bank)
			img = this.buffers[page + '_' + bank]
		}

		if (img === undefined) {
			this.debug('!!!! ERROR: UNEXPECTED ERROR while fetching image for unbuffered bank: ' + page + '.' + bank)

			// continue gracefully, even though something is terribly wrong
			return {
				buffer: Buffer.alloc(72 * 72 * 3),
				updated: Date.now(),
			}
		}

		return {
			buffer: img.buffer(),
			style: this.lastdrawproperties[page + '_' + bank],
			updated: img.lastUpdate,
		}
	}
}

module.exports = GraphicsController

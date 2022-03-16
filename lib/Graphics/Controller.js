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

import Image from './Image.js'
import { rgb } from '../Resources/Util.js'

const colorButtonYellow = rgb(255, 198, 0)
const colorWhite = rgb(255, 255, 255)
const colorBlack = rgb(0, 0, 0)
const charCodePlus = '+'.charCodeAt(0)
const charCodeMinus = '-'.charCodeAt(0)

import CoreBase from '../Core/Base.js'

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

		this.page_direction_flipped = this.userconfig.getKey('page_direction_flipped')
		this.page_plusminus = this.userconfig.getKey('page_plusminus')
		this.remove_topbar = this.userconfig.getKey('remove_topbar')

		this.buffers = {}
		this.lastdrawproperties = {}
	}

	/**
	 * Redraw the page controls on every page
	 */
	invalidatePageControls() {
		for (let page = 1; page <= 99; page++) {
			for (let bank = 1; bank <= global.MAX_BUTTONS; bank++) {
				const style = this.lastdrawproperties[page + '_' + bank]
				if (style == 'pageup' || style == 'pagedown') {
					this.invalidateBank(page, bank)
				}
			}
		}
	}
	/**
	 * Redraw the page number control on the specified page
	 * @param {number } page
	 */
	invalidatePageNumberControls(page) {
		if (page) {
			for (let bank = 1; bank <= global.MAX_BUTTONS; bank++) {
				const style = this.lastdrawproperties[page + '_' + bank]
				if (style == 'pagenum') {
					this.invalidateBank(page, bank)
				}
			}
		}
	}

	/**
	 * Setup a new socket client's events
	 * @param {SocketIO} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
		client.on('graphics_preview_generate', (config, answer) => {
			const img = this.#drawBankImage(config)
			if (img !== undefined) {
				answer(img.buffer())
			} else {
				answer(null)
			}
		})
	}

	/**
	 * Process an updated userconfig value and update as necessary.
	 * @param {string} key - the saved key
	 * @param {(boolean|number|string)} value - the saved value
	 * @access public
	 */
	updateUserConfig(key, value) {
		if (key == 'page_direction_flipped') {
			this.page_direction_flipped = value
			this.invalidatePageControls()
		} else if (key == 'page_plusminus') {
			this.page_plusminus = value
			this.invalidatePageControls()
		} else if (key == 'remove_topbar') {
			this.remove_topbar = value
			this.debug('Topbar removed')
			// Delay redrawing to give instances a chance to adjust
			setTimeout(() => {
				this.instance.moduleHost.resubscribeAllFeedbacks()
				this.regenerateAll(true)
			}, 1000)
		}
	}

	invalidateBank(page, bank) {
		this.buffers[page + '_' + bank] = undefined
		this.lastdrawproperties[page + '_' + bank] = undefined
		this.drawBank(page, bank)

		this.system.emit('graphics_bank_invalidated', page, bank)
	}

	/**
	 * Regenerate every bank image
	 * @param {boolean} invalidate whether to report invalidations of each bank
	 * @access private
	 */
	regenerateAll(invalidate) {
		for (let page = 1; page <= 99; page++) {
			for (let bank = 1; bank <= global.MAX_BUTTONS; ++bank) {
				this.drawBank(page, bank)

				if (invalidate) {
					this.system.emit('graphics_bank_invalidated', page, bank)
				}
			}
		}
	}

	/**
	 * Draw the image for a bank
	 * @param {object} bankStyle The style to draw
	 * @param {number | undefined} page
	 * @param {number | undefined} bank
	 * @access private
	 * @returns Image object
	 */
	#drawBankImage(bankStyle, page, bank) {
		let img

		const imageId = page !== undefined && bank !== undefined ? `${page}_${bank}` : undefined

		if (imageId) {
			if (!this.buffers[imageId]) {
				img = this.buffers[imageId] = new Image(72, 72)
			} else {
				img = this.buffers[imageId]
				img.boxFilled(0, 0, 71, 14, colorBlack)
			}
		} else {
			img = new Image(72, 72)
		}

		// clear the lastdrawproperties, it gets set again if it was used
		if (imageId) delete this.lastdrawproperties[imageId]

		// special button types
		if (bankStyle.style == 'pageup') {
			if (imageId) this.lastdrawproperties[imageId] = 'pageup'

			img.fillColor(img.rgb(15, 15, 15))

			// ensure any previous colour is cleared
			this.system.emit('graphics_set_bank_bg', page, bank, 0)

			if (this.page_plusminus) {
				img.drawChar(30, 20, this.page_direction_flipped ? charCodeMinus : charCodePlus, colorWhite, 0, 1)
			} else {
				img.drawChar(26, 20, 'arrow_up', colorWhite, 'icon')
			}

			img.drawAlignedText(0, 39, 72, 8, 'UP', colorButtonYellow, 0, undefined, 1, 'center', 'center')
		} else if (bankStyle.style == 'pagedown') {
			if (imageId) this.lastdrawproperties[imageId] = 'pagedown'

			img.fillColor(img.rgb(15, 15, 15))

			// ensure any previous colour is cleared
			this.system.emit('graphics_set_bank_bg', page, bank, 0)

			if (this.page_plusminus) {
				img.drawChar(30, 40, this.page_direction_flipped ? charCodePlus : charCodeMinus, colorWhite, 0, 1)
			} else {
				img.drawChar(26, 40, 'arrow_down', colorWhite, 'icon')
			}

			img.drawAlignedText(0, 25, 72, 8, 'DOWN', colorButtonYellow, 0, undefined, 1, 'center', 'center')
		} else if (bankStyle.style == 'pagenum') {
			if (imageId) this.lastdrawproperties[imageId] = 'pagenum'

			img.fillColor(img.rgb(15, 15, 15))

			// ensure any previous colour is cleared
			this.system.emit('graphics_set_bank_bg', page, bank, 0)

			let pagename = this.page.getPageName(page)

			if (page === undefined) {
				// Preview (no page/bank)
				img.drawAlignedText(0, 0, 72, 30, 'PAGE', colorButtonYellow, 0, undefined, 1, 'center', 'bottom')
				img.drawAlignedText(0, 32, 72, 30, 'x', colorWhite, 18, undefined, 1, 'center', 'top')
			} else if (pagename === '' || pagename.toLowerCase() == 'page') {
				img.drawAlignedText(0, 0, 72, 30, 'PAGE', colorButtonYellow, 0, undefined, 1, 'center', 'bottom')
				img.drawAlignedText(0, 32, 72, 30, '' + page, colorWhite, 18, undefined, 1, 'center', 'top')
			} else {
				img.drawAlignedText(0, 0, 72, 72, pagename, colorWhite, '18', 2, 0, 'center', 'center')
			}
		} else if (bankStyle.style) {
			if (imageId) this.lastdrawproperties[imageId] = bankStyle

			// handle upgrade from pre alignment-support configuration
			if (bankStyle.alignment === undefined) {
				bankStyle.alignment = 'center:center'
			}
			if (bankStyle.pngalignment === undefined) {
				bankStyle.pngalignment = 'center:center'
			}

			// Background
			this.remove_topbar
				? img.boxFilled(0, 0, 71, 71, bankStyle.bgcolor)
				: img.boxFilled(0, 14, 71, 71, bankStyle.bgcolor)
			this.system.emit('graphics_set_bank_bg', page, bank, bankStyle.bgcolor)

			if (bankStyle.png64 !== undefined && bankStyle.png64 !== null) {
				try {
					let data = Buffer.from(bankStyle.png64, 'base64')
					let halign = bankStyle.pngalignment.split(':', 2)[0]
					let valign = bankStyle.pngalignment.split(':', 2)[1]

					this.remove_topbar
						? img.drawFromPNGdata(data, 0, 0, 72, 72, halign, valign)
						: img.drawFromPNGdata(data, 0, 14, 72, 58, halign, valign)
				} catch (e) {
					img.boxFilled(0, 14, 71, 57, 0)
					this.remove_topbar
						? img.drawAlignedText(2, 2, 68, 68, 'PNG ERROR', img.rgb(255, 0, 0), 0, 2, 1, 'center', 'center')
						: img.drawAlignedText(2, 18, 68, 52, 'PNG ERROR', img.rgb(255, 0, 0), 0, 2, 1, 'center', 'center')
					this.#drawTopbar(img, bankStyle, page, bank)
					return img
				}
			}

			/* raw image buffers */
			if (bankStyle.img64 !== undefined) {
				try {
					this.remove_topbar
						? img.drawPixelBuffer(0, 0, 72, 72, bankStyle.img64, 'base64')
						: img.drawPixelBuffer(0, 14, 72, 58, bankStyle.img64, 'base64')
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
					this.#drawTopbar(img, bankStyle, page, bank)
					return img
				}
			}

			let halign = bankStyle.alignment.split(':', 2)[0]
			let valign = bankStyle.alignment.split(':', 2)[1]
			if (bankStyle.size == 'small') bankStyle.size = 0
			if (bankStyle.size == 'large') bankStyle.size = 14
			if (bankStyle.size == 7) bankStyle.size = 0

			if (this.remove_topbar) {
				img.drawAlignedText(2, 2, 68, 68, bankStyle.text, bankStyle.color, bankStyle.size, 2, 1, halign, valign)
			} else {
				img.drawAlignedText(2, 18, 68, 52, bankStyle.text, bankStyle.color, bankStyle.size, 2, 1, halign, valign)
			}

			this.#drawTopbar(img, bankStyle, page, bank)
		}

		return img
	}

	/**
	 * Draw the topbar onto an image for a bank
	 * @param {object} img Image to draw to
	 * @param {object} bankStyle The style to draw
	 * @param {number | undefined} page
	 * @param {number | undefined} bank
	 * @access private
	 * @returns Image
	 */
	#drawTopbar(img, bankStyle, page, bank) {
		if (this.remove_topbar) {
			if (bankStyle.pushed) {
				img.drawBorder(3, colorButtonYellow)
			}
		} else {
			let step = ''
			img.horizontalLine(13, colorButtonYellow)

			if (bankStyle.style == 'step' && page !== undefined) {
				step = `.${bankStyle.step_cycle}`
			}

			if (page === undefined) {
				// Preview (no page/bank)
				img.drawTextLine(3, 3, `x.x.${step}`, colorButtonYellow, 0)
			} else if (bankStyle.pushed) {
				img.boxFilled(0, 0, 71, 14, colorButtonYellow)
				img.drawTextLine(3, 3, `${page}.${bank}${step}`, colorBlack, 0)
			} else {
				img.drawTextLine(3, 3, `${page}.${bank}${step}`, colorButtonYellow, 0)
			}
		}

		if (page !== undefined || bank !== undefined) {
			const status = this.bank.action.getBankStatus(page, bank)
			const colors = [0, img.rgb(255, 127, 0), img.rgb(255, 0, 0)]

			if (status > 0) {
				img.boxFilled(62, 2, 70, 10, colors[status])
			}

			if (bankStyle.action_running) {
				img.drawChar(55, 3, 'play', img.rgb(0, 255, 0), 'icon')
			}
		}

		if (bankStyle.cloud && !this.remove_topbar) {
			img.drawPixelBuffer(35, 3, 15, 8, internalIcons.cloud)
		}

		return img
	}

	drawBank(page, bank) {
		let img

		page = parseInt(page)
		bank = parseInt(bank)

		const buttonStyle = this.bank.getBankCompleteStyle(page, bank)

		if (buttonStyle && buttonStyle.style) {
			img = this.#drawBankImage(buttonStyle, page, bank)
			this.system.emit('graphics_bank_redrawn', page, bank, buttonStyle)
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

		if (!this.pincodebuffers) {
			this.pincodebuffers = {}

			for (let i = 0; i < 10; i++) {
				img = new Image(72, 72)
				img.fillColor(img.rgb(15, 15, 15))
				img.drawAlignedText(0, 0, 72, 72, i.toString(), colorWhite, 44, undefined, 44, 'center', 'center')
				this.pincodebuffers[i] = img.bufferAndTime()
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
		this.pincodebuffers.code = img.bufferAndTime()

		return this.pincodebuffers
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

export default GraphicsController

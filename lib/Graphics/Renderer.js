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

export default class GraphicsRenderer {
	/**
	 * Draw the image for an empty bank
	 * @param {number} page
	 * @param {number} bank
	 * @access public
	 * @returns Image render object
	 */
	static drawBlank(page, bank) {
		const img = new Image(72, 72)

		img.drawTextLine(2, 3, `${page}.${bank}`, img.rgb(50, 50, 50), 0)
		img.horizontalLine(13, img.rgb(30, 30, 30))

		return img.bufferAndTime()
	}

	/**
	 * Draw the image for a bank
	 * @param {object} options
	 * @param {object} bankStyle The style to draw
	 * @param {number | undefined} page
	 * @param {number | undefined} bank
	 * @param {string | undefined} pagename
	 * @access public
	 * @returns Image render object
	 */
	static drawBankImage(options, bankStyle, page, bank, pagename) {
		const img = new Image(72, 72)
		let draw_style = undefined

		// special button types
		if (bankStyle.style == 'pageup') {
			draw_style = 'pageup'

			img.fillColor(img.rgb(15, 15, 15))

			if (options.page_plusminus) {
				img.drawChar(30, 20, options.page_direction_flipped ? charCodeMinus : charCodePlus, colorWhite, 0, 1)
			} else {
				img.drawChar(26, 20, 'arrow_up', colorWhite, 'icon')
			}

			img.drawAlignedText(0, 39, 72, 8, 'UP', colorButtonYellow, 0, undefined, 1, 'center', 'center')
		} else if (bankStyle.style == 'pagedown') {
			draw_style = 'pagedown'

			img.fillColor(img.rgb(15, 15, 15))

			if (options.page_plusminus) {
				img.drawChar(30, 40, options.page_direction_flipped ? charCodePlus : charCodeMinus, colorWhite, 0, 1)
			} else {
				img.drawChar(26, 40, 'arrow_down', colorWhite, 'icon')
			}

			img.drawAlignedText(0, 25, 72, 8, 'DOWN', colorButtonYellow, 0, undefined, 1, 'center', 'center')
		} else if (bankStyle.style == 'pagenum') {
			draw_style = 'pagenum'

			img.fillColor(img.rgb(15, 15, 15))

			if (page === undefined) {
				// Preview (no page/bank)
				img.drawAlignedText(0, 0, 72, 30, 'PAGE', colorButtonYellow, 0, undefined, 1, 'center', 'bottom')
				img.drawAlignedText(0, 32, 72, 30, 'x', colorWhite, 18, undefined, 1, 'center', 'top')
			} else if (!pagename || pagename.toLowerCase() == 'page') {
				img.drawAlignedText(0, 0, 72, 30, 'PAGE', colorButtonYellow, 0, undefined, 1, 'center', 'bottom')
				img.drawAlignedText(0, 32, 72, 30, '' + page, colorWhite, 18, undefined, 1, 'center', 'top')
			} else {
				img.drawAlignedText(0, 0, 72, 72, pagename, colorWhite, '18', 2, 0, 'center', 'center')
			}
		} else if (bankStyle.style) {
			draw_style = bankStyle

			// handle upgrade from pre alignment-support configuration
			if (bankStyle.alignment === undefined) {
				bankStyle.alignment = 'center:center'
			}
			if (bankStyle.pngalignment === undefined) {
				bankStyle.pngalignment = 'center:center'
			}

			// Background
			options.remove_topbar
				? img.boxFilled(0, 0, 71, 71, bankStyle.bgcolor)
				: img.boxFilled(0, 14, 71, 71, bankStyle.bgcolor)

			if (bankStyle.png64 !== undefined && bankStyle.png64 !== null) {
				try {
					let data = Buffer.from(bankStyle.png64, 'base64')
					let halign = bankStyle.pngalignment.split(':', 2)[0]
					let valign = bankStyle.pngalignment.split(':', 2)[1]

					options.remove_topbar
						? img.drawFromPNGdata(data, 0, 0, 72, 72, halign, valign)
						: img.drawFromPNGdata(data, 0, 14, 72, 58, halign, valign)
				} catch (e) {
					img.boxFilled(0, 14, 71, 57, 0)
					options.remove_topbar
						? img.drawAlignedText(2, 2, 68, 68, 'PNG ERROR', img.rgb(255, 0, 0), 0, 2, 1, 'center', 'center')
						: img.drawAlignedText(2, 18, 68, 52, 'PNG ERROR', img.rgb(255, 0, 0), 0, 2, 1, 'center', 'center')

					GraphicsRenderer.#drawTopbar(img, options, bankStyle, page, bank)
					return {
						buffer: img.buffer(),
						updated: Date.now(),
						style: draw_style,
					}
				}
			}

			/* raw image buffers */
			if (bankStyle.img64 !== undefined) {
				try {
					options.remove_topbar
						? img.drawPixelBuffer(0, 0, 72, 72, bankStyle.img64, 'base64')
						: img.drawPixelBuffer(0, 14, 72, 58, bankStyle.img64, 'base64')
				} catch (e) {
					img.boxFilled(0, 14, 71, 57, 0)
					options.remove_topbar
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

					GraphicsRenderer.#drawTopbar(img, options, bankStyle, page, bank)
					return {
						buffer: img.buffer(),
						updated: Date.now(),
						style: draw_style,
					}
				}
			}

			let halign = bankStyle.alignment.split(':', 2)[0]
			let valign = bankStyle.alignment.split(':', 2)[1]
			if (bankStyle.size == 'small') bankStyle.size = 0
			if (bankStyle.size == 'large') bankStyle.size = 14
			if (bankStyle.size == 7) bankStyle.size = 0

			if (options.remove_topbar) {
				img.drawAlignedText(2, 2, 68, 68, bankStyle.text, bankStyle.color, bankStyle.size, 2, 1, halign, valign)
			} else {
				img.drawAlignedText(2, 18, 68, 52, bankStyle.text, bankStyle.color, bankStyle.size, 2, 1, halign, valign)
			}

			GraphicsRenderer.#drawTopbar(img, options, bankStyle, page, bank)
		}

		return {
			buffer: img.buffer(),
			updated: Date.now(),
			style: draw_style,
		}
	}

	/**
	 * Draw the topbar onto an image for a bank
	 * @param {object} img Image to draw to
	 * @param {object} options
	 * @param {object} bankStyle The style to draw
	 * @param {number | undefined} page
	 * @param {number | undefined} bank
	 * @access private
	 * @returns Image
	 */
	static #drawTopbar(img, options, bankStyle, page, bank) {
		if (options.remove_topbar) {
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
			const status = bankStyle.bank_status
			const colors = [0, img.rgb(255, 127, 0), img.rgb(255, 0, 0)]

			if (status > 0) {
				img.boxFilled(62, 2, 70, 10, colors[status])
			}

			if (bankStyle.action_running) {
				img.drawChar(55, 3, 'play', img.rgb(0, 255, 0), 'icon')
			}
		}

		if (bankStyle.cloud && !options.remove_topbar) {
			img.drawPixelBuffer(35, 3, 15, 8, internalIcons.cloud)
		}

		return img
	}

	/**
	 * Draw pincode entry button for given number
	 * @param {number} num Display number
	 * @returns
	 */
	static drawPincodeNumber(num) {
		const img = new Image(72, 72)
		img.fillColor(img.rgb(15, 15, 15))
		img.drawAlignedText(0, 0, 72, 72, `${num}`, colorWhite, 44, undefined, 44, 'center', 'center')
		return img.bufferAndTime()
	}

	static drawPincodeEntry(code) {
		const img = new Image(72, 72)
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

		return img.bufferAndTime()
	}
}

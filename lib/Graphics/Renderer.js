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
import { ParseAlignment, parseColor } from '../Resources/Util.js'
import { formatLocation } from '../Shared/ControlId.js'
import { ImageResult } from './ImageResult.js'
//import {performance} from 'perf_hooks'

const colorButtonYellow = 'rgb(255, 198, 0)'
const colorWhite = 'white'
const colorBlack = 'black'
const colorDarkGrey = 'rgba(15, 15, 15, 1)'

const internalIcons = {
	// 15x8 argb
	cloud:
		'AAAAAAAAAAAAAAAAAAAAAAAAAAAD////D////4L////7//////////D+/v51+/v7A////wAAAAAAAAAAAAAAAAAAA' +
		'AAAAAAAAAAAAAAAAABN////kf///////////v7+//z8/P/5+fn/9vb2RfDw8AAAAAAAAAAAAAAAAAAAAAB7///////////////0/////' +
		'P7+/v/9/f3/+vr6//b29v/y8vL/7e3tf+np6QAAAAAAAAAAAv///xz///+k/////////////////f39//r6+v/39/f/8/Pz/+7u7v/p6' +
		'en/5OTkquDg4DDV1dUC////N////6v////s/v7+//39/f/7+/v/+Pj4//T09P/v7+//6urq/+Xl5f/g4OD/3Nzc8dfX18DS0tJKz8/Pt' +
		'P/////+/v7/+/v7//n5+f/09PT/8PDw/+vr6//m5ub/4eHh/9zc3P/Y2Nj/1NTU/9HR0f/Ozs7HzMzM2Pv7+//5+fn/9fX1//Hx8f/s7' +
		'Oz/5+fn/+Li4v/d3d3/2dnZ/9TU1P/R0dH/z8/P/83Nzf/MzMzGy8vLVvb29u7y8vL/7e3t/+jo6P/j4+P/3t7e/9nZ2f/V1dX/0dHR/' +
		'87Ozv/Nzc3/zMzM/8zMzOHMzMwwysrK',
}

// let lastDraw = 0

export default class GraphicsRenderer {
	/**
	 * Draw the image for an empty bank
	 * @param {import('./Controller.js').GraphicsOptions} options
	 * @param {import('../Resources/Util.js').ControlLocation} location
	 * @access public
	 * @returns Image render object
	 */
	static drawBlank(options, location) {
		// let now = performance.now()
		// console.log('starting drawBlank ' + now, 'time elapsed since last start ' + (now - lastDraw))
		// lastDraw = now
		// console.time('drawBlankImage')
		const img = new Image(72, 72, 1)

		img.fillColor('black')

		if (!options.remove_topbar) {
			img.drawTextLine(2, 3, formatLocation(location), 'rgb(50, 50, 50)', 8)
			img.horizontalLine(13.5, 'rgb(30, 30, 30)')
		}
		// console.timeEnd('drawBlankImage')
		return new ImageResult(img.buffer(), undefined)
	}

	/**
	 * Draw the image for a bank
	 * @param {import('./Controller.js').GraphicsOptions} options
	 * @param {import('../Data/Model/StyleModel.js').DrawStyleModel} bankStyle The style to draw
	 * @param {import('../Resources/Util.js').ControlLocation | undefined} location
	 * @param {string | undefined} pagename
	 * @access public
	 * @returns {Promise<ImageResult>} Image render object
	 */
	static async drawBankImage(options, bankStyle, location, pagename) {
		const { buffer, draw_style } = await GraphicsRenderer.drawBankImageUnwrapped(options, bankStyle, location, pagename)

		return GraphicsRenderer.wrapDrawBankImage(buffer, draw_style, bankStyle)
	}

	/**
	 *
	 * @param {Buffer} buffer
	 * @param {import('../Data/Model/StyleModel.js').DrawStyleModel['style'] | undefined} draw_style
	 * @param {import('../Data/Model/StyleModel.js').DrawStyleModel} bankStyle
	 * @returns
	 */
	static wrapDrawBankImage(buffer, draw_style, bankStyle) {
		const draw_style2 = draw_style === 'button' ? (bankStyle.style === 'button' ? bankStyle : undefined) : draw_style

		return new ImageResult(buffer, draw_style2)
	}

	/**
	 * Draw the image for a bank
	 * @param {import('./Controller.js').GraphicsOptions} options
	 * @param {import('../Data/Model/StyleModel.js').DrawStyleModel} bankStyle The style to draw
	 * @param {import('../Resources/Util.js').ControlLocation | undefined} location
	 * @param {string | undefined} pagename
	 * @access public
	 * @returns {Promise<{ buffer: Buffer, draw_style: import('../Data/Model/StyleModel.js').DrawStyleModel['style'] | undefined}>} Image render object
	 */
	static async drawBankImageUnwrapped(options, bankStyle, location, pagename) {
		// console.log('starting drawBankImage '+ performance.now())
		// console.time('drawBankImage')
		const img = new Image(72, 72, 4)

		/** @type {import('../Data/Model/StyleModel.js').DrawStyleModel['style'] | undefined} */
		let draw_style = undefined

		// special button types
		if (bankStyle.style == 'pageup') {
			draw_style = 'pageup'

			img.fillColor(colorDarkGrey)

			if (options.page_plusminus) {
				img.drawTextLine(31, 20, options.page_direction_flipped ? '–' : '+', colorWhite, 18)
			} else {
				img.drawPath(
					[
						[46, 30],
						[36, 20],
						[26, 30],
					],
					colorWhite,
					2
				) // Arrow up path
			}

			img.drawTextLineAligned(36, 39, 'UP', colorButtonYellow, 10, 'center', 'top')
		} else if (bankStyle.style == 'pagedown') {
			draw_style = 'pagedown'

			img.fillColor(colorDarkGrey)

			if (options.page_plusminus) {
				img.drawTextLine(31, 36, options.page_direction_flipped ? '+' : '–', colorWhite, 18)
			} else {
				img.drawPath(
					[
						[46, 40],
						[36, 50],
						[26, 40],
					],
					colorWhite,
					2
				) // Arrow down path
			}

			img.drawTextLineAligned(36, 23, 'DOWN', colorButtonYellow, 10, 'center', 'top')
		} else if (bankStyle.style == 'pagenum') {
			draw_style = 'pagenum'

			img.fillColor(colorDarkGrey)

			if (location === undefined) {
				// Preview (no page/bank)
				img.drawTextLineAligned(36, 18, 'PAGE', colorButtonYellow, 10, 'center', 'top')
				img.drawTextLineAligned(36, 32, 'x', colorWhite, 18, 'center', 'top')
			} else if (!pagename || pagename.toLowerCase() == 'page') {
				img.drawTextLine(23, 18, 'PAGE', colorButtonYellow, 10)
				img.drawTextLineAligned(36, 32, '' + location.pageNumber, colorWhite, 18, 'center', 'top')
			} else {
				img.drawAlignedText(0, 0, 72, 72, pagename, colorWhite, 18, 'center', 'center')
			}
		} else if (bankStyle.style === 'button') {
			draw_style = 'button'

			await GraphicsRenderer.#drawButtonMain(img, options, bankStyle, location)
		}

		// console.timeEnd('drawBankImage')
		return {
			buffer: img.buffer(),
			draw_style,
		}
	}

	/**
	 * Draw the main button
	 * @param {Image} img Image to draw to
	 * @param {import('./Controller.js').GraphicsOptions} options
	 * @param {import('../Data/Model/StyleModel.js').DrawStyleButtonModel} bankStyle The style to draw
	 * @param {import('../Resources/Util.js').ControlLocation | undefined} location
	 * @access private
	 */
	static async #drawButtonMain(img, options, bankStyle, location) {
		let show_topbar = !!bankStyle.show_topbar
		if (bankStyle.show_topbar === 'default' || bankStyle.show_topbar === undefined) {
			show_topbar = !options.remove_topbar
		}

		// handle upgrade from pre alignment-support configuration
		if (bankStyle.alignment === undefined) {
			bankStyle.alignment = 'center:center'
		}
		if (bankStyle.pngalignment === undefined) {
			bankStyle.pngalignment = 'center:center'
		}

		// Draw background color first
		!show_topbar
			? img.box(0, 0, 72, 72, parseColor(bankStyle.bgcolor))
			: img.box(0, 14, 72, 72, parseColor(bankStyle.bgcolor))

		// Draw background PNG if exists
		if (bankStyle.png64 !== undefined && bankStyle.png64 !== null) {
			try {
				let png64 = bankStyle.png64.startsWith('data:image/png;base64,') ? bankStyle.png64.slice(22) : bankStyle.png64
				let data = Buffer.from(png64, 'base64')
				const [halign, valign] = ParseAlignment(bankStyle.pngalignment)

				!show_topbar
					? await img.drawFromPNGdata(data, 0, 0, 72, 72, halign, valign)
					: await img.drawFromPNGdata(data, 0, 14, 72, 58, halign, valign)
			} catch (e) {
				console.error('error drawing image:', e)
				img.box(0, 14, 71, 57, 'black')
				!show_topbar
					? img.drawAlignedText(2, 2, 68, 68, 'PNG ERROR', 'red', 10, 'center', 'center')
					: img.drawAlignedText(2, 18, 68, 52, 'PNG ERROR', 'red', 10, 'center', 'center')

				GraphicsRenderer.#drawTopbar(img, show_topbar, bankStyle, location)
				return
			}
		}

		// Draw images from feedbacks
		try {
			for (const image of bankStyle.imageBuffers || []) {
				if (image.buffer) {
					const yOffset = show_topbar ? 14 : 0

					const x = image.x ?? 0
					const y = yOffset + (image.y ?? 0)
					const width = image.width || 72
					const height = image.height || 72 - yOffset

					img.drawPixelBuffer(x, y, width, height, image.buffer)
				}
			}
		} catch (e) {
			img.fillColor('black')
			!show_topbar
				? img.drawAlignedText(2, 2, 68, 68, 'IMAGE\\nDRAW\\nERROR', 'red', 10, 'center', 'center')
				: img.drawAlignedText(2, 18, 68, 52, 'IMAGE\\nDRAW\\nERROR', 'red', 10, 'center', 'center')

			GraphicsRenderer.#drawTopbar(img, show_topbar, bankStyle, location)
			return
		}

		// Draw button text
		const [halign, valign] = ParseAlignment(bankStyle.alignment)

		/** @type {'auto' | number} */
		let fontSize = 'auto'
		if (bankStyle.size == 'small') {
			fontSize = 7 // compatibility with v1 database
		} else if (bankStyle.size == 'large') {
			fontSize = 14 // compatibility with v1 database
		} else {
			fontSize = Number(bankStyle.size) || 'auto'
		}

		if (!show_topbar) {
			img.drawAlignedText(2, 1, 68, 70, bankStyle.text, parseColor(bankStyle.color), fontSize, halign, valign)
		} else {
			img.drawAlignedText(2, 15, 68, 57, bankStyle.text, parseColor(bankStyle.color), fontSize, halign, valign)
		}

		// At last draw Topbar on top
		GraphicsRenderer.#drawTopbar(img, show_topbar, bankStyle, location)
	}

	/**
	 * Draw the topbar onto an image for a bank
	 * @param {Image} img Image to draw to
	 * @param {boolean} show_topbar
	 * @param {import('../Data/Model/StyleModel.js').DrawStyleButtonModel} bankStyle The style to draw
	 * @param {import('../Resources/Util.js').ControlLocation | undefined} location
	 * @access private
	 */
	static #drawTopbar(img, show_topbar, bankStyle, location) {
		if (!show_topbar) {
			if (bankStyle.pushed) {
				img.drawBorder(3, colorButtonYellow)
			}
		} else {
			let step = ''
			img.box(0, 0, 72, 13.5, colorBlack)
			img.horizontalLine(13.5, colorButtonYellow)

			if (typeof bankStyle.step_cycle === 'number' && location) {
				step = `.${bankStyle.step_cycle}`
			}

			if (location === undefined) {
				// Preview (no page/bank)
				img.drawTextLine(4, 2, `x.x${step}`, colorButtonYellow, 9)
			} else if (bankStyle.pushed) {
				img.box(0, 0, 72, 14, colorButtonYellow)
				img.drawTextLine(4, 2, `${formatLocation(location)}${step}`, colorBlack, 9)
			} else {
				img.drawTextLine(4, 2, `${formatLocation(location)}${step}`, colorButtonYellow, 9)
			}
		}

		// Draw status icons from right to left
		let rightMax = 72

		// first the cloud icon if present
		if (bankStyle.cloud && show_topbar) {
			img.drawPixelBuffer(rightMax - 17, 3, 15, 8, internalIcons.cloud)
			rightMax -= 17
		}

		// next error or warning icon
		if (location) {
			switch (bankStyle.bank_status) {
				case 'error':
					img.box(rightMax - 10, 3, rightMax - 2, 11, 'red')
					rightMax -= 10
					break
				case 'warning':
					img.drawFilledPath(
						[
							[rightMax - 10, 11],
							[rightMax - 2, 11],
							[rightMax - 6, 3],
						],
						'rgb(255, 127, 0)'
					)
					img.drawTextLineAligned(rightMax - 6, 11, '!', colorBlack, 7, 'center', 'bottom')
					rightMax -= 10
					break
			}

			// last running icon
			if (bankStyle.action_running) {
				//img.drawTextLine(55, 3, '►', 'rgb(0, 255, 0)', 8) // not as nice
				let iconcolor = 'rgb(0, 255, 0)'
				if (bankStyle.pushed) iconcolor = colorBlack
				img.drawFilledPath(
					[
						[rightMax - 8, 3],
						[rightMax - 2, 7],
						[rightMax - 8, 11],
					],
					iconcolor
				)
				rightMax -= 8
			}
		}
	}

	/**
	 * Draw pincode entry button for given number
	 * @param {number} num Display number
	 * @returns {ImageResult}
	 */
	static drawPincodeNumber(num) {
		const img = new Image(72, 72, 3)
		img.fillColor(colorDarkGrey)
		img.drawTextLineAligned(36, 36, `${num}`, colorWhite, 44, 'center', 'center')
		return new ImageResult(img.buffer(), undefined)
	}

	/**
	 * Draw pincode entry button
	 * @param {string | undefined} code
	 * @returns {ImageResult}
	 */
	static drawPincodeEntry(code) {
		const img = new Image(72, 72, 4)
		img.fillColor(colorDarkGrey)
		img.drawTextLineAligned(36, 30, 'Lockout', colorButtonYellow, 14, 'center', 'center')
		if (code !== undefined) {
			img.drawAlignedText(0, 15, 72, 72, code.replace(/[a-z0-9]/gi, '*'), colorWhite, 18, 'center', 'center')
		}

		return new ImageResult(img.buffer(), undefined)
	}
}

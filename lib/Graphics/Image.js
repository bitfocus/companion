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

// Super primitive drawing library!

import font from '../Resources/Font.js'
import { PNG } from 'pngjs'
import { argb, rgb, rgbRev } from '../Resources/Util.js'
import debug0 from 'debug'

class Image {
	debug = debug0('lib/Graphics/Image')

	static argb = argb
	static rgb = rgb
	static rgbRev = rgbRev

	constructor(width, height) {
		/* Defaults for custom images from modules */
		if (width === undefined) {
			width = 72
		}
		if (height === undefined) {
			height = 58
		}

		this.argb = argb.bind(this)
		this.rgb = rgb.bind(this)
		this.rgbRev = rgbRev.bind(this)

		this.lastUpdate = Date.now()
		this.width = width
		this.height = height
		this.canvas = []

		for (let y = 0; y < this.height; y++) {
			let buf = Buffer.alloc(this.width * 3) // * 3 for RGB.
			this.canvas.push(buf)
		}
	}

	fillColor(color) {
		for (let y = 0; y < this.height; y++) {
			for (let x = 0; x < this.width; x++) {
				this.pixel(x, y, color)
			}
		}

		return true
	}

	/** @deprecated use fillColor instead */
	backgroundColor(backgroundColor) {
		return this.fillColor(backgroundColor)
	}

	pixel(x, y, color) {
		if (x >= this.width) return
		if (y >= this.height) return

		let line = this.canvas[y]
		if (color <= 0xffffff) {
			line.writeUIntBE(color & 0xffffff, x * 3, 3)
		} else {
			let alpha = Math.floor(color / 0x1000000) / 0xff
			let oldr = line.readUInt8(x * 3)
			let oldg = line.readUInt8(x * 3 + 1)
			let oldb = line.readUInt8(x * 3 + 2)
			let newr = (color >> 16) & 0xff
			let newg = (color >> 8) & 0xff
			let newb = color & 0xff
			line.writeUIntBE(
				rgb(oldr * (1 - alpha) + newr * alpha, oldg * (1 - alpha) + newg * alpha, oldb * (1 - alpha) + newb * alpha),
				x * 3,
				3
			)
		}

		this.lastUpdate = Date.now()

		return true
	}

	horizontalLine(y, color) {
		for (let x = 0; x < this.width; x++) {
			this.pixel(x, y, color)
		}

		return true
	}

	verticalLine(x, color) {
		for (let y = 0; y < this.height; y++) {
			this.pixel(x, y, color)
		}

		return true
	}

	boxFilled(x1, y1, x2, y2, color) {
		for (let y = y1; y <= y2; y++) {
			for (let x = x1; x <= x2; x++) {
				this.pixel(x, y, color)
			}
		}

		return true
	}

	boxLine(x1, y1, x2, y2, color) {
		for (let y = y1; y <= y2; y++) {
			// draw horizontal lines
			if (y == y1 || y == y2) {
				for (let x = x1; x <= x2; x++) {
					this.pixel(x, y, color)
				}
			}

			// draw vertical lines
			if (y > y1 || y < y2) {
				this.pixel(x1, y, color)
				this.pixel(x2, y, color)
			}
		}

		return true
	}

	drawFromPNGdata(data, xStart = 0, yStart = 0, width = 72, height = 58, halign = 'center', valign = 'center') {
		let png
		let xouter, xinner, youter, yinner, wouter, houter

		if (xStart + width > this.width) {
			width = this.width - xStart
		}
		if (yStart + height > this.height) {
			height = this.height - yStart
		}

		png = PNG.sync.read(data)

		if (png.width > width) {
			//image is broader than drawing pane
			switch (halign) {
				case 'left':
					xouter = 0
					xinner = 0
					wouter = width
					break
				case 'center':
					xouter = 0
					xinner = Math.round((png.width - width) / 2, 0)
					wouter = width
					break
				case 'right':
					xouter = 0
					xinner = png.width - width
					wouter = width
					break
			}
		} else {
			// image is narrower than drawing pane
			switch (halign) {
				case 'left':
					xouter = 0
					xinner = 0
					wouter = png.width
					break
				case 'center':
					xouter = Math.round((width - png.width) / 2, 0)
					xinner = 0
					wouter = png.width
					break
				case 'right':
					xouter = width - png.width
					xinner = 0
					wouter = png.width
					break
			}
		}

		if (png.height > height) {
			// image is taller than drawing pane
			switch (valign) {
				case 'top':
					youter = 0
					yinner = 0
					houter = height
					break
				case 'center':
					youter = 0
					yinner = Math.round((png.height - height) / 2, 0)
					houter = height
					break
				case 'bottom':
					youter = 0
					yinner = png.height - height
					houter = height
					break
			}
		} else {
			// image is smaller than drawing pane
			switch (valign) {
				case 'top':
					youter = 0
					yinner = 0
					houter = png.height
					break
				case 'center':
					youter = Math.round((height - png.height) / 2, 0)
					yinner = 0
					houter = png.height
					break
				case 'bottom':
					youter = height - png.height
					yinner = 0
					houter = png.height
					break
			}
		}

		for (let y = 0; y < houter; y++) {
			for (let x = 0; x < wouter; x++) {
				let idx = (png.width * (y + yinner) + x + xinner) << 2
				let r = png.data[idx]
				let g = png.data[idx + 1]
				let b = png.data[idx + 2]
				let a = png.data[idx + 3]

				if (png.data[idx + 3] > 0) {
					if (png.data[idx + 3] === 256) {
						this.pixel(xStart + xouter + x, yStart + youter + y, rgb(r, g, b))
					} else {
						this.pixel(xStart + xouter + x, yStart + youter + y, argb(a, r, g, b))
					}
				}
			}
		}
	}

	drawTextLine(x, y, text, color, fontindex, spacing, double, dummy) {
		if (text === undefined || text.length == 0) return 0

		if (spacing === undefined) {
			spacing = 2
		}
		if (double === undefined) {
			double = false
		}

		let chars = text.split('')
		let max_x = 0
		let x_pos = 0
		let y_pos = y

		for (let i = 0; i < chars.length; i++) {
			let charcode = chars[i].charCodeAt(0)
			if (charcode >= 0xd800 && charcode <= 0xdbff && chars.length - 1 > i) {
				// check if this is the start of a surrogate pair
				let lead = charcode
				let tail = chars[i + 1].charCodeAt(0)
				if (tail >= 0xdc00 && tail <= 0xdfff) {
					// low surrogate
					charcode = (lead - 0xd800) * 0x400 + tail - 0xdc00 + 0x10000
					i++
				}
			}

			let width = this.drawChar(x + x_pos, y_pos, charcode, color, fontindex, double, dummy)
			x_pos += width ? width : 0
			if (i < chars.length - 1) {
				x_pos += width ? (double ? spacing * 2 : spacing) : 0
			}

			if (x_pos > max_x) max_x = x_pos
		}

		return max_x
	}

	/*
	Draws aligned text in an boxed area.
	int x: bounding box top left horizontal value
	int y: bounding box top left vertical value
	int w: bounding box width
	int h: bounding box height
	string text: the text to drawBank
	rgb-array color: color of the text
	string fontindex: index of font, either 'icon' or something else
	int spacing: how much space should be between letters, leave undefined for spacing of font
	int size: font size multiplier
	string halign: horizontal alignment left, center, right
	string valign: vertical alignment top, center, bottom
	bool dummy: don't actually draw anything if true, just return if the text fits

	returns true if text fits
*/
	drawAlignedText(
		x = 0,
		y = 0,
		w = 72,
		h = 72,
		text,
		color,
		fontindex = '',
		spacing,
		size = 1,
		halign = 'center',
		valign = 'center',
		dummy = false
	) {
		let textFits = true
		let double
		let lineheight
		let linespacing
		let charspacing

		if (size === 2) {
			double = true
		} else {
			double = false
		}

		// validate the fontindex
		fontindex = parseInt(fontindex)
		if (!font[fontindex] || isNaN(fontindex)) {
			fontindex = 'auto'
		}

		if (fontindex === 'auto') {
			fontindex = 0
			for (let checksize of [44, 30, 24, 18, 14]) {
				if (this.drawAlignedText(x, y, w, h, text, color, checksize, spacing, size, halign, valign, true) === true) {
					fontindex = checksize
					break
				}
			}
		}

		if (text == undefined || text == '') {
			return true
		}

		lineheight = font[fontindex].lineheight
		linespacing = font[fontindex].linespacing

		if (spacing !== undefined) {
			charspacing = spacing
		} else {
			charspacing = font[fontindex].charspacing
		}

		let displayText = (text || '').trim() // remove leading and trailing spaces for display

		let xSize = this.drawTextLine(0, 0, displayText, color, fontindex, charspacing, double, true)

		// breakup text in pieces
		let breakPos = [0]
		let lastBreakPos = 0
		for (let i = 0; i < displayText.length; i++) {
			if (
				displayText.charCodeAt(i) === 32 || // space
				displayText.charCodeAt(i) === 45 || // -
				displayText.charCodeAt(i) === 95 || // _
				displayText.charCodeAt(i) === 58 || // :
				displayText.charCodeAt(i) === 126 // ~
			) {
				lastBreakPos = i // remember the latest position where break is possible
			}

			// Support \n as line breaker
			if (displayText.substr(i, 2) === '\\n') {
				lastBreakPos = i
				displayText = displayText.slice(0, lastBreakPos) + displayText.slice(lastBreakPos + 2)
				i--
				breakPos.push(lastBreakPos)
				lastBreakPos = 0
			}

			if (
				this.drawTextLine(
					0,
					0,
					displayText.slice(breakPos[breakPos.length - 1], i + 1),
					color,
					fontindex,
					charspacing,
					double,
					true
				) > w
			) {
				if (lastBreakPos > 0) {
					// if line is getting too long and there was a good wrap position, wrap it at that position
					if (displayText.charCodeAt(lastBreakPos) === 32) {
						// space
						// if the break position was a space we want to get rid of it
						displayText = displayText.slice(0, lastBreakPos) + displayText.slice(lastBreakPos + 1)
						i--
					} else {
						if (i - lastBreakPos > 0) lastBreakPos += 1 // if we can afford we want to have the breaking character in the top line, otherwise it gets wrapped (ugly, but better for space usage)
					}
					breakPos.push(lastBreakPos)
					lastBreakPos = 0
				} else {
					breakPos.push(i) // if there has been no good break position, just wrap it anyway
					lastBreakPos = 0
				}
			}
		}

		breakPos.push(displayText.length)

		let lines = breakPos.length - 1
		if (lines * lineheight * (double ? 2 : 1) + (lines - 1) * linespacing * (double ? 2 : 1) > h) {
			lines = parseInt((h + linespacing * (double ? 2 : 1)) / ((lineheight + linespacing) * (double ? 2 : 1)))
			textFits = false
		}
		if (lines === 0) return true

		if (dummy !== true) {
			for (let line = 1; line <= lines; line++) {
				xSize = this.drawTextLine(
					0,
					0,
					displayText.slice(breakPos[line - 1], breakPos[line]),
					color,
					fontindex,
					charspacing,
					double,
					true
				)
				let xStart, yStart

				switch (halign) {
					case 'left':
						xStart = x
						break
					case 'center':
						xStart = x + parseInt((w - xSize) / 2)
						break
					case 'right':
						xStart = x + w - xSize
						break
				}

				switch (valign) {
					case 'top':
						yStart = y + (line - 1) * (lineheight + linespacing) * (double ? 2 : 1)
						break
					case 'center':
						yStart =
							y +
							parseInt(
								(h - (lines * lineheight * (double ? 2 : 1) + (lines - 1) * linespacing * (double ? 2 : 1))) / 2
							) +
							(line - 1) * (lineheight + linespacing) * (double ? 2 : 1)
						break
					case 'bottom':
						yStart = y + h - (lines - line + 1) * (lineheight + linespacing) * (double ? 2 : 1)
						break
				}

				let linetext = displayText.slice(breakPos[line - 1], breakPos[line])
				this.drawTextLine(xStart, yStart, linetext, color, fontindex, charspacing, double)
			}
		}
		return textFits
	}

	/**
	 * drawPixeBuffer(x, y, width, height, buffer[, type])
	 *
	 * Buffer can be either a buffer, or base64 encoded string.
	 * Type can be set to either 'buffer' or 'base64' according to your input data.
	 * Width and height is information about your buffer, not scaling.
	 *
	 * The buffer data is expected to be RGB or ARGB data, 1 byte per color,
	 * horizontally. Top left is first three bytes.
	 */
	drawPixelBuffer(x, y, width, height, buffer, type) {
		if (type === undefined && typeof buffer == 'object' && buffer instanceof Buffer) {
			type = 'buffer'
		} else if (type === undefined && typeof buffer == 'string') {
			type = 'base64'
		}

		if (type === 'base64') {
			buffer = Buffer.from(buffer, 'base64')
		}

		if (buffer.length < width * height * 3) {
			throw new Error(
				'Pixelbuffer of ' + buffer.length + ' bytes is less than expected ' + width * height * 3 + ' bytes'
			)
		}

		if (buffer.length == width * height * 4) {
			// ARGB
			let counter = 0
			for (let y2 = 0; y2 < height; ++y2) {
				for (let x2 = 0; x2 < width; ++x2) {
					let color = buffer.readUInt32BE(counter)
					this.pixel(x + x2, y + y2, color)
					counter += 4
				}
			}
		} else if (buffer.length == width * height * 3) {
			// RGB
			let counter = 0
			for (let y2 = 0; y2 < height; ++y2) {
				for (let x2 = 0; x2 < width; ++x2) {
					let color = buffer.readUIntBE(counter, 3)
					this.pixel(x + x2, y + y2, color)
					counter += 3
				}
			}
		} else {
			throw new Error(
				'Pixelbuffer for a ' +
					width +
					'x' +
					height +
					' image should be either ' +
					width * height * 3 +
					' or ' +
					width * height * 4 +
					' bytes big. Not ' +
					buffer.length
			)
		}
	}

	drawChar(x, y, char, color, fontindex, double, dummy) {
		if (double === undefined) double = false
		if (char === undefined) return 0

		// dummy is for not drawing any actual pixels. just calculate the font size
		if (dummy === undefined) dummy = false

		if (char == 32 || char == 160) return 2 // return blanks for space
		if (font[fontindex] === undefined) return 0

		if (char >= 0xd800 && char <= 0xdbff) {
			// most likely a lead surrogate of an UTF16 pair
			return 0
		}

		if (font[fontindex][char] === undefined) {
			this.debug('trying to draw a character that doesnt exist in the font:', char, String.fromCharCode(parseInt(char)))
			return 0
		}

		let gfx = font[fontindex][char]
		let maxX = 0

		for (let pixel in gfx) {
			if (double == true) {
				if ((gfx[pixel][0] + 1) * 2 > maxX) maxX = (gfx[pixel][0] + 1) * 2
				if (dummy == false) {
					for (let len = 0; len < gfx[pixel][2]; len++) {
						this.pixel(x + gfx[pixel][0] * 2, y + (gfx[pixel][1] * 2 + len * 2), color)
						this.pixel(x + gfx[pixel][0] * 2 + 1, y + (gfx[pixel][1] * 2 + len * 2), color)
						this.pixel(x + gfx[pixel][0] * 2, y + gfx[pixel][1] * 2 + len * 2 + 1, color)
						this.pixel(x + gfx[pixel][0] * 2 + 1, y + gfx[pixel][1] * 2 + len * 2 + 1, color)
					}
				}
			} else {
				if (gfx[pixel][0] + 1 > maxX) maxX = gfx[pixel][0] + 1
				if (dummy == false) {
					for (let len = 0; len < gfx[pixel][2]; len++) {
						this.pixel(x + gfx[pixel][0], y + gfx[pixel][1] + len, color)
					}
				}
			}
		}

		return maxX
	}

	drawBorder(depth = 0, color) {
		if (depth > 0) {
			if (depth * 2 < this.width) {
				for (let x = 0; x < depth; x++) {
					this.verticalLine(x, color)
				}

				for (let x = this.width - depth; x < this.width; x++) {
					this.verticalLine(x, color)
				}
			} else {
				for (let x = 0; x < this.width; x++) {
					this.verticalLine(x, color)
				}
			}

			if (depth * 2 < this.height) {
				for (let y = 0; y < depth; y++) {
					this.horizontalLine(y, color)
				}

				for (let y = this.height - depth; y < this.height; y++) {
					this.horizontalLine(y, color)
				}
			} else {
				for (let y = 0; y < this.height; y++) {
					this.horizontalLine(y, color)
				}
			}

			this.pixel(depth + 1, depth + 1, color)
			this.pixel(this.width - depth - 1, depth + 1, color)
			this.pixel(depth + 1, this.height - depth - 1, color)
			this.pixel(this.width - depth - 1, this.height - depth - 1, color)

			return true
		} else {
			return false
		}
	}

	drawCornerTriangle(depth = 0, color, halign = 'left', valign = 'top') {
		if (depth > 0 && (halign == 'left' || halign == 'right') && (valign == 'top' || valign == 'bottom')) {
			let maxY = depth > this.height ? this.height : depth

			for (let y = 0; y < maxY; y++) {
				let trueY = valign == 'bottom' ? this.height - 1 - y : y

				for (let x = 0; x < depth - y && x < this.width; x++) {
					let trueX = halign == 'right' ? this.width - 1 - x : x

					this.pixel(trueX, trueY, color)
				}
			}

			return true
		} else {
			return false
		}
	}

	toBase64() {
		return this.buffer().toString('base64')
	}

	buffer() {
		return Buffer.concat(this.canvas)
	}

	bufferAndTime() {
		return { updated: this.lastUpdate, buffer: this.buffer() }
	}

	static emptyAndTime() {
		return { updated: Date.now(), buffer: Buffer.alloc(72 * 72 * 3) }
	}
}

export default Image

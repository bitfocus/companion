const fs = require('fs')
const PNG = require('pngjs').PNG
const font = require('../Resources/Font')

/**
 * A primitive image draw class
 *
 * @author Dorian Meid <dnmeid@gmx.net>
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @since 1.0.4
 * @copyright 2021 Bitfocus AS
 * @license
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for Companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 */
class Image {
	/**
	 * The debugger for this class
	 * @type {debug.Debugger}
	 * @access protected
	 */
	debug = require('debug')('Image')

	/**
	 * @param {number} width - the image canvas's width
	 * @param {number} height - the image canvas's height
	 */
	constructor(width = 72, height = 58) {
		this.lastUpdate = Date.now()
		this.width = width
		this.height = height
		this.canvas = []
		this.lastBackgroundColor = Image.rgb(0, 0, 0)

		for (var y = 0; y < this.height; y++) {
			var buf = Buffer.alloc(this.width * 3) // * 3 for RGB.
			this.canvas.push(buf)
		}
	}

	/**
	 * 
	 * @param {*} r - the red value
	 * @param {*} g - the green value
	 * @param {*} b - the blue vlaue
	 * @returns {number|boolean} 24-bit integer value or <code>false</code> if an input was invalid
	 * @static
	 */
	static rgb(r, g, b) {
		r = parseInt(r, 16)
		g = parseInt(g, 16)
		b = parseInt(b, 16)

		if (isNaN(r) || isNaN(g) || isNaN(b)) {
			return false
		} else {
			return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff)
		}
	}

	/**
	 * An RGB value
	 * @typedef {Image~RGB}
	 * @property {number} r - red value
	 * @property {number} g - green value
	 * @property {number} b - blue value
	 */
	/**
	 * 
	 * @param {number} dec - 24-bit RGB value
	 * @returns {Image~RGB}
	 * @static
	 */
	static rgbRev(dec) {
		dec = Math.round(dec)

		return {
			r: (dec & 0xff0000) >> 16,
			g: (dec & 0x00ff00) >> 8,
			b: dec & 0x0000ff,
		}
	}

	/**
	 * 
	 * @param {*} a 
	 * @param {*} r 
	 * @param {*} g 
	 * @param {*} b 
	 * @returns {number|boolean} 
	 * @static
	 */
	static argb(a, r, g, b) {
		a = parseInt(a, 16)
		r = parseInt(r, 16)
		g = parseInt(g, 16)
		b = parseInt(b, 16)

		if (isNaN(a) || isNaN(r) || isNaN(g) || isNaN(b)) {
			return false
		} else {
			// bitwise doesn't work because JS bitwise is working with 32bit signed int
			return a * 0x1000000 + Image.rgb(r, g, b)
		}
	}

	backgroundColor(backgroundColor) {
		this.lastBackgroundColor = backgroundColor

		for (var y = 0; y < this.height; y++) {
			for (var x = 0; x < this.width; x++) {
				this.pixel(x, y, backgroundColor)
			}
		}

		return true
	}

	boxFilled(x1, y1, x2, y2, color) {
		for (var y = y1; y <= y2; y++) {
			for (var x = x1; x <= x2; x++) {
				this.pixel(x, y, color)
			}
		}

		return true
	}

	boxLine(x1, y1, x2, y2, color) {
		for (var y = y1; y <= y2; y++) {
			var line = this.canvas[y]

			// draw horizontal lines
			if (y == y1 || y == y2) {
				for (var x = x1; x <= x2; x++) {
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

	buffer() {
		return Buffer.concat(this.canvas)
	}

	bufferAndTime() {
		return { updated: this.lastUpdate, buffer: this.buffer() }
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
		bool check: don't actually draw anything if true, just return if the text fits

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
		check = false
	) {
		var textFits = true
		var double
		var lineheight
		var linespacing
		var charspacing

		if (size === 2) {
			double = true
		} else {
			double = false
		}

		if (!font[fontindex]) {
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

		lineheight = font[fontindex].lineheight
		linespacing = font[fontindex].linespacing

		if (spacing !== undefined) {
			charspacing = spacing
		} else {
			charspacing = font[fontindex].charspacing
		}

		var displayText = text.trim() // remove leading and trailing spaces for display

		var xSize = this.drawTextLine(0, 0, displayText, color, fontindex, charspacing, double, true)

		// breakup text in pieces
		var breakPos = [0]
		var lastBreakPos = 0
		var lineWidth = 0

		for (var i = 0; i < displayText.length; i++) {
			if (
				displayText.charCodeAt(i) === 32 ||
				displayText.charCodeAt(i) === 45 ||
				displayText.charCodeAt(i) === 95 ||
				displayText.charCodeAt(i) === 58 ||
				displayText.charCodeAt(i) === 126
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
						// if the break position was a space we want to get rid of it
						displayText = displayText.slice(0, lastBreakPos) + displayText.slice(lastBreakPos + 1)
						i--
					} else {
						if (i - lastBreakPos > 0) {
							// if we can afford we want to have the breaking character in the top line, otherwise it gets wrapped (ugly, but better for space usage)
							lastBreakPos += 1
						}
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

		var lines = breakPos.length - 1

		if (lines * lineheight * (double ? 2 : 1) + (lines - 1) * linespacing * (double ? 2 : 1) > h) {
			lines = parseInt((h + linespacing * (double ? 2 : 1)) / ((lineheight + linespacing) * (double ? 2 : 1)))
			textFits = false
		}

		if (lines === 0) {
			return true
		}

		if (check !== true) {
			for (var line = 1; line <= lines; line++) {
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
				var xStart, yStart

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

				var linetext = displayText.slice(breakPos[line - 1], breakPos[line])
				this.drawTextLine(xStart, yStart, linetext, color, fontindex, charspacing, double)
			}
		}

		return textFits
	}

	drawBorder(depth = 0, color) {
		if (depth > 0) {
			if (depth * 2 < this.width) {
				for (var x = 0; x < depth; x++) {
					this.verticalLine(x, color)
				}

				for (var x = this.width - depth; x < this.width; x++) {
					this.verticalLine(x, color)
				}
			} else {
				for (var x = 0; x < this.width; x++) {
					this.verticalLine(x, color)
				}
			}

			if (depth * 2 < this.height) {
				for (var y = 0; y < depth; y++) {
					this.horizontalLine(y, color)
				}

				for (var y = this.height - depth; y < this.height; y++) {
					this.horizontalLine(y, color)
				}
			} else {
				for (var y = 0; y < this.height; y++) {
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

	drawCenterText(x, y, text, color, fontindex, spacing, double) {
		/*
			DEPRECATED
			This Function doesn't work with UTF16 text.
			Use drawAlignedText instead
		*/
		if (text == undefined || text == '') {
			return 0
		}

		var xCenter = x
		var maxWidth = x * 2 // maximum line width is only correct if text center position is left of image center

		if (maxWidth > this.width) {
			// correction of line width if text center is right of image center
			maxWidth = (this.width - x) * 2
		}

		var displayText = text.trim() // remove leading and trailing spaces for display
		// do we have more then one line?
		var xSize = this.drawText(0, 0, displayText, color, fontindex, spacing, double, true)

		if (xSize > maxWidth) {
			// breakup text in pieces
			//const breakChars = '\s-~,';
			var breakPos = [0]
			var lastBreakPos = 0
			var lineWidth = 0

			for (var i = 0; i < displayText.length; i++) {
				if (
					displayText.charCodeAt(i) == 32 ||
					displayText.charCodeAt(i) == 45 ||
					displayText.charCodeAt(i) == 95 ||
					displayText.charCodeAt(i) == 58 ||
					displayText.charCodeAt(i) == 126
				) {
					lastBreakPos = i // remember the latest position where break is possible
				}

				if (
					this.drawText(
						0,
						0,
						displayText.substr(breakPos[breakPos.length - 1], i + 1),
						color,
						fontindex,
						spacing,
						double,
						true
					) > maxWidth
				) {
					if (lastBreakPos > 0) {
						// if line is getting too long and there was a good wrap position, wrap it at that position

						if (displayText.charCodeAt(lastBreakPos) == 32) {
							// if the break position was a space we want to get rid of it
							displayText = displayText.slice(0, lastBreakPos) + displayText.slice(lastBreakPos + 1)
						} else {
							if (i - lastBreakPos > 0) {
								// if we can afford we want to have the breaking charakter in the top line, otherwise it gets wrapped (ugly, but better for space usage)
								lastBreakPos += 1
							}
						}

						breakPos.push(lastBreakPos)
					} else {
						breakPos.push(i - 1) // if there has been no good break position, just wrap it anyway
						lastBreakPos = 0
					}
				}
			}

			breakPos.push(displayText.length)

			for (var lines = 1; lines < breakPos.length; lines++) {
				xSize = this.drawText(
					0,
					0,
					displayText.substr(breakPos[lines - 1], breakPos[lines]),
					color,
					fontindex,
					spacing,
					double,
					true
				)
				var xStart = parseInt(xCenter - xSize / 2)
				var yStart =
					y -
					parseInt(((breakPos.length - 1) * (double ? 14 : 7) + (breakPos.length - 2) * (double ? 4 : 2)) / 2) +
					(lines - 1) * (double ? 18 : 9)
				this.drawText(
					xStart,
					yStart,
					displayText.substr(breakPos[lines - 1], breakPos[lines]),
					color,
					fontindex,
					spacing,
					double
				)
			}
		} else {
			// just draw one line
			var xStart = parseInt(xCenter - xSize / 2)
			return this.drawText(xStart, y - (double ? 7 : 4), displayText, color, fontindex, spacing, double)
		}
	}

	drawChar(x, y, char, color, fontindex, double, check) {
		if (double === undefined) {
			double = false
		}

		if (char === undefined) {
			return 0
		}

		// check is for not drawing any actual pixels. just calculate the font size
		if (check === undefined) {
			check = false
		}

		if (char == 32 || char == 160) {
			// return blanks for space
			return 2
		}

		if (font[fontindex] === undefined) {
			return 0
		}

		if (char >= 0xd800 && char <= 0xdbff) {
			// most likely a lead surrogate of an UTF16 pair
			return 0
		}

		if (font[fontindex][char] === undefined) {
			this.debug('trying to draw a character that doesnt exist in the font:', char, String.fromCharCode(parseInt(char)))
			return 0
		}

		var gfx = font[fontindex][char]
		var maxX = 0

		for (var pixel in gfx) {
			if (double == true) {
				if ((gfx[pixel][0] + 1) * 2 > maxX) {
					maxX = (gfx[pixel][0] + 1) * 2
				}

				if (check == false) {
					for (var len = 0; len < gfx[pixel][2]; len++) {
						this.pixel(x + gfx[pixel][0] * 2, y + (gfx[pixel][1] * 2 + len * 2), color)
						this.pixel(x + gfx[pixel][0] * 2 + 1, y + (gfx[pixel][1] * 2 + len * 2), color)
						this.pixel(x + gfx[pixel][0] * 2, y + gfx[pixel][1] * 2 + len * 2 + 1, color)
						this.pixel(x + gfx[pixel][0] * 2 + 1, y + gfx[pixel][1] * 2 + len * 2 + 1, color)
					}
				}
			} else {
				if (gfx[pixel][0] + 1 > maxX) {
					maxX = gfx[pixel][0] + 1
				}

				if (check == false) {
					for (var len = 0; len < gfx[pixel][2]; len++) {
						this.pixel(x + gfx[pixel][0], y + gfx[pixel][1] + len, color)
					}
				}
			}
		}

		return maxX
	}

	drawCornerTriangle(depth = 0, color, halign = 'left', valign = 'top') {
		if (depth > 0 && (halign == 'left' || halign == 'right') && (valign == 'top' || valign == 'bottom')) {
			var maxY = depth > this.height ? this.height : depth

			for (var y = 0; y < maxY; y++) {
				var trueY = valign == 'bottom' ? this.height - 1 - y : y

				for (var x = 0; x < depth - y && x < this.width; x++) {
					var trueX = halign == 'right' ? this.width - 1 - x : x

					this.pixel(trueX, trueY, color)
				}
			}

			return true
		} else {
			return false
		}
	}

	drawFromPNG(file, xStart, yStart) {
		var data, png

		try {
			data = fs.readFileSync(file)
			png = this.drawFromPNGdata(data, xStart, yStart)
		} catch (e) {
			this.debug('Error opening image file: ' + file, e)
			return
		}
	}

	drawFromPNGdata(data, xStart = 0, yStart = 0, width = 72, height = 58, halign = 'center', valign = 'center') {
		var data, png
		var xouter, xinnner, youter, yinner, wouter, houter

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
			switch (
				valign // image is smaller than drawing pane
			) {
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

		for (var y = 0; y < houter; y++) {
			for (var x = 0; x < wouter; x++) {
				var idx = (png.width * (y + yinner) + x + xinner) << 2
				var r = png.data[idx]
				var g = png.data[idx + 1]
				var b = png.data[idx + 2]
				var a = png.data[idx + 3]

				if (png.data[idx + 3] > 0) {
					if (png.data[idx + 3] === 256) {
						this.pixel(xStart + xouter + x, yStart + youter + y, Image.rgb(r, g, b))
					} else {
						this.pixel(xStart + xouter + x, yStart + youter + y, Image.argb(a, r, g, b))
					}
				}
			}
		}
	}

	drawLetter(x, y, letter, color, fontindex, double, check) {
		/*
			DEPRECATED
			This Function doesn't work with UTF16 chars
			Use drawChar instead
		*/
		if (double === undefined) {
			double = false
		}

		if (letter === undefined || ((letter.length > 1 || letter.length == 0) && letter == 'icon')) {
			return 0
		}

		// check is for not drawing any actual pixels. just calculate the font size
		if (check === undefined) {
			check = false
		}

		var num

		if (fontindex !== 'icon') {
			num = letter.charCodeAt(0)
		} else {
			num = letter
		}

		return this.drawChar(x, y, num, color, fontindex, double, check)
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
			return
		}

		if (buffer.length == width * height * 4) {
			// ARGB
			var counter = 0

			for (var y2 = 0; y2 < height; ++y2) {
				for (var x2 = 0; x2 < width; ++x2) {
					var color = buffer.readUInt32BE(counter)
					this.pixel(x + x2, y + y2, color)
					counter += 4
				}
			}
		} else if (buffer.length == width * height * 3) {
			// RGB
			var counter = 0
			for (var y2 = 0; y2 < height; ++y2) {
				for (var x2 = 0; x2 < width; ++x2) {
					var color = buffer.readUIntBE(counter, 3)
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

	drawText(x, y, text, color, fontindex, spacing, double, check) {
		/*
			DEPRECATED
			This function has several problems
			Use drawTextLine or drawAlignedText instead
		*/
		if (text === undefined || text.length == 0) {
			return 0
		}

		if (spacing === undefined) {
			spacing = 2
		}

		if (double === undefined) {
			double = false
		}

		var chars = text.split('')
		var max_x = 0
		var x_pos = 0
		var y_pos = y
		var just_wrapped = true

		for (var i in chars) {
			if (x + x_pos > this.width - (double ? 16 : 8) && check != true) {
				x_pos = 0
				y_pos += double ? 18 : 9
				just_wrapped = true
			}

			if (!(chars[i] == ' ' && just_wrapped == true)) {
				x_pos += (double ? 4 : 2) + this.drawLetter(x + x_pos, y_pos, chars[i], color, fontindex, double, check)
			}

			just_wrapped = false

			if (x_pos > max_x) {
				max_x = x_pos
			}
		}

		return max_x
	}

	drawTextLine(x, y, text, color, fontindex, spacing, double, check) {
		if (text === undefined || text.length == 0) {
			return 0
		}

		if (spacing === undefined) {
			spacing = 2
		}

		if (double === undefined) {
			double = false
		}

		var chars = text.split('')
		var max_x = 0
		var x_pos = 0
		var y_pos = y

		for (var i = 0; i < chars.length; i++) {
			var charcode = chars[i].charCodeAt(0)
			if (charcode >= 0xd800 && charcode <= 0xdbff && chars.length - 1 > i) {
				// check if this is the start of a surrogate pair
				var lead = charcode
				var tail = chars[i + 1].charCodeAt(0)

				if (tail >= 0xdc00 && tail <= 0xdfff) {
					// low surrogate
					charcode = (lead - 0xd800) * 0x400 + tail - 0xdc00 + 0x10000
					i++
				}
			}

			var width = this.drawChar(x + x_pos, y_pos, charcode, color, fontindex, double, check)
			x_pos += width ? width : 0

			if (i < chars.length - 1) {
				x_pos += width ? (double ? spacing * 2 : spacing) : 0
			}

			if (x_pos > max_x) {
				max_x = x_pos
			}
		}

		return max_x
	}

	horizontalLine(y, color) {
		for (var x = 0; x < this.width; x++) {
			this.pixel(x, y, color)
		}

		return true
	}

	pixel(x, y, color) {
		if (x >= this.width) {
			return
		}

		if (y >= this.height) {
			return
		}

		var line = this.canvas[y]

		if (color <= 0xffffff) {
			line.writeUIntBE(color & 0xffffff, x * 3, 3)
		} else {
			var alpha = Math.floor(color / 0x1000000) / 0xff
			var oldr = line.readUInt8(x * 3)
			var oldg = line.readUInt8(x * 3 + 1)
			var oldb = line.readUInt8(x * 3 + 2)
			var newr = (color >> 16) & 0xff
			var newg = (color >> 8) & 0xff
			var newb = color & 0xff
			line.writeUIntBE(
				Image.rgb(
					oldr * (1 - alpha) + newr * alpha,
					oldg * (1 - alpha) + newg * alpha,
					oldb * (1 - alpha) + newb * alpha
				),
				x * 3,
				3
			)
		}

		this.lastUpdate = Date.now()

		return true
	}

	toBase64() {
		return Buffer.concat(this.canvas).toString('base64')
	}

	verticalLine(x, color) {
		for (var y = 0; y < this.height; y++) {
			this.pixel(x, y, color)
		}

		return true
	}
}

exports = module.exports = Image

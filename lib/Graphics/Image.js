/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>, Dorian Meid <meid@backstage.org>
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

import { Canvas, ImageData } from '@julusian/skia-canvas'
import LogController from '../Log/Controller.js'
import { PNG } from 'pngjs'

const DEFAULT_FONTS =
	'Companion-sans, Companion-symbols1, Companion-symbols2, Companion-symbols3, Companion-symbols4, Companion-symbols5, Companion-symbols6, Companion-emoji'

/**
 * @param {string | Buffer} pngData
 * @returns {Promise<PNG>}
 */
async function pngParse(pngData) {
	return new Promise((resolve, reject) => {
		new PNG().parse(pngData, (err, data) => {
			if (err) reject(err)
			else resolve(data)
		})
	})
}

/**
 * Class for generating an image and rendering some content to it
 */
class Image {
	/**
	 * Create an image
	 * @param {number} width the width of the image in integer
	 * @param {number} height the height of the image in integer
	 * @param {number} oversampling a factor of how much more pixels the image should have in width and height
	 */
	constructor(width, height, oversampling) {
		this.logger = LogController.createLogger('Graphics/Image')

		/* Defaults for custom images from modules */
		if (width === undefined) {
			width = 72
		}
		if (height === undefined) {
			height = 58
		}

		if (oversampling === undefined) {
			oversampling = 1
		}

		this.width = width
		this.height = height

		this.realwidth = width * oversampling
		this.realheight = height * oversampling
		this.canvas = new Canvas(this.realwidth, this.realheight)
		this.context2d = this.canvas.getContext('2d')
		this.context2d.scale(oversampling, oversampling)
	}

	/**
	 * fills the whole image with a color
	 * @param {string} color CSS color string
	 * @returns {boolean} success
	 */
	fillColor(color) {
		return this.box(0, 0, this.realwidth, this.realheight, color)
	}

	/**
	 * draws a line between two given points
	 * @param {number} x1
	 * @param {number} y1
	 * @param {number} x2
	 * @param {number} y2
	 * @param {string} color CSS color string
	 * @param {number} lineWidth
	 * @returns {true}
	 */
	line(x1, y1, x2, y2, color, lineWidth = 1) {
		this.context2d.lineWidth = lineWidth
		this.context2d.strokeStyle = color
		this.context2d.beginPath()
		this.context2d.moveTo(x1, y1)
		this.context2d.lineTo(x2, y2)
		this.context2d.closePath()
		this.context2d.stroke()

		return true
	}

	/**
	 * draws a horizontal line at given height from top
	 * @param {number} y
	 * @param {string} color CSS color string
	 * @returns {boolean} success
	 */
	horizontalLine(y, color) {
		return this.line(0, y, this.width, y, color)
	}

	/**
	 * draws a vertical line at given distance from left
	 * @param {number} x
	 * @param {string} color CSS color string
	 * @returns {boolean} success
	 */
	verticalLine(x, color) {
		return this.line(x, 0, x, this.height, color)
	}

	/**
	 * draws a box with optional fill color and optional outline
	 * @param {number} x1
	 * @param {number} y1
	 * @param {number} x2
	 * @param {number} y2
	 * @param {string|undefined} color CSS string fill color, unfilled if undefined
	 * @param {string|undefined} strokeColor CSS string line color, no line if undefined
	 * @param {number|undefined} lineWidth line width defaults to 1
	 * @param {'inside'|'center'|'outside'|undefined} lineOrientation defaults to 'inside'
	 * @returns {boolean} something has been drawn
	 */
	box(x1, y1, x2, y2, color = undefined, strokeColor = undefined, lineWidth = 1, lineOrientation = 'inside') {
		if (x2 == x1 || y2 == y1) return false
		let didDraw = false
		if (color) {
			this.context2d.fillStyle = color
			this.context2d.fillRect(x1, y1, x2 - x1, y2 - y1)
			didDraw = true
		}
		if (strokeColor) {
			didDraw = didDraw || this.boxLine(x1, y1, x2, y2, strokeColor, lineWidth, lineOrientation)
		}

		return didDraw
	}

	/**
	 * Draws an outline rectangle
	 * @param {number} x1 position of left edge
	 * @param {number} y1 position of top edge
	 * @param {number} x2 position of right edge
	 * @param {number} y2 position of bottom edge
	 * @param {string} color color string
	 * @param {number|undefined} lineWidth line width
	 * @param {'inside'|'center'|'outside'|undefined} lineOrientation direction of lines in regard to the edges
	 * @returns {boolean} returns true if a visible rectangle has been drawn
	 */
	boxLine(x1, y1, x2, y2, color, lineWidth = 1, lineOrientation = 'inside') {
		if (lineWidth <= 0) return false
		const halfline = lineWidth / 2
		switch (lineOrientation) {
			case 'inside':
				x1 += halfline
				y1 += halfline
				x2 -= halfline
				y2 -= halfline
				break
			case 'outside':
				x1 -= halfline
				y1 -= halfline
				x2 += halfline
				y2 += halfline
				break
		}

		this.context2d.lineWidth = lineWidth
		this.context2d.strokeStyle = color
		this.context2d.strokeRect(x1, y1, x2 - x1, y2 - y1)

		if (lineWidth > 0) {
			return true
		} else {
			return false
		}
	}

	/**
	 * Draws an image to the canvas from PGN data
	 * the image can be fitted and cropped to the canvas in many variations
	 * @param {Buffer} data base64 encoded buffer with the raw PGN data
	 * @param {number} xStart left position where to place the image
	 * @param {number} yStart top position where to place the image
	 * @param {number} width width of the bounding box where to place the image
	 * @param {number} height height of the bounding box where to place the image
	 * @param {'left'|'center'|'right'} halign horizontal alignment of the image in the bounding box (defaults to center)
	 * @param {'top'|'center'|'bottom'} valign vertical alignment of the image in the bounding box (defaults to center)
	 * @param {number|'crop'|'fill'|'fit'} scale the size factor of the image. Number scales by specified amount, fill scales to fill the bounding box neglecting aspect ratio, crop scales to fill the bounding box and crop if necessary, fit scales to fit the bounding box with the longer side
	 * @returns {Promise<void>}
	 */
	async drawFromPNGdata(
		data,
		xStart = 0,
		yStart = 0,
		width = 72,
		height = 72,
		halign = 'center',
		valign = 'center',
		scale = 1
	) {
		let png = await pngParse(data)

		let imageWidth = png.width
		let imageHeight = png.height

		// create HTML compatible imageData object
		const pixelarray = new Uint8ClampedArray(png.data)
		let imageData
		try {
			imageData = new ImageData(pixelarray, imageWidth, imageHeight)
		} catch (error) {
			console.log('new ImageData failed', error)
			return
		}

		// createImageBitmap() works async, so this intermediate canvas is a synchronous workaround
		const imageCanvas = new Canvas(imageData.width, imageData.height)
		const imageContext2d = imageCanvas.getContext('2d')
		imageContext2d.putImageData(imageData, 0, 0)

		let calculatedScale = 1
		let scaledImageWidth = imageWidth
		let scaledImageHeight = imageHeight

		if (scale === 'fit') {
			const scaleMin = Math.min(width / imageWidth, height / imageHeight)
			const scaleMax = Math.max(width / imageWidth, height / imageHeight)
			calculatedScale = scaleMax < scaleMin ? scaleMax : scaleMin
			scaledImageWidth = imageWidth * calculatedScale
			scaledImageHeight = imageHeight * calculatedScale
		} else if (scale === 'crop') {
			let scaleMin = Math.min(width / imageWidth - 1, height / imageHeight - 1)
			let scaleMax = Math.max(width / imageWidth - 1, height / imageHeight - 1)
			calculatedScale = (scaleMax <= 1 ? scaleMax : scaleMin) + 1
			scaledImageWidth = imageWidth * calculatedScale
			scaledImageHeight = imageHeight * calculatedScale
		} else if (typeof scale === 'number') {
			if (scale === 0) {
				console.warn('image scale is zero, abort drawing of image')
				return
			}
			calculatedScale = scale
			scaledImageWidth = imageWidth * calculatedScale
			scaledImageHeight = imageHeight * calculatedScale
		} else {
			// if there is none of the aspect ration retaining scales, do the 'fill'-type
			scaledImageWidth = width
			scaledImageHeight = height
		}

		if (scaledImageWidth < 1 || scaledImageHeight < 1) {
			console.warn('image width or height after scaling is less then one pixel, abort drawing of image')
			return
		}

		// set default transformation values at 'fill'-type
		const source = {
			x: 0,
			y: 0,
			w: imageWidth,
			h: imageHeight,
		}
		const destination = {
			x: xStart,
			y: yStart,
			w: width,
			h: height,
		}

		if (scaledImageWidth > width) {
			//image is broader than drawing pane
			source.w = width / calculatedScale
			switch (halign) {
				case 'center':
					source.x = (imageWidth - source.w) / 2
					break
				case 'right':
					source.x = imageWidth - source.w
					break
			}
		} else if (scaledImageWidth < width) {
			// image is narrower than drawing pane
			destination.w = scaledImageWidth
			switch (halign) {
				case 'center':
					destination.x += (width - scaledImageWidth) / 2
					break
				case 'right':
					destination.x += width - scaledImageWidth
					break
			}
		}

		if (scaledImageHeight > height) {
			// image is taller than drawing pane
			source.h = height / calculatedScale
			switch (valign) {
				case 'center':
					source.y = (imageHeight - source.h) / 2
					break
				case 'bottom':
					source.y = imageHeight - source.h
					break
			}
		} else if (scaledImageHeight < height) {
			// image is smaller than drawing pane
			destination.h = scaledImageHeight
			switch (valign) {
				case 'center':
					destination.y += (height - scaledImageHeight) / 2
					break
				case 'bottom':
					destination.y += height - scaledImageHeight
					break
			}
		}

		this.context2d.drawImage(
			imageCanvas,
			source.x,
			source.y,
			source.w,
			source.h,
			destination.x,
			destination.y,
			destination.w,
			destination.h
		)
	}

	/**
	 * draws a single line of left aligned text
	 * the line lenght is not wrapped or limited and may extend beyond the canvas
	 * @param {number} x left position where to start the line
	 * @param {number} y top position where to start the line
	 * @param {string} text
	 * @param {string} color CSS color string
	 * @param {number} fontsize Em height
	 * @param {boolean=} dummy Don't actually draw anything just return the text width
	 * @returns {number} width of the line
	 */
	drawTextLine(x, y, text, color, fontsize, dummy) {
		if (text === undefined || text.length == 0) return 0

		if (isNaN(fontsize)) return 0
		if (fontsize < 3) return 0

		this.context2d.font = `${fontsize}px ${DEFAULT_FONTS}`

		const metrics = this.context2d.measureText(text)

		if (!dummy) {
			this.context2d.textAlign = 'left'
			this.context2d.fillStyle = color
			if (fontsize < 10) {
				let textPath = this.context2d.outlineText(text) // trick for disabling Antialiasing, but it also breaks support for some unicode
				this.context2d.fill(textPath.offset(x, y + Math.round(metrics.actualBoundingBoxAscent)))
			} else {
				this.context2d.fillText(text, x, y + Math.round(metrics.actualBoundingBoxAscent))
			}
		}

		return metrics.width
	}

	/**
	 * draws a single line of aligned text, doesn't care for line breaks or length
	 * @param {number} x horizontal value of the alignment point
	 * @param {number} y vertical value of the alignment point
	 * @param {string} text
	 * @param {string} color CSS color string
	 * @param {number} fontsize Em height
	 * @param {'left'|'center'|'right'|undefined} halignment defaults to 'center'
	 * @param {'top'|'center'|'bottom'|'baseline'|undefined} valignment defaults to 'center'
	 * @returns the width of the line
	 */
	drawTextLineAligned(x, y, text, color, fontsize, halignment = 'center', valignment = 'center') {
		if (text === undefined || text.length == 0) return 0
		if (halignment != 'left' && halignment != 'center' && halignment != 'right') halignment = 'left'

		this.context2d.font = `${fontsize}px ${DEFAULT_FONTS}`
		this.context2d.fillStyle = color
		this.context2d.textAlign = halignment

		const metrics = this.context2d.measureText(text)

		let vOffset = 0
		switch (valignment) {
			case 'top':
				vOffset = metrics.actualBoundingBoxAscent
				break

			case 'center':
				vOffset = metrics.actualBoundingBoxAscent / 2
				break

			case 'bottom':
				vOffset = metrics.actualBoundingBoxDescent * -1
				break
		}
		if (fontsize < 10) {
			let textPath = this.context2d.outlineText(text) // trick for disabling Antialiasing, but it also breaks support for some unicode
			this.context2d.fill(textPath.offset(x, y + vOffset))
		} else {
			this.context2d.fillText(text, x, y + vOffset)
		}
		this.context2d.fillText(text, x, y + vOffset)

		return metrics.width
	}

	/**
	 * Draws aligned text in an boxed area.
	 * @param {number} x bounding box top left horizontal value
	 * @param {number} y bounding box top left vertical value
	 * @param {number} w bounding box width
	 * @param {number} h bounding box height
	 * @param {string} text the text to draw
	 * @param {string} color CSS color string
	 * @param {number | 'auto'} fontsize height of font, either pixels or 'auto'
	 * @param {string} halign horizontal alignment left, center, right
	 * @param {string} valign vertical alignment top, center, bottom
	 * @param {boolean} dummy don't actually draw anything if true, just return if the text fits
	 * @returns {boolean} returns true if text fits
	 */
	drawAlignedText(
		x = 0,
		y = 0,
		w = 72,
		h = 72,
		text,
		color,
		fontsize = 'auto',
		halign = 'center',
		valign = 'center',
		dummy = false
	) {
		// let textFits = true
		let lineheight
		let fontheight

		if (text == undefined || text == '') {
			return true
		}

		let displayText = text.toString().trim() // remove leading and trailing spaces for display

		displayText = displayText.replaceAll('\\n', '\n') // users can add deliberate line breaks, let's replace it with a real line break
		displayText = displayText.replaceAll('\\r', '\n') // users can add deliberate line breaks, let's replace it with a real line break
		displayText = displayText.replaceAll('\\t', '\t') // users can add deliberate tabs, let's replace it with a real tab

		// validate the fontSize
		fontheight = Number(fontsize)
		if (isNaN(fontheight)) {
			fontsize = 'auto'
		} else if (fontheight < 3) {
			// block out some tiny fontsizes
			fontheight = 3
		} else if (fontheight > 120) {
			// block out some giant fontsizes
			fontheight = 120
		}

		// get needed fontsize
		if (fontsize === 'auto') {
			let len = displayText.length
			let checksize
			// narrow the sizes to check by guessing how many chars will fit at a size
			const area = (w * h) / 5000
			if (len < 7 * area) {
				checksize = [60, 51, 44, 31, 24, 20, 17, 15, 12, 10, 9, 8, 7]
			} else if (len < 30 * area) {
				checksize = [31, 24, 20, 17, 15, 12, 10, 9, 8, 7]
			} else if (len < 40 * area) {
				checksize = [24, 20, 17, 15, 12, 10, 9, 8, 7]
			} else if (len < 50 * area) {
				checksize = [17, 15, 12, 10, 9, 8, 7]
			} else {
				checksize = [15, 12, 10, 9, 8, 7]
			}

			fontheight =
				checksize.find(
					(size) => this.drawAlignedText(x, y, w, h, displayText, color, size, halign, valign, true) === true
				) ?? 6
		}

		lineheight = Math.floor(fontheight * 1.1) // this lineheight is not the real lineheight needed for the font, but it is calclulated to match the existing font size / lineheight ratio of the bitmap fonts

		// breakup text in pieces
		let lines = []
		let breakPos = null

		//if (fontsize < 9) fontfamily = '7x5'
		this.context2d.font = `${fontheight}px/${lineheight}px ${DEFAULT_FONTS}`
		this.context2d.textWrap = false

		/**
		 * this is necessary to get unicode compatible substring where a codepoint can be more than one char
		 * @param {string} string
		 * @param {number} start
		 * @param {number} end
		 * @returns {string}
		 */
		const substring = (string, start, end) => {
			const chars = [...string]
			if (!start) start = 0
			if (!end) end = chars.length
			return chars.slice(start, end).join('')
		}

		/**
		 *
		 * @param {string} text
		 * @returns {{ ascent: number, descent: number, maxCodepoints: number}}
		 */
		const findLastChar = (text) => {
			// skia-canvas built-in line break algorithm is poor
			let length = [...text].length
			//console.log('\nstart linecheck for', text, 'in width', w, 'chars', length)

			// let's check how far we off
			let measure = this.context2d.measureText(text)
			let diff = w - measure.width

			// if all fits we are done
			if (diff >= 0) {
				return {
					ascent: measure.actualBoundingBoxAscent,
					descent: measure.actualBoundingBoxDescent,
					maxCodepoints: length,
				}
			}

			// ok, we are not done. let's start with an assumption of how big one char is in average
			let nWidth = (w - diff) / length
			// how many chars fit probably in one line
			let chars = Math.round(w / nWidth)

			diff = w - this.context2d.measureText(substring(text, 0, chars)).width // check our guessed lenght

			if (Math.abs(diff) > nWidth) {
				// we seem to be off by more than one char
				// what is the needed difference in chars
				let chardiff = Math.round(diff / nWidth)
				let lastCheckedChars = 0

				while (Math.abs(chars - lastCheckedChars) > 1) {
					chars += chardiff // apply assumed difference
					diff = w - this.context2d.measureText(substring(text, 0, chars)).width
					lastCheckedChars = chars
					//console.log('while checking', substring(text, 0, chars), chars, 'diff', diff, 'nWidth', nWidth, 'chardiff', chardiff)
					chardiff = Math.round(diff / nWidth)
				}
			}
			// we found possible closest match, check if the assumed nWidth was not too big
			//console.log('possible match', substring(text, 0, chars), 'diff', diff, 'nWidth', nWidth, 'chardiff', Math.round(diff / nWidth))
			for (let i = 0; i <= length; i += 1) {
				if (diff > 0 && w - this.context2d.measureText(substring(text, 0, chars + 1)).width < 0) {
					// we are smaller and next char is too big
					//console.log('line algo says '+chars+' chars are smaller', substring(text, 0, chars), this.context2d.measureText(substring(text, 0, chars)).width);
					return {
						ascent: measure.actualBoundingBoxAscent,
						descent: measure.actualBoundingBoxDescent,
						maxCodepoints: chars,
					}
				} else if (diff < 0 && w - this.context2d.measureText(substring(text, 0, chars - 1)).width > 0) {
					// we are bigger and one less char fits
					//console.log('line algo says '+chars+' chars are bigger', substring(text, 0, chars-1), this.context2d.measureText(substring(text, 0, chars-1)).width);
					return {
						ascent: measure.actualBoundingBoxAscent,
						descent: measure.actualBoundingBoxDescent,
						maxCodepoints: chars - 1,
					}
				} else if (diff == 0) {
					// perfect match
					//console.log('line algo says perfect match with '+chars+' chars', substring(text, 0, chars));
					return {
						ascent: measure.actualBoundingBoxAscent,
						descent: measure.actualBoundingBoxDescent,
						maxCodepoints: chars,
					}
				} else {
					// our assumed nWidth was too big, let's approach now char by char
					if (diff > 0) {
						//console.log('nope, make it one longer')
						chars += 1
					} else {
						//console.log('nope, make it one shorter')
						chars -= 1
					}
					diff = w - this.context2d.measureText(substring(text, 0, chars)).width
				}
			}

			//console.log('line algo failed', chars);
			return {
				ascent: measure.actualBoundingBoxAscent,
				descent: measure.actualBoundingBoxDescent,
				maxCodepoints: length,
			}
		}

		// function byteToString(arr) {
		// 	return new TextDecoder().decode(arr)
		// }

		const textArr = [...displayText]
		let lastDrawnByte = 0
		while (lastDrawnByte < textArr.length) {
			// get rid of one space at line start, but keep more spaces
			if (textArr[lastDrawnByte] == ' ') {
				lastDrawnByte += 1
			}

			// check if remaining text fits in line
			let { maxCodepoints, ascent, descent } = findLastChar(textArr.slice(lastDrawnByte).join(''))

			//console.log(`check text "${textArr.slice(lastDrawnByte).join('')}" arr=${textArr} lenght=${textArr.length - lastDrawnByte} max=${maxCodepoints}`)
			if (maxCodepoints >= textArr.length - lastDrawnByte) {
				let buf = []
				for (let i = lastDrawnByte; i < textArr.length; i += 1) {
					if (textArr[i].codePointAt(0) === 10) {
						lines.push({ text: buf, ascent, descent })
						buf = []
					} else {
						buf.push(textArr[i])
					}
				}
				lines.push({ text: buf, ascent, descent })
				lastDrawnByte = textArr.length
			} else {
				let line = textArr.slice(lastDrawnByte, lastDrawnByte + maxCodepoints)

				//lets look for a newline
				const newlinePos = line.indexOf(String.fromCharCode(10))
				if (newlinePos >= 0) {
					lines.push({
						text: line.slice(0, newlinePos),
						ascent,
						descent,
					})
					lastDrawnByte += newlinePos + 1
					continue
				}

				// lets look for a good break point
				breakPos = line.length - 1 // breakPos is the 0-indexed position of the char where a break can be done
				for (let i = line.length - 1; i > 0; i -= 1) {
					if (
						line[i] === ' ' || // space
						line[i] === '-' || // -
						line[i] === '_' || // _
						line[i] === ':' || // :
						line[i] === '~' // ~
					) {
						breakPos = i
						break
					}
				}

				if (line[breakPos] === ' ') {
					// get rid of a breaking space at end
					lines.push({
						text: line.slice(0, breakPos),
						ascent,
						descent,
					})
				} else {
					lines.push({
						text: line.slice(0, breakPos + 1),
						ascent,
						descent,
					})
				}
				lastDrawnByte += breakPos + 1
			}
		}
		//console.log('we got the break', text, lines.map(line => byteToString(line.text)))

		// now that we know the number of lines, we can check if the text fits vertically
		// the following function would be the real calculation if we would not force lineheight to 1.1x   let totalHeight = lines[0].ascent + lines[lines.length - 1].descent + (lines.length > 0 ? (lines.length - 1 ) * lineheight : 0 )
		if (lines.length < 1) return false
		lineheight = lines[0].ascent + lines[0].descent
		let totalHeight = lines.length * lineheight
		if (dummy) {
			return totalHeight <= h
		}

		// draw the individual lines

		// the following code would be the real calculation if we would not force lineheight to 1.1x
		/*
		let lastFittingLine = -1
		while (
			lastFittingLine + 1 < lines.length &&
			lines[0].ascent + lines[lastFittingLine + 1].descent + (lastFittingLine > 1 ? (lastFittingLine + 1) * lineheight : 0) <= h
		)
		{
			lastFittingLine += 1
		}
		*/
		let lastFittingLine = Math.min(lines.length, Math.floor(h / lineheight)) - 1

		if (lastFittingLine == -1) return false

		//totalHeight = lines[0].ascent + lines[lastFittingLine].descent + (lastFittingLine > 0 ? (lastFittingLine) * lineheight : 0)
		totalHeight = (lastFittingLine + 1) * lineheight
		//console.log('total text height', totalHeight, 'bounding box height', h);

		// since we are forcing the lineheight to 1.1, we have to calculate a new, smaller ascent and descent
		let correctedAscent = Math.round(fontheight * 1.02)
		// let correctedDescent = lineheight - correctedAscent
		correctedAscent = Math.round(lines[0].ascent)
		// correctedDescent = lineheight - correctedAscent

		let xAnchor = x
		switch (halign) {
			case 'left':
				this.context2d.textAlign = 'left'
				xAnchor = x
				break
			case 'center':
				this.context2d.textAlign = 'center'
				xAnchor = (x + w) / 2
				break
			case 'right':
				this.context2d.textAlign = 'right'
				xAnchor = x + w
				break
		}

		let yAnchor = 0
		switch (valign) {
			case 'top':
				yAnchor = correctedAscent
				break
			case 'center':
				yAnchor = Math.round((h - totalHeight) / 2 + correctedAscent)
				break
			case 'bottom':
				yAnchor = h - totalHeight + correctedAscent
				break
		}
		yAnchor += y

		this.context2d.fillStyle = color

		for (let l = 0; l <= lastFittingLine; l += 1) {
			const text = lines[l].text.join('')
			//this.context2d.fillText(text, xAnchor, yAnchor)
			if (fontheight < 10) {
				let textPath = this.context2d.outlineText(text) // trick for disabling Antialiasing, but it also breaks support for some unicode
				this.context2d.fill(textPath.offset(xAnchor, yAnchor))
			} else {
				this.context2d.fillText(text, xAnchor, yAnchor)
			}
			//this.horizontalLine(yAnchor - fontsize, 'rgb(255,0,255)')
			//this.horizontalLine(yAnchor + correctedDescent, 'rgb(0, 255, 0)')
			//this.horizontalLine(yAnchor - correctedAscent, ''''rgb(0,0,255)')
			//this.horizontalLine(yAnchor, 'rgb(255, 0, 0)')
			//console.log('Fontsize', fontsize, 'Lineheight', lineheight, 'asc', correctedAscent, 'des', correctedDescent, 'a+d', correctedAscent+correctedDescent);

			yAnchor += lineheight
		}

		return true
	}

	/**
	 * drawPixeBuffer
	 *
	 * Buffer can be either a buffer, or base64 encoded string.
	 * Type can be set to either 'buffer' or 'base64' according to your input data.
	 * Width and height is information about your buffer, not scaling.
	 *
	 * The buffer data is expected to be RGB or ARGB data, 1 byte per color,
	 * horizontally. Top left is first three bytes.
	 *
	 * @param {number} x left position of insert point
	 * @param {number} y top position of insert point
	 * @param {number} width integer information of the width of the buffer
	 * @param {number} height integer information of the height of the buffer
	 * @param {Buffer | Uint8Array | string} bufferRaw
	 */
	drawPixelBuffer(x, y, width, height, bufferRaw, type = undefined) {
		/** @type {Buffer} */
		let buffer
		if (typeof bufferRaw == 'object') {
			if (bufferRaw instanceof Buffer) {
				buffer = bufferRaw
			} else if (bufferRaw instanceof Uint8Array) {
				buffer = Buffer.from(bufferRaw.buffer, bufferRaw.byteOffset, bufferRaw.byteLength)
			} else {
				this.logger.error(`Pixelbuffer is of unknown type "${type}" (${typeof bufferRaw})`)
				return
			}
		} else if (typeof bufferRaw == 'string') {
			buffer = Buffer.from(bufferRaw, 'base64')
		} else {
			this.logger.error(`Pixelbuffer is of unknown type "${type}" (${typeof bufferRaw})`)
			return
		}

		if (buffer.length < width * height * 3) {
			this.logger.error(
				'Pixelbuffer of ' + buffer.length + ' bytes is less than expected ' + width * height * 3 + ' bytes'
			)
			return
		}

		if (buffer.length == width * height * 4) {
			// ARGB: swap order from ARGB to RGBA
			for (let i = 0; i < buffer.length; i += 4) {
				let a = buffer[i]

				buffer[i] = buffer[i + 1]
				buffer[i + 1] = buffer[i + 2]
				buffer[i + 2] = buffer[i + 3]
				buffer[i + 3] = a
			}
		} else if (buffer.length == width * height * 3) {
			// RGB: add alpha channel
			const rgb = Uint8Array.from(buffer)

			buffer = Buffer.alloc(width * height * 4)
			for (let i = 0; i < rgb.length / 3; i += 1) {
				buffer[i * 4] = rgb[i * 3] // Red
				buffer[i * 4 + 1] = rgb[i * 3 + 1] // Green
				buffer[i * 4 + 2] = rgb[i * 3 + 2] // Blue
				buffer[i * 4 + 3] = 255 // Alpha
			}
		} else {
			this.logger.error(
				`Pixelbuffer for a ${width}x${height} image should be either ${width * height * 3} or ${
					width * height * 4
				} bytes big. Not ${buffer.length}`
			)
			return
		}

		// create HTML compatible imageData object
		let imageData
		try {
			imageData = new ImageData(new Uint8ClampedArray(buffer), width, height)
		} catch (/** @type {any} */ error) {
			this.logger.error(`Can't draw pixel buffer, creating ImageData from buffer failed: ` + error.stack)
			return
		}

		// createImageBitmap() works async, so this intermediate canvas is a synchronous workaround
		const imageCanvas = new Canvas(imageData.width, imageData.height)
		const imageContext2d = imageCanvas.getContext('2d')
		imageContext2d.putImageData(imageData, 0, 0)

		this.context2d.drawImage(imageCanvas, x, y)
	}

	/**
	 * Draws a border around the button
	 * @param {number} depth width of the border
	 * @param {string} color CSS color of the border
	 * @returns {boolean} true if there is a visible border
	 */
	drawBorder(depth = 1, color = 'red') {
		if (depth <= 0) return false
		return this.boxLine(0, 0, this.width, this.height, color, depth, 'inside')
	}

	/**
	 * Draws a triangle in a corner
	 * @param {number} depth
	 * @param {string} color CSS color string
	 * @param {'left'|'right'|undefined} halign defaults to 'left'
	 * @param {'top'|'bottom'|undefined} valign defaults to 'top'
	 * @returns {boolean} success
	 */
	drawCornerTriangle(depth = 0, color, halign = 'left', valign = 'top') {
		if (depth == 0) return false
		let points

		if (halign == 'left' && valign == 'top') {
			points = [
				[0, 0],
				[depth, 0],
				[0, depth],
			]
		}
		if (halign == 'right' && valign == 'top') {
			points = [
				[this.width, 0],
				[this.width - depth, 0],
				[this.width, depth],
			]
		}
		if (halign == 'right' && valign == 'bottom') {
			points = [
				[this.width, this.height],
				[this.width - depth, this.height],
				[this.width, this.height - depth],
			]
		}
		if (halign == 'left' && valign == 'bottom') {
			points = [
				[0, this.height],
				[depth, this.height],
				[0, this.height - depth],
			]
		}
		if (!points) return false

		return this.drawFilledPath(points, color)
	}

	/**
	 * Draws an outline path from some points
	 * @param {number[][]} pathPoints an array of x and y points
	 * @param {string} color CSS color
	 * @param {number|undefined} lineWidth defaults to 1
	 * @param {boolean} close if true close the path from last point to first point, if last and first point are identical path will be autoclosed
	 * @returns {boolean} success
	 */
	drawPath(pathPoints, color, lineWidth = 1, close = false) {
		if (lineWidth <= 0) return false
		if (!Array.isArray(pathPoints) || pathPoints.length == 0) return false
		this.context2d.beginPath()
		const [firstPoint, ...points] = pathPoints
		this.context2d.moveTo(firstPoint[0], firstPoint[1])
		points.forEach((point) => {
			this.context2d.lineTo(point[0], point[1])
		})
		if (close || (firstPoint[0] == points[points.length - 1][0] && firstPoint[1] == points[points.length - 1][1])) {
			this.context2d.closePath()
		}

		this.context2d.strokeStyle = color
		this.context2d.lineWidth = lineWidth
		this.context2d.stroke()
		return true
	}

	/**
	 * Draws a filled path from some points
	 * @param {number[][]} pathPoints an array of x and y points
	 * @param {string} color CSS color
	 * @returns {boolean} success
	 */
	drawFilledPath(pathPoints, color) {
		if (!Array.isArray(pathPoints) || pathPoints.length == 0) return false
		this.context2d.beginPath()
		const [firstPoint, ...points] = pathPoints
		this.context2d.moveTo(firstPoint[0], firstPoint[1])
		points.forEach((point) => {
			this.context2d.lineTo(point[0], point[1])
		})

		this.context2d.fillStyle = color
		this.context2d.fill()
		return true
	}

	/**
	 * returns the pixels of the image in a buffer
	 * color order is RGBA
	 * @returns {Buffer} RGBA buffer of the pixels
	 */
	buffer() {
		const buffer = Buffer.from(this.context2d.getImageData(0, 0, this.realwidth, this.realheight).data)
		//const buffer = this.canvas.toBuffer('png')
		return buffer
	}

	/**
	 * returns the image as a data-url
	 * @returns {Promise<string>}
	 */
	toDataURL() {
		return this.canvas.toDataURL('png')
	}

	/**
	 * returns the image as a data-url
	 * @returns {string}
	 */
	toDataURLSync() {
		return this.canvas.toDataURLSync('png')
	}
}

export default Image

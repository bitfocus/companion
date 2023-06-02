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

// Super primitive drawing library!

import { Canvas, FontLibrary } from 'skia-canvas'
import font from '../Resources/Font.js'
import { PNG } from 'pngjs'
import { argb, rgb, rgbRev } from '../Resources/Util.js'

const widthMap = new WeakMap()
const heightMap = new WeakMap()
const dataMap = new WeakMap()

/**
 * ImageData
 * @param {Uint8ClampedArray} data the pixel data in RGBA
 * @param {number} width width
 * @param {number} height height
 */
class ImageData {
  constructor (data, width, height, ...options) {
    if (arguments.length < 3) {
      throw new TypeError(`Failed to construct 'ImageData': 3 arguments required, but only ${arguments.length} present.`)
    }

		if (!(data instanceof Uint8ClampedArray)) {
			throw new TypeError("Failed to construct 'ImageData': data is not of type 'Uint8ClampedArray'.")
		}

		if (typeof width !== 'number' || width === 0) {
			throw new Error("Failed to construct 'ImageData': The source width is zero or not a number.")
		}
		
		if (typeof height !== 'number' || height === 0) {
			throw new Error("Failed to construct 'ImageData': The source height is zero or not a number.")
		}

		if ((width * height * 4) > data.length) {
			throw new Error("Failed to construct 'ImageData': The requested image size exceeds the supported range.")
		}

		if ((data.length % 4) !== 0) {
			throw new Error("Failed to construct 'ImageData': The input data length is not a multiple of 4.")
		}

		if ((data.length % (4 * width)) !== 0) {
			throw new Error("Failed to construct 'ImageData': The input data length is not a multiple of (4 * width).")
		}

		widthMap.set(this, width)
		heightMap.set(this, height)
		dataMap.set(this, data)
		//Object.defineProperty(this, 'data', { configurable: true, enumerable: true, value: width, writable: false, get() { return data } })
		
		if (typeof options !== 'undefined') {
        
		}
    
  }
}

Object.defineProperty(ImageData.prototype, 'width', {
  enumerable: true,
  configurable: true,
  get () { return widthMap.get(this) }
})

Object.defineProperty(ImageData.prototype, 'height', {
  enumerable: true,
  configurable: true,
  get () { return heightMap.get(this) }
})

Object.defineProperty(ImageData.prototype, 'data', {
  enumerable: true,
  configurable: true,
  get () { return dataMap.get(this) }
})

Object.defineProperty(ImageData.prototype, Symbol.for('nodejs.util.inspect.custom'), {
  enumerable: false,
  configurable: true,
  value: function inspectImageData (depth, options) {
    if (depth < 0) {
      return options.stylize('[ImageData]', 'special')
    }

    return Object.assign(new (class ImageData {})(), { data: this.data, width: this.width, height: this.height }, this)
  }
})

class Image {
	static argb = argb
	static rgb = rgb
	static rgbRev = rgbRev

	constructor(width, height, oversampling) {
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
			

		this.argb = argb.bind(this)
		this.rgb = rgb.bind(this)
		this.rgbRev = rgbRev.bind(this)

		this.lastUpdate = Date.now()
		this.width = width * oversampling
		this.height = height * oversampling
		this.canvas = new Canvas(this.width, this.height)
		this.context2d = this.canvas.getContext('2d')
		this.context2d.scale(oversampling, oversampling)

	}

	fillColor(color) {
		return this.boxFilled(0, 0, this.width, this.height, color)
	}

	line(x1, y1, x2, y2, color, lineWidth = 1) {
		let col = rgbRev(color)
		this.context2d.lineWidth = lineWidth
		this.context2d.strokeStyle = `rgba(${col.r}, ${col.g}, ${col.b}, ${1})`
		this.context2d.beginPath()
    this.context2d.moveTo(x1, y1)
    this.context2d.lineTo(x2, y2)
    this.context2d.closePath()
		this.context2d.stroke()
		
		this.lastUpdate = Date.now()

		return true
	}

	horizontalLine(y, color) {
		return this.line(0, y + 0.5, this.width, y + 0.5, color)
	}

	verticalLine(x, color) {
		return this.line(x + 0.5 , 0, x + 0.5 , this.height, color)
	}

	boxFilled(x1, y1, x2, y2, color, strokeColor, lineWidth) {
		let col = rgbRev(color)
		if (strokeColor === undefined) {
			this.context2d.fillStyle = `rgba(${col.r}, ${col.g}, ${col.b}, ${1})`
			this.context2d.fillRect(x1, y1, x2-x1+1, y2-y1+1)
		} else {
			if (lineWidth === undefined) {
				lineWidth = 1
			}
			this.boxLine(x1, y1, x2, y2, strokeColor, lineWidth, 'inside')
		}

		this.lastUpdate = Date.now()
		return true
	}

	/**
	 * Draws an outline rectangle
	 * @param {number} x1 position of left edge
	 * @param {number} y1 position of top edge
	 * @param {number} x2 position of right edge
	 * @param {number} y2 position of bottom edge
	 * @param {number} color color number
	 * @param {number} lineWidth line width
	 * @param {'inside'|'center'|'outside'} lineOrientation direction of lines in regard to the edges
	 * @returns {boolean} returns true if a visible rectangle has been drawn
	 */
	boxLine(x1, y1, x2, y2, color, lineWidth = 1, lineOrientation = 'inside') {
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

		let col = rgbRev(color)
		this.context2d.lineWidth = lineWidth
		this.context2d.strokeStyle = `rgba(${col.r}, ${col.g}, ${col.b}, ${col.a / 255})`
		this.context2d.strokeRect(x1, y1, x2-x1+1, y2-y1+1)

		this.lastUpdate = Date.now()
		if (lineWidth > 0) {
			return true
		} else {
			return false
		}
	}

	/**
	 * Draws an image to the canvas from PGN data
	 * @param {Buffer} data base64 encoded buffer with the raw PGN data
	 * @param {number} xStart left position where to place the image
	 * @param {number} yStart top position where to place the image
	 * @param {number} width width of the image
	 * @param {number} height height of the image
	 * @param {'left'|'center'|'right'} halign horizontal alignment of the image in the bounding box (defaults to center)
	 * @param {'top'|'center'|'bottom'} valign vertical alignment of the image in the bounding box (defaults to center)
	 * @param {number|'crop'|'fill'|'fit'} scale the size factor of the image. Number scales by specified amount, fill scales to fill the bounding box neglecting aspect ratio, crop scales to fill the bounding box and crop if necessary, fit scales to fit the bounding box with the longer side
	 * @returns void
	 */
	drawFromPNGdata(data, xStart = 0, yStart = 0, width = 72, height = 72, halign = 'center', valign = 'center', scale = 1) {
		let png

		png = PNG.sync.read(data)
		let imageWidth = png.width
		let imageHeight = png.height

		// create HTML compatible imageData object
		const pixelarray = new Uint8ClampedArray(png.data)
		let imageData
		try {
			imageData = new ImageData(pixelarray, imageWidth, imageHeight)
		} catch (error) {
			console.log('new ImageData failed', error);
		}

		// createImageBitmap() works async, so this intermediate canvas is a synchronous workaround
		const imageCanvas = new Canvas(imageData.width, imageData.height)
		const imageContext2d = imageCanvas.getContext('2d')
		imageContext2d.putImageData(imageData, 0, 0)

		let calculatedScale = 1
		let scaledImageWidth = imageWidth
		let scaledImageHeight = imageHeight

		if (scale === 'fit') {
			let scaleMin = Math.min(width / imageWidth -1, height / imageHeight -1)
			let scaleMax = Math.max(width / imageWidth -1, height / imageHeight -1)
			calculatedScale = (scaleMax > 1 ? scaleMax : scaleMin) + 1
			scaledImageWidth = imageWidth * calculatedScale
			scaledImageHeight = imageHeight * calculatedScale

		} else if (scale === 'crop') {
			let scaleMin = Math.min(width / imageWidth -1, height / imageHeight -1)
			let scaleMax = Math.max(width / imageWidth -1, height / imageHeight -1)
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
			h: height
		}


		if (scaledImageWidth > width) {
			//image is broader than drawing pane
			source.w = width / calculatedScale
			switch (halign) {
				case 'center':
					source.x = (imageWidth - source.w) / 2
					break
				case 'right':
					source.x = (imageWidth - source.w)
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
					destination.x += (width - scaledImageWidth)
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
					source.y = (imageHeight - source.h)
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
					destination.y += (height - scaledImageHeight)
					break
			}
		}
	
		this.context2d.drawImage(imageCanvas, source.x, source.y, source.w, source.h, destination.x, destination.y, destination.w, destination.h)
		//console.log('scale, image w, image h', calculatedScale, imageCanvas.width, imageCanvas.height, '->', scaledImageWidth, scaledImageHeight)
		//console.log('drawing image ', source.x, source.y, source.w, source.h, '->', destination.x, destination.y, destination.w, destination.h)

		this.lastUpdate = Date.now()
	}

	/**
	 * draws a single line of left aligned text
	 * @param {*} x 
	 * @param {*} y 
	 * @param {*} text 
	 * @param {*} color 
	 * @param {*} fontindex 
	 * @param {*} spacing 
	 * @param {*} double 
	 * @param {*} dummy 
	 * @returns 
	 */
	drawTextLine(x, y, text, color, fontindex, spacing, double, dummy) {
		if (text === undefined || text.length == 0) return 0

		if (spacing === undefined) {
			spacing = 2
		}
		if (double === undefined) {
			double = false
		}
		if (parseInt(fontindex) == NaN) return 1

		let fontfamily = 'Companion-sans, Companion-emoji'

		if (fontindex == 0 || fontindex == 7) fontindex = 9
		this.context2d.font = `${fontindex}px ${fontfamily}`

		const metrics = this.context2d.measureText(text, this.width * 2)
		const lineheight = metrics.actualBoundingBoxAscent

		if (!dummy) {
			this.context2d.textAlign = 'left'
			let col = rgbRev(color)
			this.context2d.fillStyle = `rgba(${col.r}, ${col.g}, ${col.b}, 1)`
			if (fontindex < -12) { 
				let textPath = this.context2d.outlineText(text) // trick for disabling Antialiasing, but it also breaks support for some unicode
  			this.context2d.fill(textPath.offset(x, y + lineheight))
			} else {
				this.context2d.fillText(text, x, y + Math.round(metrics.actualBoundingBoxAscent))
			}
		}

		this.lastUpdate = Date.now()
		return metrics.width

		// let chars = text.split('')
		// let max_x = 0
		// let x_pos = 0
		// let y_pos = y

		// for (let i = 0; i < chars.length; i++) {
		// 	let charcode = chars[i].charCodeAt(0)
		// 	if (charcode >= 0xd800 && charcode <= 0xdbff && chars.length - 1 > i) {
		// 		// check if this is the start of a surrogate pair
		// 		let lead = charcode
		// 		let tail = chars[i + 1].charCodeAt(0)
		// 		if (tail >= 0xdc00 && tail <= 0xdfff) {
		// 			// low surrogate
		// 			charcode = (lead - 0xd800) * 0x400 + tail - 0xdc00 + 0x10000
		// 			i++
		// 		}
		// 	}

		// 	let width = this.drawChar(x + x_pos, y_pos, charcode, color, fontindex, double, dummy)
		// 	x_pos += width ? width : 0
		// 	if (i < chars.length - 1) {
		// 		x_pos += width ? (double ? spacing * 2 : spacing) : 0
		// 	}

		// 	if (x_pos > max_x) max_x = x_pos
		// }

		// return max_x
	}

	/**
	 * draws a single line of aligned text, doesn't care for line breaks or length
	 * @param {number} x horizontal value of the alignment point
	 * @param {number} y vertical value of the alignment point
	 * @param {string} text 
	 * @param {number} color 
	 * @param {number} fontsize
	 * @param {'left'|'center'|'right'} halignment
	 * @param {'top'|'center'|'bottom'|'baseline'} valignment
	 * @returns the width of the line
	 */
	drawTextLineAligned(x, y, text, color, fontsize, halignment = 'center', valignment = 'center') {
		if (text === undefined || text.length == 0) return 0
		if (halignment != 'left' && halignment != 'center' && halignment != 'right') halignment = 'left'

		const fontfamily = 'Companion-sans, Companion-emoji'
		const col = rgbRev(color)

		this.context2d.font = `${fontsize}px ${fontfamily}`
		this.context2d.fillStyle = `rgba(${col.r}, ${col.g}, ${col.b}, 1)`
		this.context2d.textAlign = halignment

		const metrics = this.context2d.measureText(text, this.width * 2)

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
		this.context2d.fillText(text, x, y + vOffset)

		this.lastUpdate = Date.now()
		return metrics.width
	}


	/**
	 * Draws aligned text in an boxed area.
	 * @param {number} x bounding box top left horizontal value
	 * @param {number} y bounding box top left vertical value
	 * @param {number} w bounding box width
	 * @param {number} h bounding box height
	 * @param {string} text the text to draw
	 * @param {number} color color of the text as uInt24 (rgb) or uInt32 (trgb)
	 * @param {number | string} fontindex index of font, either 'icon' or something else
	 * @param {number} spacing how much space should be between letters, leave undefined for spacing of font
	 * @param {number} size font size multiplier
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
		fontindex = '',
		spacing,
		size = 1,
		halign = 'center',
		valign = 'center',
		dummy = false
	) {
		let textFits = true
		let double = false
		let lineheight
		let linespacing
		let charspacing
		let fontfamily = 'Companion-sans, Companion-emoji'
		let fontsize

		if (text == undefined || text == '') {
			return true
		}

		let displayText = text.toString().trim() // remove leading and trailing spaces for display

		displayText = displayText.replaceAll('\\n', '\n') // users can add deliberate line breaks, let's replace it with a real line break
		displayText = displayText.replaceAll('\\r', '\n') // users can add deliberate line breaks, let's replace it with a real line break
		displayText = displayText.replaceAll('\\t', '\t') // users can add deliberate tabs, let's replace it with a real tab

		if (size === 2) {
			double = true
		}

		// validate the fontindex
		fontsize = parseInt(fontindex)
		if (isNaN(fontsize)) {
			fontindex = 'auto'
		} 

		if (fontindex == 0 || fontindex == 7) {
			fontsize = 9
		}

		// get needed fontsize
		if (fontindex === 'auto') {
			let len = displayText.length
			let checksize
			// narrow the sizes to check by guessing how many chars will fit at a size
			const area = w * h / 5000
			if (len < 7 * area) { checksize = [44, 30, 24, 18, 14] }
			else if (len < 30 * area) { checksize = [30, 24, 18, 14] }
			else if (len < 40 * area) { checksize = [24, 18, 14] }
			else if (len < 50 * area) { checksize = [18, 14] }
			else { checksize = [14] }

			fontsize = checksize.find(size => this.drawAlignedText(x, y, w, h, displayText, color, size, spacing, size, halign, valign, true) === true) ?? 9
			
		}

		lineheight = Math.floor(fontsize * 1.1) // this lineheight is not the real lineheight needed for the font, but it is calclulated to match the existing font size / lineheight ratio of the bitmap fonts


		// breakup text in pieces
		let lines = []
		let breakPos = null
		let lastNewlinePos = null
		
		if (fontsize < 10) fontfamily = '7x5'
		this.context2d.font = `${fontsize}px ${fontfamily}`
		this.context2d.textWrap = false
		
		const measure = (text) => {
			const metrics = this.context2d.measureText(text, w)
			//console.log(`\nmeasure: ${text} lenght: ${text.length} font: ${fontsize}\n`, metrics)
			return {
				maxBytes: metrics.lines[0].endIndex + 1,
				ascent: metrics.actualBoundingBoxAscent,
				descent: metrics.actualBoundingBoxDescent
			}
		}
		
		function getCharsBeforeNewline(text) {
			return text.substring(0, text.indexOf('\n'))
		}

		function byteToString(arr) {
			return (new TextDecoder().decode(arr))
		}
		
		const textArr = (new TextEncoder().encode(displayText)) // we need to split chars to bytes because of unicode handling
		let lastDrawnByte = 0
		while (lastDrawnByte < textArr.length) {
			// get rid of one space at line start, but keep more the other spaces
			if (textArr[lastDrawnByte] == 32) {
				lastDrawnByte += 1
			}

			// check if remaining text fits in line
			let { maxBytes, ascent, descent } = measure(byteToString(textArr.slice(lastDrawnByte)))

			//let logarr = textArr.slice(lastDrawnByte).toString().split(',').map(e => parseInt(e, 10).toString(2).padStart(8, '0'))
			//console.log(`check text "${byteToString(textArr.slice(lastDrawnByte))}" arr=${logarr} lenght=${textArr.length - lastDrawnByte} max=${maxBytes}`)
			
			if (maxBytes >= (textArr.length - lastDrawnByte)) {
				let buf = []
				for (let i = lastDrawnByte; i < textArr.length; i += 1) {
					if (textArr[i] === 10) {
						lines.push({ text: new Uint8Array(buf), ascent, descent })
						buf = []
					} else {
						buf.push(textArr[i])
					}
				}
				lines.push({ text: new Uint8Array(buf), ascent, descent })
				lastDrawnByte = textArr.length
				
			} else {

				let line = textArr.slice(lastDrawnByte, lastDrawnByte + maxBytes)

				//lets look for a newline
				const newlinePos = line.indexOf(10)
				if (newlinePos >= 0) {
					lines.push({
						text: new Uint8Array(line.slice(0, newlinePos)),
						ascent,
						descent
					})
					lastDrawnByte += newlinePos + 1
					continue
				}

				// lets look for a good break point
				breakPos = line.length - 1 // breakPos is the 0-indexed position of the char where a break can be done 
				for (let i = line.length - 1; i > 0; i -= 1) {
					if (
						line[i] === 32 || // space
						line[i] === 45 || // -
						line[i] === 95 || // _
						line[i] === 58 || // :
						line[i] === 126 // ~
					) {
						breakPos = i
						break
					}
				}

				// if no break is found, make sure we do not break within a unicode
				//console.log('breakpos1', breakPos, 'of', line.length, 'data flag', line[breakPos] & 0b11000000, lastDrawnByte + maxBytes, textArr[lastDrawnByte + maxBytes] & 0b11000000)
				if (
					breakPos == (line.length - 1) &&
					((line[breakPos] & 0b11000000) === 128 || (line[breakPos] & 0b11000000) === 192) &&
					(textArr[lastDrawnByte + maxBytes] & 0b11000000) === 128
				) {
					while ((textArr[lastDrawnByte + maxBytes] & 0b11000000) === 128) { 
						maxBytes += 1
					}
					line = textArr.slice(lastDrawnByte, lastDrawnByte + maxBytes)
					breakPos = line.length - 1
				}

				if (line[breakPos] === 32) { // get rid of a breaking space at end
					lines.push({
						text: new Uint8Array( line.slice(0, breakPos ) ),
						ascent,
						descent
					})
				} else {
					lines.push({
						text: new Uint8Array( line.slice(0, breakPos + 1) ),
						ascent,
						descent
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
		let lastFittingLine = Math.min(lines.length, Math.floor(h / lineheight)) -1

		if (lastFittingLine == -1) return false



		//totalHeight = lines[0].ascent + lines[lastFittingLine].descent + (lastFittingLine > 0 ? (lastFittingLine) * lineheight : 0)
		totalHeight = (lastFittingLine+1) * lineheight
		//console.log('total text height', totalHeight, 'bounding box height', h);

		// since we are forcing the lineheight to 1.1, we have to calculate a new, smaller ascent and descent
		let correctedAscent = Math.round(fontsize * 1.02)
		let correctedDescent = lineheight - correctedAscent
		correctedAscent = Math.round(lines[0].ascent)
		correctedDescent = lineheight - correctedAscent

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
		
		let col = rgbRev(color)
		this.context2d.fillStyle = `rgba(${col.r}, ${col.g}, ${col.b}, 1)`

		for (let l = 0; l <= lastFittingLine; l += 1) {
			const text = (new TextDecoder().decode(lines[l].text))
			if (fontsize < 12) { 
				let textPath = this.context2d.outlineText(text) // trick for disabling Antialiasing, but it also breaks support for some unicode
  			this.context2d.fill(textPath.offset(xAnchor, yAnchor))
			} else {
				this.context2d.fillText(text, xAnchor, yAnchor)
			}
			//this.horizontalLine(yAnchor - fontsize, rgb(255,0,255))
			//this.horizontalLine(yAnchor + correctedDescent, rgb(0, 255, 0))
			//this.horizontalLine(yAnchor - correctedAscent, rgb(0,0,255))
			//this.horizontalLine(yAnchor, rgb(255, 0, 0))
			console.log('Fontsize', fontsize, 'Lineheight', lineheight, 'asc', correctedAscent, 'des', correctedDescent, 'a+d', correctedAscent+correctedDescent);
			
			yAnchor += lineheight
		}
		
		this.lastUpdate = Date.now()
		return true
	}

	drawAlignedText_old(
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

		// breakup text in pieces
		let breakPos = [0]
		let lastBreakPos = null
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
				lastBreakPos = null
			} else if (displayText[i] === '\n') {
				lastBreakPos = i
				displayText = displayText.slice(0, lastBreakPos) + displayText.slice(lastBreakPos + 1)
				i--
				breakPos.push(lastBreakPos)
				lastBreakPos = null
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
				if (lastBreakPos !== null) {
					// if line is getting too long and there was a good wrap position, wrap it at that position
					if (displayText.charCodeAt(lastBreakPos) === 32) {
						// space
						// if the break position was a space we want to get rid of it
						displayText = displayText.slice(0, lastBreakPos) + displayText.slice(lastBreakPos + 1)
						i -= 2 // we dropped a char, and should recheck if the last char now fits
					} else {
						if (i - lastBreakPos > 0) lastBreakPos += 1 // if we can afford we want to have the breaking character in the top line, otherwise it gets wrapped (ugly, but better for space usage)
					}
					breakPos.push(lastBreakPos)
					lastBreakPos = null
				} else {
					breakPos.push(i) // if there has been no good break position, just wrap it anyway
					lastBreakPos = null
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
				var xSize = this.drawTextLine(
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
	 * @param {Buffer|string} buffer
	 * @param {'buffer'|'base64'|undefined} type 
	 */
	drawPixelBuffer(x, y, width, height, buffer, type = undefined) {
		if (type === undefined && typeof buffer == 'object' && buffer instanceof Buffer) {
			type = 'buffer'
		} else if (type === undefined && typeof buffer == 'string') {
			type = 'base64'
		}

		if (type === 'base64') {
			buffer = Buffer.from(buffer, 'base64')
		} else if (!Buffer.isBuffer(buffer) && buffer instanceof Uint8Array) {
			buffer = Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength)
		}

		if (buffer.length < width * height * 3) {
			throw new Error(
				'Pixelbuffer of ' + buffer.length + ' bytes is less than expected ' + width * height * 3 + ' bytes'
			)
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
			const rgb = new Uint8Array.from(buffer)

			for (let i = 0; i < rgb.length / 3; i += 1) {

				buffer[i * 4] = rgb[i * 3] // Red
				buffer[i * 4 + 1] = rgb[i * 3 + 1] // Green
				buffer[i * 4 + 2] = rgb[i * 3 + 2] // Blue
				buffer[i * 4 + 3] = 255 // Alpha
				
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

		// create HTML compatible imageData object
		let imageData
		try {
			imageData = new ImageData(buffer, imageWidth, imageHeight)
		} catch (error) {
			console.log('new ImageData failed', error);
		}

		// createImageBitmap() works async, so this intermediate canvas is a synchronous workaround
		const imageCanvas = new Canvas(imageData.width, imageData.height)
		const imageContext2d = imageCanvas.getContext('2d')
		imageContext2d.putImageData(imageData, 0, 0)

		this.context2d.drawImage(imageCanvas, x, y)
		this.lastUpdate = Date.now()
		
	}

	/**
	 * Draws a border around the button
	 * @param {number} depth width of the border 
	 * @param {number} color color of the border 
	 * @returns true if there is a visible border
	 */
	drawBorder(depth = 0, color) {
		if (depth <= 0) return false
		return this.boxLine(0, 0, this.width, this.height, color, depth, 'inside')
	}

	/**
	 * Draws a triangle in a corner
	 * @param {number} depth 
	 * @param {number} color 
	 * @param {'left'|'right'} halign 
	 * @param {'top'|'bottom'} valign 
	 * @returns 
	 */
	drawCornerTriangle(depth = 0, color, halign = 'left', valign = 'top') {
		if (depth == 0) return false
		let points

		if (halign == 'left' && valign == 'top') {
			points = [
				[0, 0],
				[depth, 0],
				[0, depth]
			]
		}
		if (halign == 'right' && valign == 'top') {
			points = [
				[this.width, 0],
				[this.width - depth, 0],
				[this.width, depth]
			]
		}
		if (halign == 'right' && valign == 'bottom') {
			points = [
				[this.width, this.height],
				[this.width - depth, this.height],
				[this.width, this.height - depth]
			]
		}
		if (halign == 'left' && valign == 'bottom') {
			points = [
				[0, this.height],
				[depth, this.height],
				[0, this.height - depth]
			]
		}
		return this.drawFilledPath(points, color)
	}

	/**
	 * Draws a filled path from some points
	 * @param {number[][]} pathPoints an array of x and y points
	 * @param {number} color color number
	 * @returns 
	 */
	drawFilledPath(pathPoints, color) {
		if (!Array.isArray(pathPoints) || pathPoints.length == 0) return false
		this.context2d.beginPath()
		const [firstPoint, ...points] = pathPoints
		this.context2d.moveTo(firstPoint[0], firstPoint[1])
		points.forEach(point => {
			this.context2d.lineTo(point[0], point[1])
		})

		let col = rgbRev(color)
		this.context2d.fillStyle = `rgba(${col.r}, ${col.g}, ${col.b}, 1)`
		this.context2d.fill()
		this.lastUpdate = Date.now()
	}

	toBase64() {
		return this.buffer().toString('base64')
	}

	buffer() {
		//return Buffer.concat(this.canvas)
		const buffer = new Buffer.from(this.context2d.getImageData(0, 0, this.width, this.height).data.filter((_elem, index) => { return (index + 1) % 4 }))
		return buffer
	}

	bufferAndTime() {
		return { updated: this.lastUpdate, buffer: this.buffer() }
	}

	static emptyAndTime() {
		return { updated: Date.now(), buffer: Buffer.alloc(72 * 72 * 3) }
	}
}

export default Image

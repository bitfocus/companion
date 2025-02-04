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

import { Canvas, ImageData, Image as CanvasImage, loadImage, SKRSContext2D } from '@napi-rs/canvas'
import LogController from '../Log/Controller.js'
import type { HorizontalAlignment, VerticalAlignment } from '../Resources/Util.js'

const DEFAULT_FONTS = [
	'Companion-sans',
	'Companion-symbols1',
	'Companion-symbols2',
	'Companion-symbols3',
	'Companion-symbols4',
	'Companion-symbols5',
	'Companion-symbols6',
	'Companion-gurmukhi',
	'Companion-simplified-chinese',
	'Companion-korean',
	'Companion-emoji',
].join(', ')

type LineOrientation = 'inside' | 'center' | 'outside'

/**
 * Class for generating an image and rendering some content to it
 */
export class Image {
	readonly #logger = LogController.createLogger('Graphics/Image')

	readonly canvas: Canvas
	readonly context2d: SKRSContext2D

	readonly width: number
	readonly height: number

	readonly realwidth: number
	readonly realheight: number

	/**
	 * Create an image
	 * @param width the width of the image in integer
	 * @param height the height of the image in integer
	 * @param oversampling a factor of how much more pixels the image should have in width and height
	 */
	constructor(width: number, height: number, oversampling: number) {
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
	 * @param color CSS color string
	 * @returns success
	 */
	fillColor(color: string): boolean {
		return this.box(0, 0, this.realwidth, this.realheight, color)
	}

	/**
	 * draws a line between two given points
	 * @param x1
	 * @param y1
	 * @param x2
	 * @param y2
	 * @param color CSS color string
	 * @param lineWidth
	 */
	line(x1: number, y1: number, x2: number, y2: number, color: string, lineWidth = 1): boolean {
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
	 * @param y
	 * @param color CSS color string
	 * @returns success
	 */
	horizontalLine(y: number, color: string): boolean {
		return this.line(0, y, this.width, y, color)
	}

	/**
	 * draws a vertical line at given distance from left
	 * @param x
	 * @param color CSS color string
	 * @returns success
	 */
	verticalLine(x: number, color: string): boolean {
		return this.line(x, 0, x, this.height, color)
	}

	/**
	 * draws a box with optional fill color and optional outline
	 * @param x1
	 * @param y1
	 * @param x2
	 * @param y2
	 * @param color CSS string fill color, unfilled if undefined
	 * @param strokeColor CSS string line color, no line if undefined
	 * @param lineWidth line width defaults to 1
	 * @param lineOrientation defaults to 'inside'
	 * @returns something has been drawn
	 */
	box(
		x1: number,
		y1: number,
		x2: number,
		y2: number,
		color?: string,
		strokeColor?: string,
		lineWidth = 1,
		lineOrientation: LineOrientation = 'inside'
	): boolean {
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
	 * @param x1 position of left edge
	 * @param y1 position of top edge
	 * @param x2 position of right edge
	 * @param y2 position of bottom edge
	 * @param color color string
	 * @param lineWidth line width
	 * @param  lineOrientation direction of lines in regard to the edges
	 * @returns returns true if a visible rectangle has been drawn
	 */
	boxLine(
		x1: number,
		y1: number,
		x2: number,
		y2: number,
		color: string,
		lineWidth = 1,
		lineOrientation: LineOrientation = 'inside'
	): boolean {
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
	 * @param data base64 encoded buffer with the raw PGN data
	 * @param xStart left position where to place the image
	 * @param yStart top position where to place the image
	 * @param width width of the bounding box where to place the image
	 * @param height height of the bounding box where to place the image
	 * @param halign horizontal alignment of the image in the bounding box (defaults to center)
	 * @param valign vertical alignment of the image in the bounding box (defaults to center)
	 * @param scale the size factor of the image. Number scales by specified amount, fill scales to fill the bounding box neglecting aspect ratio, crop scales to fill the bounding box and crop if necessary, fit scales to fit the bounding box with the longer side
	 */
	async drawFromPNGdata(
		data: Buffer,
		xStart = 0,
		yStart = 0,
		width = 72,
		height = 72,
		halign: HorizontalAlignment = 'center',
		valign: VerticalAlignment = 'center',
		scale: number | 'crop' | 'fill' | 'fit' | 'fit_or_shrink' = 1
	): Promise<void> {
		let png: CanvasImage | undefined

		try {
			png = await loadImage(data)
		} catch (e) {
			console.log('Error loading image', e)
			return
		}

		let imageWidth = png.width
		let imageHeight = png.height

		let calculatedScale = 1
		let scaledImageWidth = imageWidth
		let scaledImageHeight = imageHeight

		if (scale === 'fit_or_shrink') {
			if (imageWidth <= width && imageHeight <= height) {
				// If image is smaller than the button, don't scale it
				scale = 1
			} else {
				// Otherwise shrink to fit
				scale = 'fit'
			}
		}

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
			png,
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

	#sanitiseText(text: string | undefined): string {
		if (text === undefined) return ''

		// If there is a null character in the string, cut it off
		const nullIndex = text.indexOf('\0')
		if (nullIndex == -1) return text
		return text.substring(0, nullIndex)
	}

	/**
	 * draws a single line of left aligned text
	 * the line length is not wrapped or limited and may extend beyond the canvas
	 * @param x left position where to start the line
	 * @param y top position where to start the line
	 * @param text
	 * @param color CSS color string
	 * @param fontsize Em height
	 * @param dummy Don't actually draw anything just return the text width
	 * @returns width of the line
	 */
	drawTextLine(x: number, y: number, text: string, color: string, fontsize: number, dummy = false): number {
		text = this.#sanitiseText(text)

		if (text === undefined || text.length == 0) return 0

		if (isNaN(fontsize)) return 0
		if (fontsize < 3) return 0

		this.context2d.font = `${fontsize}px ${DEFAULT_FONTS}`

		const metrics = this.context2d.measureText(text)

		if (!dummy) {
			this.context2d.textAlign = 'left'
			this.context2d.fillStyle = color
			this.context2d.fillText(text, x, y + Math.round(metrics.fontBoundingBoxAscent))
		}

		return metrics.width
	}

	/**
	 * draws a single line of aligned text, doesn't care for line breaks or length
	 * @param x horizontal value of the alignment point
	 * @param y vertical value of the alignment point
	 * @param text
	 * @param color CSS color string
	 * @param fontsize Em height
	 * @param halignment defaults to 'center'
	 * @param valignment defaults to 'center'
	 * @returns the width of the line
	 */
	drawTextLineAligned(
		x: number,
		y: number,
		text: string,
		color: string,
		fontsize: number,
		halignment: HorizontalAlignment = 'center',
		valignment: VerticalAlignment = 'center'
	): number {
		text = this.#sanitiseText(text)

		if (text === undefined || text.length == 0) return 0
		if (halignment != 'left' && halignment != 'center' && halignment != 'right') halignment = 'left'

		this.context2d.font = `${fontsize}px ${DEFAULT_FONTS}`
		this.context2d.fillStyle = color
		this.context2d.textAlign = halignment

		const metrics = this.context2d.measureText(text)

		let vOffset = 0
		switch (valignment) {
			case 'top':
				vOffset = metrics.fontBoundingBoxAscent
				break

			case 'center':
				vOffset = metrics.fontBoundingBoxAscent / 2
				break

			case 'bottom':
				vOffset = metrics.fontBoundingBoxDescent * -1
				break
		}

		this.context2d.fillText(text, x, y + vOffset)

		return metrics.width
	}

	/**
	 * Draws aligned text in an boxed area.
	 * @param x bounding box top left horizontal value
	 * @param y bounding box top left vertical value
	 * @param w bounding box width
	 * @param h bounding box height
	 * @param text the text to draw
	 * @param color CSS color string
	 * @param fontsize height of font, either pixels or 'auto'
	 * @param halign horizontal alignment left, center, right
	 * @param valign vertical alignment top, center, bottom
	 * @param dummy don't actually draw anything if true, just return if the text fits
	 * @returns returns true if text fits
	 */
	drawAlignedText(
		x: number,
		y: number,
		w: number,
		h: number,
		text: string,
		color: string,
		fontsize: number | 'auto' = 'auto',
		halign: HorizontalAlignment = 'center',
		valign: VerticalAlignment = 'center',
		dummy = false
	): boolean {
		// let textFits = true
		let lineheight
		let fontheight

		text = this.#sanitiseText(text)

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

		lineheight = Math.floor(fontheight * 1.1) // this lineheight is not the real lineheight needed for the font, but it is calculated to match the existing font size / lineheight ratio of the bitmap fonts

		// breakup text in pieces
		let lines = []
		let breakPos = null

		//if (fontsize < 9) fontfamily = '7x5'
		this.context2d.font = `${fontheight}px/${lineheight}px ${DEFAULT_FONTS}`
		this.context2d.textWrap = false

		/**
		 * this is necessary to get unicode compatible substring where a codepoint can be more than one char
		 */
		const substring = (string: string, start: number, end: number): string => {
			const chars = [...string]
			if (!start) start = 0
			if (!end) end = chars.length
			return chars.slice(start, end).join('')
		}

		const findLastChar = (text: string): { ascent: number; descent: number; maxCodepoints: number } => {
			// skia-canvas built-in line break algorithm is poor
			let length = [...text].length
			//console.log('\nstart linecheck for', text, 'in width', w, 'chars', length)

			// let's check how far we off
			let measure = this.context2d.measureText(text)
			let diff = w - measure.width

			// if all fits we are done
			if (diff >= 0) {
				return {
					ascent: measure.fontBoundingBoxAscent,
					descent: measure.fontBoundingBoxDescent,
					maxCodepoints: length,
				}
			}

			// ok, we are not done. let's start with an assumption of how big one char is in average
			let nWidth = (w - diff) / length
			// how many chars fit probably in one line
			let chars = Math.round(w / nWidth)

			diff = w - this.context2d.measureText(substring(text, 0, chars)).width // check our guessed length

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
				if (diff == 0 || (diff < 0 && chars == 1)) {
					// perfect match or one char is too wide meaning we can't try less
					//console.log('line algo says perfect match with '+chars+' chars', substring(text, 0, chars));
					return {
						ascent: measure.fontBoundingBoxAscent,
						descent: measure.fontBoundingBoxDescent,
						maxCodepoints: chars,
					}
				} else if (diff > 0 && w - this.context2d.measureText(substring(text, 0, chars + 1)).width < 0) {
					// we are smaller and next char is too big
					//console.log('line algo says '+chars+' chars are smaller', substring(text, 0, chars), this.context2d.measureText(substring(text, 0, chars)).width);
					return {
						ascent: measure.fontBoundingBoxAscent,
						descent: measure.fontBoundingBoxDescent,
						maxCodepoints: chars,
					}
				} else if (diff < 0 && w - this.context2d.measureText(substring(text, 0, chars - 1)).width > 0) {
					// we are bigger and one less char fits
					//console.log('line algo says '+chars+' chars are bigger', substring(text, 0, chars-1), this.context2d.measureText(substring(text, 0, chars-1)).width);
					return {
						ascent: measure.fontBoundingBoxAscent,
						descent: measure.fontBoundingBoxDescent,
						maxCodepoints: chars - 1,
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
				ascent: measure.fontBoundingBoxAscent,
				descent: measure.fontBoundingBoxDescent,
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

			//console.log(`check text "${textArr.slice(lastDrawnByte).join('')}" arr=${textArr} length=${textArr.length - lastDrawnByte} max=${maxCodepoints}`)
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
				if (line.length === 0) {
					// line is somehow empty, try skipping a character
					lastDrawnByte += 1
					continue
				}

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
			this.context2d.fillText(text, xAnchor, yAnchor)

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
	 * @param x left position of insert point
	 * @param y top position of insert point
	 * @param width integer information of the width of the buffer
	 * @param height integer information of the height of the buffer
	 * @param bufferRaw
	 * @param format pixel format of the buffer, if known
	 * @param scale scaling factor
	 */
	drawPixelBuffer(
		x: number,
		y: number,
		width: number,
		height: number,
		bufferRaw: Buffer | Uint8Array | string,
		format?: 'RGB' | 'RGBA' | 'ARGB',
		scale?: number
	): void {
		let buffer: Buffer
		if (typeof bufferRaw == 'object') {
			if (bufferRaw instanceof Buffer) {
				buffer = bufferRaw
			} else if (bufferRaw instanceof Uint8Array) {
				buffer = Buffer.from(bufferRaw.buffer, bufferRaw.byteOffset, bufferRaw.byteLength)
			} else {
				this.#logger.error(`Pixelbuffer is of unknown type (${typeof bufferRaw})`)
				return
			}
		} else if (typeof bufferRaw == 'string') {
			buffer = Buffer.from(bufferRaw, 'base64')
		} else {
			this.#logger.error(`Pixelbuffer is of unknown type (${typeof bufferRaw})`)
			return
		}

		const rgbByteCount = width * height * 3
		const rgbaByteCount = width * height * 4

		if (format == 'RGB' && buffer.length !== rgbByteCount) {
			this.#logger.error(
				`Pixelbuffer of format ${format} with ${buffer.length} bytes is not expected ${rgbByteCount} bytes`
			)
			return
		} else if ((format == 'RGBA' || format == 'ARGB') && buffer.length !== rgbaByteCount) {
			this.#logger.error(
				`Pixelbuffer of format ${format} with ${buffer.length} bytes is not expected ${rgbaByteCount} bytes`
			)
			return
		} else if (!format && buffer.length < rgbByteCount) {
			this.#logger.error(`Pixelbuffer of ${buffer.length} bytes is not expected ${rgbByteCount} bytes`)
			return
		}

		if (buffer.length == rgbaByteCount && format === 'RGBA') {
			// Buffer is packed ok
		} else if (buffer.length == rgbaByteCount && (!format || format === 'ARGB')) {
			// ARGB: swap order from ARGB to RGBA
			for (let i = 0; i < buffer.length; i += 4) {
				let a = buffer[i]

				buffer[i] = buffer[i + 1]
				buffer[i + 1] = buffer[i + 2]
				buffer[i + 2] = buffer[i + 3]
				buffer[i + 3] = a
			}
		} else if (buffer.length == rgbByteCount) {
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
			this.#logger.error(
				`Pixelbuffer for a ${width}x${height} image should be either ${rgbByteCount} or ${
					rgbaByteCount
				} bytes big. Not ${buffer.length} (${format})`
			)
			return
		}

		// create HTML compatible imageData object
		let imageData: ImageData
		try {
			imageData = new ImageData(new Uint8ClampedArray(buffer), width, height)
		} catch (error: any) {
			this.#logger.error(`Can't draw pixel buffer, creating ImageData from buffer failed: ` + error.stack)
			return
		}

		// createImageBitmap() works async, so this intermediate canvas is a synchronous workaround
		const imageCanvas = new Canvas(imageData.width, imageData.height)
		const imageContext2d = imageCanvas.getContext('2d')
		imageContext2d.putImageData(imageData, 0, 0)

		if (!scale) scale = 1

		this.context2d.drawImage(imageCanvas, 0, 0, width, height, x, y, width * scale, height * scale)
	}

	/**
	 * Draws a border around the button
	 * @param depth width of the border
	 * @param color CSS color of the border
	 * @returns true if there is a visible border
	 */
	drawBorder(depth = 1, color = 'red'): boolean {
		if (depth <= 0) return false
		return this.boxLine(0, 0, this.width, this.height, color, depth, 'inside')
	}

	/**
	 * Draws a triangle in a corner
	 * @param depth
	 * @param color CSS color string
	 * @param halign defaults to 'left'
	 * @param valign defaults to 'top'
	 * @returns success
	 */
	drawCornerTriangle(
		depth: number,
		color: string,
		halign: HorizontalAlignment = 'left',
		valign: VerticalAlignment = 'top'
	): boolean {
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
	 * @param pathPoints an array of x and y points
	 * @param color CSS color
	 * @param lineWidth defaults to 1
	 * @param close if true close the path from last point to first point, if last and first point are identical path will be autoclosed
	 * @returns success
	 */
	drawPath(pathPoints: number[][], color: string, lineWidth = 1, close = false): boolean {
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
	 * @param pathPoints an array of x and y points
	 * @param color CSS color
	 * @returns success
	 */
	drawFilledPath(pathPoints: number[][], color: string): boolean {
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
	 * @returns RGBA buffer of the pixels
	 */
	buffer(): Buffer {
		const buffer = Buffer.from(this.context2d.getImageData(0, 0, this.realwidth, this.realheight).data)
		return buffer
	}

	/**
	 * returns the image as a data-url
	 */
	toDataURL(): Promise<string> {
		return this.canvas.toDataURLAsync('image/png')
	}

	/**
	 * returns the image as a data-url
	 */
	toDataURLSync(): string {
		return this.canvas.toDataURL('image/png')
	}
}

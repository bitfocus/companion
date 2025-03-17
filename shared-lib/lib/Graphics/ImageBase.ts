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

/// <reference lib="dom" />

import type { MinimalLogger } from '../Logger.js'
import type { HorizontalAlignment, VerticalAlignment } from './Util.js'
import { DEFAULT_FONTS_STR } from './Fonts.js'

export type LineOrientation = 'inside' | 'center' | 'outside'

export type PointXY = [x: number, y: number]

export interface LineStyle {
	/**
	 * Line color in CSS color string
	 */
	color: string
	/**
	 * Line width in pixels (defaults to 1)
	 */
	width?: number
}

/** Take a limited view of CompanionImageContext2D, based on what skia canvas supports */
export type CompanionImageContext2D = Omit<
	CanvasRenderingContext2D,
	'drawImage' | 'createPattern' | 'getTransform' | 'drawFocusIfNeeded' | 'scrollPathIntoView' | 'canvas'
>

/**
 * A simple image pool, to allow for using temporary images for compositing purposes
 * This should minimise GC pressure by reusing the same image object
 */
export abstract class ImagePoolBase<TImage extends ImageBase<any>> {
	#pool: TImage[] = []

	abstract createImage(): TImage

	usingImage<T>(fcn: (img: TImage) => T): T {
		let image = this.#pool.pop() || this.createImage()

		try {
			image.clear()

			return fcn(image)
		} finally {
			this.#pool.push(image)
		}
	}
}

/**
 * Class for generating an image and rendering some content to it
 */
export abstract class ImageBase<TDrawImageType extends { width: number; height: number }> {
	protected readonly logger: MinimalLogger

	readonly #imagePool: ImagePoolBase<ImageBase<TDrawImageType>>

	protected readonly context2d: CompanionImageContext2D

	readonly width: number
	readonly height: number

	/**
	 * Get the canvas image object, so that it can be drawn to another ImageBase instance
	 */
	protected abstract get canvasImage(): TDrawImageType

	/**
	 * Create an image
	 * @param width the width of the image in integer
	 * @param height the height of the image in integer
	 * @param oversampling a factor of how much more pixels the image should have in width and height
	 */
	protected constructor(
		logger: MinimalLogger,
		pool: ImagePoolBase<ImageBase<TDrawImageType>>,
		context2d: CompanionImageContext2D,
		width: number,
		height: number
	) {
		this.logger = logger

		this.#imagePool = pool

		this.width = width
		this.height = height

		this.context2d = context2d
	}

	/**
	 * Draw to a temporary image layer, before compositing it to the main image with a given alpha
	 * This allows for complex drawing sequences to be flattened with the correct combined alpha
	 */
	async usingTemporaryLayer(
		compositeAlpha: number,
		fcn: (img: ImageBase<TDrawImageType>) => Promise<void>
	): Promise<void> {
		return this.#imagePool.usingImage(async (img) => {
			await fcn(img)

			await this.usingAlpha(compositeAlpha, async () => {
				this.drawImage(img.canvasImage, 0, 0, img.width, img.height, 0, 0, this.width, this.height)
			})
		})
	}

	/**
	 * Perform some drawing with a given alpha.
	 * Note: This affects the whole canvas drawing operations, it should contain a single operation otherwise the composition of each draw will not correctly combine colours
	 */
	async usingAlpha(alpha: number, fcn: () => Promise<void>): Promise<void> {
		const oldAlpha = this.context2d.globalAlpha
		this.context2d.globalAlpha = alpha

		try {
			await fcn()
		} finally {
			this.context2d.globalAlpha = oldAlpha
		}
	}

	/**
	 * Clear the image, resetting to a fully transparent and empty state
	 */
	clear(): void {
		this.context2d.clearRect(0, 0, this.width, this.height)
	}

	/**
	 * Draw an image loaded with one of the load abstract load functions
	 */
	protected abstract drawImage(
		image: TDrawImageType,
		sx: number,
		sy: number,
		sw: number,
		sh: number,
		dx: number,
		dy: number,
		dw: number,
		dh: number
	): void

	/**
	 * Load an image from a base64 string
	 * This will later be drawn with drawImage
	 */
	protected abstract loadBase64Image(base64Image: string): Promise<TDrawImageType>

	/**
	 * Prepare a pixel buffer for drawing
	 * This will later be drawn with drawImage
	 */
	protected abstract loadPixelBuffer(data: Uint8Array, width: number, height: number): TDrawImageType | null

	/**
	 * fills the whole image with a color
	 * @param color CSS color string
	 * @returns success
	 */
	fillColor(color: string): boolean {
		return this.box(0, 0, this.width, this.height, color)
	}

	/**
	 * draws a line between two given points
	 */
	line(x1: number, y1: number, x2: number, y2: number, style: LineStyle): void {
		this.context2d.lineWidth = style.width ?? 1
		this.context2d.strokeStyle = style.color
		this.context2d.beginPath()
		this.context2d.moveTo(x1, y1)
		this.context2d.lineTo(x2, y2)
		this.context2d.closePath()
		this.context2d.stroke()
	}

	/**
	 * draws a horizontal line at given height from top
	 */
	horizontalLine(y: number, style: LineStyle): void {
		return this.line(0, y, this.width, y, style)
	}

	/**
	 * draws a vertical line at given distance from left
	 * @returns success
	 */
	verticalLine(x: number, style: LineStyle): void {
		return this.line(x, 0, x, this.height, style)
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
		fillColor?: string,
		lineStyle?: LineStyle,
		lineOrientation: LineOrientation = 'inside'
	): boolean {
		if (x2 == x1 || y2 == y1) return false
		let didDraw = false
		if (fillColor) {
			this.context2d.fillStyle = fillColor
			this.context2d.fillRect(x1, y1, x2 - x1, y2 - y1)
			didDraw = true
		}
		if (lineStyle) {
			didDraw = didDraw || this.boxLine(x1, y1, x2, y2, lineStyle, lineOrientation)
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
		lineStyle: LineStyle,
		lineOrientation: LineOrientation = 'inside'
	): boolean {
		const lineWidth = lineStyle.width ?? 1
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
		this.context2d.strokeStyle = lineStyle.color
		this.context2d.strokeRect(x1, y1, x2 - x1, y2 - y1)

		return true
	}

	/**
	 * Draws an image to the canvas from a buffer
	 * the image can be fitted and cropped to the canvas in many variations
	 * @param data buffer with the raw image data
	 * @param xStart left position where to place the image
	 * @param yStart top position where to place the image
	 * @param width width of the bounding box where to place the image
	 * @param height height of the bounding box where to place the image
	 * @param halign horizontal alignment of the image in the bounding box (defaults to center)
	 * @param valign vertical alignment of the image in the bounding box (defaults to center)
	 * @param scale the size factor of the image. Number scales by specified amount, fill scales to fill the bounding box neglecting aspect ratio, crop scales to fill the bounding box and crop if necessary, fit scales to fit the bounding box with the longer side
	 */
	async drawBase64Image(
		base64Image: string,
		xStart = 0,
		yStart = 0,
		width = 72,
		height = 72,
		halign: HorizontalAlignment = 'center',
		valign: VerticalAlignment = 'center',
		scale: number | 'crop' | 'fill' | 'fit' | 'fit_or_shrink' = 1
	): Promise<void> {
		let canvasImage: TDrawImageType | undefined

		try {
			canvasImage = await this.loadBase64Image(base64Image)
		} catch (e) {
			console.log('Error loading image', e)
			return
		}

		let imageWidth = canvasImage.width
		let imageHeight = canvasImage.height

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

		this.drawImage(
			canvasImage,
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

		this.context2d.font = `${fontsize}px ${DEFAULT_FONTS_STR}`

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

		this.context2d.font = `${fontsize}px ${DEFAULT_FONTS_STR}`
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
		valign: VerticalAlignment = 'center'
	): boolean {
		let displayTextStr = this.#sanitiseText(text).toString().trim() // remove leading and trailing spaces for display
		if (!displayTextStr) return true

		displayTextStr = displayTextStr.replaceAll('\r\n', '\n') // we only want \n as a linebreak
		displayTextStr = displayTextStr.replaceAll('\\n', '\n') // users can add deliberate line breaks, let's replace it with a real line break
		displayTextStr = displayTextStr.replaceAll('\\r', '\n') // users can add deliberate line breaks, let's replace it with a real line break
		displayTextStr = displayTextStr.replaceAll('\\t', '\t') // users can add deliberate tabs, let's replace it with a real tab

		// Split the input into an array of unicode characters, where each can be formed of multiple codepoints
		const displayTextChars: string[] = [...new Intl.Segmenter().segment(displayTextStr)]
			.slice(0, (w * h) / 2) // limit the number of characters to an overestimate of what would fit at 1px per character (assuming chars are 2px tall)
			.map((segment) => segment.segment)

		// validate the fontSize
		let fontheight = Number(fontsize)
		if (isNaN(fontheight)) {
			fontsize = 'auto'
		} else if (fontheight < 3) {
			// block out some tiny fontsizes
			fontheight = 3
		} else if (fontheight > this.height) {
			// block out some giant fontsizes
			fontheight = this.height
		}

		// get needed fontsize
		if (fontsize === 'auto') {
			let len = displayTextStr.length
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
					(size) =>
						this.#drawAlignedTextCharsAtSize(x, y, w, h, displayTextChars, color, size, halign, valign, true) === true
				) ?? 6
		}

		return this.#drawAlignedTextCharsAtSize(x, y, w, h, displayTextChars, color, fontheight, halign, valign, false)
	}

	/**
	 * Draws aligned text in an boxed area.
	 * Internals of 'drawAlignedText' after resolving the fontsize
	 */
	#drawAlignedTextCharsAtSize(
		x: number,
		y: number,
		w: number,
		h: number,
		displayTextChars: string[],
		color: string,
		fontheight: number,
		halign: HorizontalAlignment,
		valign: VerticalAlignment,
		dummy: boolean
	): boolean {
		// breakup text in pieces
		let lines: { textChars: string[]; ascent: number; descent: number }[] = []
		let breakPos: number | null = null

		//if (fontsize < 9) fontfamily = '7x5'
		const fontLineHeight = Math.floor(fontheight * 1.1) // this lineheight is not the real lineheight needed for the font, but it is calculated to match the existing font size / lineheight ratio of the bitmap fonts
		this.context2d.font = `${fontheight}px/${fontLineHeight}px ${DEFAULT_FONTS_STR}`
		// this.context2d.textWrap = false

		// Measure the line height with a consistent string, to avoid issues with emoji being too tall
		const lineHeightSample = this.context2d.measureText('A')
		const measuredLineHeight = lineHeightSample.fontBoundingBoxAscent + lineHeightSample.fontBoundingBoxDescent

		const findLastChar = (textChars: string[]): { ascent: number; descent: number; maxCodepoints: number } => {
			// skia-canvas built-in line break algorithm is poor
			let length = textChars.length
			//console.log('\nstart linecheck for', text, 'in width', w, 'chars', length)

			// let's check how far we off
			let measure = this.context2d.measureText(textChars.join(''))
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

			diff = w - this.context2d.measureText(textChars.slice(0, chars).join('')).width // check our guessed length

			if (Math.abs(diff) > nWidth) {
				// we seem to be off by more than one char
				// what is the needed difference in chars
				let chardiff = Math.round(diff / nWidth)
				let lastCheckedChars = 0

				while (Math.abs(chars - lastCheckedChars) > 1) {
					chars += chardiff // apply assumed difference
					diff = w - this.context2d.measureText(textChars.slice(0, chars).join('')).width
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
				} else if (diff > 0 && w - this.context2d.measureText(textChars.slice(0, chars + 1).join('')).width < 0) {
					// we are smaller and next char is too big
					//console.log('line algo says '+chars+' chars are smaller', substring(text, 0, chars), this.context2d.measureText(substring(text, 0, chars)).width);
					return {
						ascent: measure.fontBoundingBoxAscent,
						descent: measure.fontBoundingBoxDescent,
						maxCodepoints: chars,
					}
				} else if (diff < 0 && w - this.context2d.measureText(textChars.slice(0, chars - 1).join('')).width > 0) {
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
					diff = w - this.context2d.measureText(textChars.slice(0, chars).join('')).width
				}
			}

			//console.log('line algo failed', chars);
			return {
				ascent: measure.fontBoundingBoxAscent,
				descent: measure.fontBoundingBoxDescent,
				maxCodepoints: length,
			}
		}

		// const textArr = [...displayText]
		let lastDrawnCharCount = 0
		while (lastDrawnCharCount < displayTextChars.length) {
			if (lines.length * measuredLineHeight >= h) {
				// Stop chunking once we have filled the full button height
				break
			}

			// get rid of one space at line start, but keep more spaces
			if (displayTextChars[lastDrawnCharCount] == ' ') {
				lastDrawnCharCount += 1
			}

			// check if remaining text fits in line
			const maxCharsPerLine = w // Limit how many characters we attempt to draw per line
			let { maxCodepoints, ascent, descent } = findLastChar(
				displayTextChars.slice(lastDrawnCharCount, lastDrawnCharCount + maxCharsPerLine)
			)

			//console.log(`check text "${textArr.slice(lastDrawnByte).join('')}" arr=${textArr} length=${textArr.length - lastDrawnByte} max=${maxCodepoints}`)
			if (maxCodepoints >= displayTextChars.length - lastDrawnCharCount) {
				let buf: string[] = []
				for (let i = lastDrawnCharCount; i < displayTextChars.length; i += 1) {
					if (displayTextChars[i].codePointAt(0) === 10) {
						lines.push({ textChars: buf, ascent, descent })
						buf = []
					} else {
						buf.push(displayTextChars[i])
					}
				}
				lines.push({ textChars: buf, ascent, descent })
				lastDrawnCharCount = displayTextChars.length
			} else {
				let line = displayTextChars.slice(lastDrawnCharCount, lastDrawnCharCount + maxCodepoints)
				if (line.length === 0) {
					// line is somehow empty, try skipping a character
					lastDrawnCharCount += 1
					continue
				}

				//lets look for a newline
				const newlinePos = line.indexOf(String.fromCharCode(10))
				if (newlinePos >= 0) {
					lines.push({
						textChars: line.slice(0, newlinePos),
						ascent,
						descent,
					})
					lastDrawnCharCount += newlinePos + 1
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

				// get rid of a breaking space at end
				const lineText = line.slice(0, breakPos + (line[breakPos] === ' ' ? 0 : 1))
				lines.push({
					textChars: lineText,
					ascent,
					descent,
				})

				lastDrawnCharCount += breakPos + 1
			}
		}
		//console.log('we got the break', text, lines.map(line => byteToString(line.text)))

		// now that we know the number of lines, we can check if the text fits vertically
		// the following function would be the real calculation if we would not force lineheight to 1.1x   let totalHeight = lines[0].ascent + lines[lines.length - 1].descent + (lines.length > 0 ? (lines.length - 1 ) * lineheight : 0 )
		if (lines.length < 1) return false
		// lineheight = lines[0].ascent + lines[0].descent
		if (dummy) {
			return lines.length * measuredLineHeight <= h
		}

		if (lines.length * measuredLineHeight >= h) {
			// If the text is too tall, we need to drop the last line
			lines.splice(lines.length - 1, 1)
		}

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
				xAnchor = x + w / 2
				break
			case 'right':
				this.context2d.textAlign = 'right'
				xAnchor = x + w
				break
		}

		const linesTotalHeight = lines.length * measuredLineHeight
		let yAnchor = 0
		switch (valign) {
			case 'top':
				yAnchor = correctedAscent
				break
			case 'center':
				yAnchor = Math.round((h - linesTotalHeight) / 2 + correctedAscent)
				break
			case 'bottom':
				yAnchor = h - linesTotalHeight + correctedAscent
				break
		}
		yAnchor += y

		this.context2d.fillStyle = color

		for (const line of lines) {
			const text = line.textChars.join('')
			this.context2d.fillText(text, xAnchor, yAnchor)

			//this.horizontalLine(yAnchor - fontsize, 'rgb(255,0,255)')
			//this.horizontalLine(yAnchor + correctedDescent, 'rgb(0, 255, 0)')
			//this.horizontalLine(yAnchor - correctedAscent, ''''rgb(0,0,255)')
			//this.horizontalLine(yAnchor, 'rgb(255, 0, 0)')
			//console.log('Fontsize', fontsize, 'Lineheight', lineheight, 'asc', correctedAscent, 'des', correctedDescent, 'a+d', correctedAscent+correctedDescent);

			yAnchor += measuredLineHeight
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
		bufferRaw: Uint8Array | string,
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
				this.logger.error(`Pixelbuffer is of unknown type (${typeof bufferRaw})`)
				return
			}
		} else if (typeof bufferRaw == 'string') {
			buffer = Buffer.from(bufferRaw, 'base64')
		} else {
			this.logger.error(`Pixelbuffer is of unknown type (${typeof bufferRaw})`)
			return
		}

		const rgbByteCount = width * height * 3
		const rgbaByteCount = width * height * 4

		if (format == 'RGB' && buffer.length !== rgbByteCount) {
			this.logger.error(
				`Pixelbuffer of format ${format} with ${buffer.length} bytes is not expected ${rgbByteCount} bytes`
			)
			return
		} else if ((format == 'RGBA' || format == 'ARGB') && buffer.length !== rgbaByteCount) {
			this.logger.error(
				`Pixelbuffer of format ${format} with ${buffer.length} bytes is not expected ${rgbaByteCount} bytes`
			)
			return
		} else if (!format && buffer.length < rgbByteCount) {
			this.logger.error(`Pixelbuffer of ${buffer.length} bytes is not expected ${rgbByteCount} bytes`)
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
			this.logger.error(
				`Pixelbuffer for a ${width}x${height} image should be either ${rgbByteCount} or ${
					rgbaByteCount
				} bytes big. Not ${buffer.length} (${format})`
			)
			return
		}

		// create HTML compatible imageData object
		const imageCanvas = this.loadPixelBuffer(buffer, width, height)
		if (!imageCanvas) return

		if (!scale) scale = 1

		this.drawImage(imageCanvas, 0, 0, width, height, x, y, width * scale, height * scale)
	}

	/**
	 * Draws a border around the button
	 * @param depth width of the border
	 * @param color CSS color of the border
	 * @returns true if there is a visible border
	 */
	drawBorder(depth = 1, color = 'red'): boolean {
		if (depth <= 0) return false
		return this.boxLine(0, 0, this.width, this.height, { color, width: depth }, 'inside')
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
		let points: PointXY[] | undefined

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
	drawPath(pathPoints: PointXY[], lineStyle: LineStyle, close = false): boolean {
		const lineWidth = lineStyle.width ?? 1

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

		this.context2d.strokeStyle = lineStyle.color
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
	drawFilledPath(pathPoints: PointXY[], color: string): boolean {
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
}

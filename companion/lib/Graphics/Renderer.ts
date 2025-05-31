/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 */

import { Image } from './Image.js'
import { formatLocation } from '@companion-app/shared/ControlId.js'
import { ImageResult, ImageResultProcessedStyle } from './ImageResult.js'
import { DrawBounds, type GraphicsOptions, ParseAlignment, parseColor } from '@companion-app/shared/Graphics/Util.js'
import type { DrawStyleButtonModel, DrawStyleModel } from '@companion-app/shared/Model/StyleModel.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { GraphicsLayeredButtonRenderer } from '@companion-app/shared/Graphics/LayeredRenderer.js'
import { TopbarRenderer } from '@companion-app/shared/Graphics/TopbarRenderer.js'
import { isPromise } from 'util/types'
import type { Complete } from '@companion-module/base/dist/util.js'
import { GraphicsLayeredProcessedStyleGenerator } from './LayeredProcessedStyleGenerator.js'

const colorButtonYellow = 'rgb(255, 198, 0)'
const colorWhite = 'white'
const colorDarkGrey = 'rgba(15, 15, 15, 1)'

const emptySet: ReadonlySet<string> = new Set()

export class GraphicsRenderer {
	static TOPBAR_BOUNDS = new DrawBounds(0, 0, 72, TopbarRenderer.DEFAULT_HEIGHT)

	static #IMAGE_CACHE = new Map<string, Image[]>()

	/**
	 * Get a cached Image instance.
	 * Note: This assumes that the image is modified sync
	 */
	static #getCachedImage<T>(width: number, height: number, oversampling: number, fcn: (image: Image) => T): T {
		const key = `${width}x${height}x${oversampling}`

		let pool = GraphicsRenderer.#IMAGE_CACHE.get(key)
		if (!pool) {
			pool = []
			GraphicsRenderer.#IMAGE_CACHE.set(key, pool)
		}

		const img = pool.pop() || Image.create(width, height, oversampling)
		img.clear()

		const res = fcn(img)
		if (isPromise(res)) {
			res.finally(() => {
				pool.push(img)
			})
			return res
		} else {
			pool.push(img)
			return res
		}
	}

	/**
	 * Draw the image for an empty button
	 */
	static drawBlank(options: GraphicsOptions, location: ControlLocation): ImageResult {
		// let now = performance.now()
		// console.log('starting drawBlank ' + now, 'time elapsed since last start ' + (now - lastDraw))
		// lastDraw = now
		// console.time('drawBlankImage')
		return GraphicsRenderer.#getCachedImage(72, 72, 2, (img) => {
			img.fillColor('black')

			if (!options.remove_topbar) {
				img.drawTextLine(2, 3, formatLocation(location), 'rgb(50, 50, 50)', 8)
				img.horizontalLine(13.5, { color: 'rgb(30, 30, 30)' })
			}
			// console.timeEnd('drawBlankImage')
			return new ImageResult(img.buffer(), img.realwidth, img.realheight, img.toDataURLSync(), { type: 'button' })
		})
	}

	static wrapDrawButtonImage(
		buffer: Buffer,
		width: number,
		height: number,
		dataUrl: string,
		processedStyle: ImageResultProcessedStyle
	): ImageResult {
		return new ImageResult(buffer, width, height, dataUrl, processedStyle)
	}

	/**
	 * Draw the image for a btuton
	 */
	static async drawButtonImageUnwrapped(
		options: GraphicsOptions,
		drawStyle: DrawStyleModel,
		location: ControlLocation | undefined,
		pagename: string | undefined
	): Promise<{
		buffer: Buffer
		width: number
		height: number
		dataUrl: string
		processedStyle: ImageResultProcessedStyle
	}> {
		// console.log('starting drawButtonImage '+ performance.now())
		// console.time('drawButtonImage')
		return GraphicsRenderer.#getCachedImage(72, 72, 4, async (img) => {
			let processedStyle: ImageResultProcessedStyle

			// special button types
			if (drawStyle.style == 'pageup') {
				processedStyle = { type: 'pageup' }

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
						{ color: colorWhite, width: 2 }
					) // Arrow up path
				}

				img.drawTextLineAligned(36, 39, 'UP', colorButtonYellow, 10, 'center', 'top')
			} else if (drawStyle.style == 'pagedown') {
				processedStyle = { type: 'pagedown' }

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
						{ color: colorWhite, width: 2 }
					) // Arrow down path
				}

				img.drawTextLineAligned(36, 23, 'DOWN', colorButtonYellow, 10, 'center', 'top')
			} else if (drawStyle.style == 'pagenum') {
				processedStyle = { type: 'pagenum' }

				img.fillColor(colorDarkGrey)

				if (location === undefined) {
					// Preview (no location)
					img.drawTextLineAligned(36, 18, 'PAGE', colorButtonYellow, 10, 'center', 'top')
					img.drawTextLineAligned(36, 32, 'x', colorWhite, 18, 'center', 'top')
				} else if (!pagename || pagename.toLowerCase() == 'page') {
					img.drawTextLine(23, 18, 'PAGE', colorButtonYellow, 10)
					img.drawTextLineAligned(36, 32, '' + location.pageNumber, colorWhite, 18, 'center', 'top')
				} else {
					img.drawAlignedText(0, 0, 72, 72, pagename, colorWhite, 18, 'center', 'center')
				}
			} else if (drawStyle.style === 'button') {
				processedStyle = {
					type: 'button',
					color: {
						color: drawStyle.bgcolor,
					},
					text: {
						text: drawStyle.text,
						color: drawStyle.color,
						size: Number(drawStyle.size) || 'auto',
					},
					state: {
						pushed: drawStyle.pushed,
						cloud: drawStyle.cloud || false,
					},
				} satisfies Complete<ImageResultProcessedStyle>

				await GraphicsRenderer.#drawButtonMain(img, options, drawStyle, location)
			} else if (drawStyle.style === 'button-layered') {
				processedStyle = GraphicsLayeredProcessedStyleGenerator.Generate(drawStyle)

				await GraphicsLayeredButtonRenderer.draw(img, options, drawStyle, location, emptySet, null, {
					x: 0,
					y: 0,
				})
			} else {
				processedStyle = {
					type: 'button', // Default to button style
				}
			}

			// console.timeEnd('drawButtonImage')
			return {
				buffer: img.buffer(),
				width: img.realwidth,
				height: img.realheight,
				dataUrl: img.toDataURLSync(),
				processedStyle,
			}
		})
	}

	/**
	 * Draw the main button
	 */
	static async #drawButtonMain(
		img: Image,
		options: GraphicsOptions,
		drawStyle: DrawStyleButtonModel,
		location: ControlLocation | undefined
	): Promise<void> {
		let showTopbar = !!drawStyle.show_topbar
		if (drawStyle.show_topbar === 'default' || drawStyle.show_topbar === undefined) {
			showTopbar = !options.remove_topbar
		}

		// handle upgrade from pre alignment-support configuration
		if (drawStyle.alignment === undefined) {
			drawStyle.alignment = 'center:center'
		}
		if (drawStyle.pngalignment === undefined) {
			drawStyle.pngalignment = 'center:center'
		}

		// Draw background color first
		!showTopbar
			? img.box(0, 0, 72, 72, parseColor(drawStyle.bgcolor))
			: img.box(0, 14, 72, 72, parseColor(drawStyle.bgcolor))

		// Draw background PNG if exists
		if (drawStyle.png64 !== undefined && drawStyle.png64 !== null) {
			try {
				const [halign, valign] = ParseAlignment(drawStyle.pngalignment)

				!showTopbar
					? await img.drawBase64Image(drawStyle.png64, 0, 0, 72, 72, halign, valign, 'fit_or_shrink')
					: await img.drawBase64Image(drawStyle.png64, 0, 14, 72, 58, halign, valign, 'fit_or_shrink')
			} catch (e) {
				console.error('error drawing image:', e)
				img.box(0, 14, 71, 57, 'black')
				!showTopbar
					? img.drawAlignedText(2, 2, 68, 68, 'PNG ERROR', 'red', 10, 'center', 'center')
					: img.drawAlignedText(2, 18, 68, 52, 'PNG ERROR', 'red', 10, 'center', 'center')

				if (showTopbar) TopbarRenderer.draw(img, drawStyle, location, GraphicsRenderer.TOPBAR_BOUNDS)
				return
			}
		}

		// Draw images from feedbacks
		try {
			for (const image of drawStyle.imageBuffers || []) {
				if (image.buffer) {
					const yOffset = showTopbar ? 14 : 0

					const x = image.x ?? 0
					const y = yOffset + (image.y ?? 0)
					const width = image.width || 72
					const height = image.height || 72 - yOffset

					img.drawPixelBuffer(x, y, width, height, image.buffer, image.pixelFormat, image.drawScale)
				}
			}
		} catch (e) {
			img.fillColor('black')
			!showTopbar
				? img.drawAlignedText(2, 2, 68, 68, 'IMAGE\\nDRAW\\nERROR', 'red', 10, 'center', 'center')
				: img.drawAlignedText(2, 18, 68, 52, 'IMAGE\\nDRAW\\nERROR', 'red', 10, 'center', 'center')

			if (showTopbar) TopbarRenderer.draw(img, drawStyle, location, GraphicsRenderer.TOPBAR_BOUNDS)
			return
		}

		// Draw button text
		const [halign, valign] = ParseAlignment(drawStyle.alignment)

		let fontSize: 'auto' | number = 'auto'
		if ((drawStyle.size as any) == 'small') {
			fontSize = 7 // compatibility with v1 database
		} else if ((drawStyle.size as any) == 'large') {
			fontSize = 14 // compatibility with v1 database
		} else {
			fontSize = Number(drawStyle.size) || 'auto'
		}

		if (!showTopbar) {
			img.drawAlignedText(2, 1, 68, 70, drawStyle.text, parseColor(drawStyle.color), fontSize, halign, valign)
		} else {
			img.drawAlignedText(2, 15, 68, 57, drawStyle.text, parseColor(drawStyle.color), fontSize, halign, valign)
		}

		// At last draw Topbar on top
		if (showTopbar) TopbarRenderer.draw(img, drawStyle, location, GraphicsRenderer.TOPBAR_BOUNDS)
	}

	/**
	 * Draw pincode entry button for given number
	 * @param num Display number
	 */
	static drawPincodeNumber(num: number): ImageResult {
		return GraphicsRenderer.#getCachedImage(72, 72, 3, (img) => {
			img.fillColor(colorDarkGrey)
			img.drawTextLineAligned(36, 36, `${num}`, colorWhite, 44, 'center', 'center')
			return new ImageResult(img.buffer(), img.realwidth, img.realheight, img.toDataURLSync(), { type: 'button' })
		})
	}

	/**
	 * Draw pincode entry button
	 */
	static drawPincodeEntry(code: string | undefined): ImageResult {
		return GraphicsRenderer.#getCachedImage(72, 72, 4, (img) => {
			img.fillColor(colorDarkGrey)
			img.drawTextLineAligned(36, 30, 'Lockout', colorButtonYellow, 14, 'center', 'center')
			if (code !== undefined) {
				img.drawAlignedText(0, 15, 72, 72, code.replace(/[a-z0-9]/gi, '*'), colorWhite, 18, 'center', 'center')
			}

			return new ImageResult(img.buffer(), img.realwidth, img.realheight, img.toDataURLSync(), { type: 'button' })
		})
	}
}

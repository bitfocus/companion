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
import { ButtonDecorationRenderer } from '@companion-app/shared/Graphics/ButtonDecorationRenderer.js'
import { isPromise } from 'util/types'
import type { Complete } from '@companion-module/base/dist/util.js'
import { GraphicsLayeredProcessedStyleGenerator } from './LayeredProcessedStyleGenerator.js'
import { GraphicsLockingGenerator } from './Locking.js'
import { rotateResolution, transformButtonImage } from '../Resources/Util.js'
import { SurfaceRotation } from '@companion-app/shared/Model/Surfaces.js'
import type imageRs from '@julusian/image-rs'

const colorButtonYellow = 'rgb(255, 198, 0)'
const colorWhite = 'white'
const colorDarkGrey = 'rgba(15, 15, 15, 1)'

const emptySet: ReadonlySet<string> = new Set()

export class GraphicsRenderer {
	static TOPBAR_BOUNDS = new DrawBounds(0, 0, 72, ButtonDecorationRenderer.DEFAULT_HEIGHT)

	static #IMAGE_CACHE = new Map<string, Image[]>()

	static calculateTransforms(resolution: { width: number; height: number }) {
		// Calculate some constants for drawing without reinventing the numbers
		const drawScale = Math.min(resolution.width, resolution.height) / 72
		const xOffset = (resolution.width - 72 * drawScale) / 2
		const yOffset = (resolution.height - 72 * drawScale) / 2
		const transformX = (x: number): number => xOffset + x * drawScale
		const transformY = (y: number): number => yOffset + y * drawScale

		return {
			drawScale,
			transformX,
			transformY,
		}
	}

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
	static drawBlank(
		resolution: { width: number; height: number },
		options: GraphicsOptions,
		location: ControlLocation
	): ImageResult {
		// let now = performance.now()
		// console.log('starting drawBlank ' + now, 'time elapsed since last start ' + (now - lastDraw))
		// lastDraw = now
		// console.time('drawBlankImage')

		return GraphicsRenderer.#getCachedImage(resolution.width, resolution.height, 2, (img) => {
			// console.timeEnd('drawBlankImage')
			GraphicsRenderer.#drawBlankImage(img, options, location)

			return new ImageResult(img.toDataURLSync(), { type: 'button' }, async (width, height, rotation, format) => {
				const dimensions = rotateResolution(width, height, rotation)
				return GraphicsRenderer.#getCachedImage(dimensions[0], dimensions[1], 4, (img) => {
					GraphicsRenderer.#drawBlankImage(img, options, location)

					return this.#RotateAndConvertImage(img, width, height, rotation, format)
				})
			})
		})
	}

	static #drawBlankImage(img: Image, options: GraphicsOptions, location: ControlLocation) {
		// Calculate some constants for drawing without reinventing the numbers
		const { drawScale, transformX } = GraphicsRenderer.calculateTransforms(img)

		img.fillColor('black')

		if (!options.remove_topbar) {
			img.drawTextLine(transformX(2), 3 * drawScale, formatLocation(location), 'rgb(50, 50, 50)', 8 * drawScale)
			img.horizontalLine(13.5 * drawScale, { color: 'rgb(30, 30, 30)', width: 1 })
		}
	}

	/**
	 * Draw the image for a btuton
	 */
	static async drawButtonBareImageUnwrapped(
		options: GraphicsOptions,
		drawStyle: DrawStyleModel,
		location: ControlLocation | undefined,
		pagename: string | undefined,
		resolution: { width: number; height: number; oversampling: number },
		rotation: SurfaceRotation | null,
		format: imageRs.PixelFormat
	): Promise<Uint8Array> {
		// Force old 'button' style to be drawn at 72px, and scaled at the end
		const dimensions =
			drawStyle.style === 'button' ? [72, 72] : rotateResolution(resolution.width, resolution.height, rotation)

		const { buffer, width, height } = await GraphicsRenderer.#getCachedImage(
			dimensions[0],
			dimensions[1],
			resolution.oversampling,
			async (img) => {
				await GraphicsRenderer.#drawButtonImageInternal(img, options, drawStyle, location, pagename, {
					width: dimensions[0],
					height: dimensions[1],
				})

				return {
					buffer: img.buffer(),
					width: img.realwidth,
					height: img.realheight,
				}
			}
		)

		return transformButtonImage(buffer, width, height, rotation, resolution.width, resolution.height, format)
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
		dataUrl: string
		processedStyle: ImageResultProcessedStyle
	}> {
		return GraphicsRenderer.#getCachedImage(72, 72, 4, async (img) => {
			const processedStyle = await GraphicsRenderer.#drawButtonImageInternal(
				img,
				options,
				drawStyle,
				location,
				pagename,
				{
					width: 72,
					height: 72,
				}
			)

			return {
				dataUrl: img.toDataURLSync(),
				processedStyle,
			}
		})
	}

	/**
	 * Draw the image for a btuton
	 */
	static async #drawButtonImageInternal(
		img: Image,
		options: GraphicsOptions,
		drawStyle: DrawStyleModel,
		location: ControlLocation | undefined,
		pagename: string | undefined,
		resolution: { width: number; height: number }
	): Promise<ImageResultProcessedStyle> {
		// console.log('starting drawButtonImage '+ performance.now())
		// console.time('drawButtonImage')

		let processedStyle: ImageResultProcessedStyle

		// Calculate some constants for drawing without reinventing the numbers
		const { drawScale, transformX, transformY } = GraphicsRenderer.calculateTransforms(resolution)

		// special button types
		if (drawStyle.style == 'pageup') {
			processedStyle = { type: 'pageup' }

			img.fillColor(colorDarkGrey)

			if (options.page_plusminus) {
				img.drawTextLine(
					transformX(31),
					transformY(20),
					options.page_direction_flipped ? '–' : '+',
					colorWhite,
					18 * drawScale
				)
			} else {
				img.drawPath(
					[
						[transformX(46), transformY(30)],
						[transformX(36), transformY(20)],
						[transformX(26), transformY(30)],
					],
					{ color: colorWhite, width: 2 }
				) // Arrow up path
			}

			img.drawTextLineAligned(transformX(36), transformY(39), 'UP', colorButtonYellow, 10 * drawScale, 'center', 'top')
		} else if (drawStyle.style == 'pagedown') {
			processedStyle = { type: 'pagedown' }

			img.fillColor(colorDarkGrey)

			if (options.page_plusminus) {
				img.drawTextLine(
					transformX(31),
					transformY(36),
					options.page_direction_flipped ? '+' : '–',
					colorWhite,
					18 * drawScale
				)
			} else {
				img.drawPath(
					[
						[transformX(46), transformY(40)],
						[transformX(36), transformY(50)],
						[transformX(26), transformY(40)],
					],
					{ color: colorWhite, width: 2 }
				) // Arrow down path
			}

			img.drawTextLineAligned(
				transformX(36),
				transformY(23),
				'DOWN',
				colorButtonYellow,
				10 * drawScale,
				'center',
				'top'
			)
		} else if (drawStyle.style == 'pagenum') {
			processedStyle = { type: 'pagenum' }

			img.fillColor(colorDarkGrey)

			if (location === undefined) {
				// Preview (no location)
				img.drawTextLineAligned(
					transformX(36),
					transformY(18),
					'PAGE',
					colorButtonYellow,
					10 * drawScale,
					'center',
					'top'
				)
				img.drawTextLineAligned(transformX(36), transformY(32), 'x', colorWhite, 18 * drawScale, 'center', 'top')
			} else if (!pagename || pagename.toLowerCase() == 'page') {
				img.drawTextLine(transformX(23), transformY(18), 'PAGE', colorButtonYellow, 10 * drawScale)
				img.drawTextLineAligned(
					transformX(36),
					transformY(32),
					'' + location.pageNumber,
					colorWhite,
					18 * drawScale,
					'center',
					'top'
				)
			} else {
				img.drawAlignedText(0, 0, img.width, img.height, pagename, colorWhite, 18 * drawScale, 'center', 'center')
			}
		} else if (drawStyle.style === 'button') {
			const textAlign = ParseAlignment(drawStyle.alignment)
			const pngAlign = ParseAlignment(drawStyle.pngalignment ?? 'center:center') // For some reason, pngalignment is not always set (undefined) when using the `bank_style` feedback, while we do expect it to be. This is an existing issue, I haven't looked into it yet.

			processedStyle = {
				type: 'button',
				color: {
					color: drawStyle.bgcolor,
				},
				text: {
					text: drawStyle.text,
					color: drawStyle.color,
					size: Number(drawStyle.size) || 'auto',
					halign: textAlign[0],
					valign: textAlign[1],
				},
				png64: drawStyle.png64
					? {
							dataUrl: drawStyle.png64,
							halign: pngAlign[0],
							valign: pngAlign[1],
						}
					: undefined,
				state: {
					pushed: drawStyle.pushed,
					showTopBar: drawStyle.show_topbar ?? 'default',
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

		return processedStyle
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

		const outerBounds = new DrawBounds(0, 0, 72, 72)

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

				if (showTopbar)
					ButtonDecorationRenderer.drawLegacy(img, drawStyle, location, GraphicsRenderer.TOPBAR_BOUNDS, outerBounds)
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

			if (showTopbar)
				ButtonDecorationRenderer.drawLegacy(img, drawStyle, location, GraphicsRenderer.TOPBAR_BOUNDS, outerBounds)
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
		if (showTopbar)
			ButtonDecorationRenderer.drawLegacy(img, drawStyle, location, GraphicsRenderer.TOPBAR_BOUNDS, outerBounds)
	}

	/**
	 * Draw pincode entry button for given number
	 * @param num Display number
	 */
	static drawPincodeNumber(width: number, height: number, num: number): ImageResult {
		return GraphicsRenderer.#getCachedImage(width, height, 3, (img) => {
			GraphicsLockingGenerator.generatePincodeChar(img, num)
			return new ImageResult(img.toDataURLSync(), { type: 'button' }, async (width, height, rotation, format) => {
				const dimensions = rotateResolution(width, height, rotation)
				return GraphicsRenderer.#getCachedImage(dimensions[0], dimensions[1], 4, (img) => {
					GraphicsLockingGenerator.generatePincodeChar(img, num)
					return this.#RotateAndConvertImage(img, width, height, rotation, format)
				})
			})
		})
	}

	/**
	 * Draw pincode entry button
	 */
	static drawPincodeEntry(width: number, height: number, code: string | undefined): ImageResult {
		return GraphicsRenderer.#getCachedImage(width, height, 4, (img) => {
			GraphicsLockingGenerator.generatePincodeValue(img, code?.length ?? 0)
			return new ImageResult(img.toDataURLSync(), { type: 'button' }, async (width, height, rotation, format) => {
				const dimensions = rotateResolution(width, height, rotation)
				return GraphicsRenderer.#getCachedImage(dimensions[0], dimensions[1], 4, (img) => {
					GraphicsLockingGenerator.generatePincodeValue(img, code?.length ?? 0)
					return this.#RotateAndConvertImage(img, width, height, rotation, format)
				})
			})
		})
	}

	static #RotateAndConvertImage(
		img: Image,
		width: number,
		height: number,
		rotation: SurfaceRotation | null,
		format: imageRs.PixelFormat
	): Promise<Buffer> {
		// Future: once we support rotation within Image, we can avoid this final transform

		return transformButtonImage(img.buffer(), img.realwidth, img.realheight, rotation, width, height, format)
	}
}

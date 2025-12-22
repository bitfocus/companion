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
import { ImageResult, type ImageResultProcessedStyle } from './ImageResult.js'
import { DrawBounds, type GraphicsOptions } from '@companion-app/shared/Graphics/Util.js'
import type { DrawImageBuffer, DrawStyleModel } from '@companion-app/shared/Model/StyleModel.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { GraphicsLayeredButtonRenderer } from '@companion-app/shared/Graphics/LayeredRenderer.js'
import { ButtonDecorationRenderer } from '@companion-app/shared/Graphics/ButtonDecorationRenderer.js'
import { isPromise } from 'util/types'
import { GraphicsLayeredProcessedStyleGenerator } from './LayeredProcessedStyleGenerator.js'
import { rotateResolution, transformButtonImage } from '../Resources/Util.js'
import type { SurfaceRotation } from '@companion-app/shared/Model/Surfaces.js'
import type * as imageRs from '@julusian/image-rs'
import { Canvas, loadImage } from '@napi-rs/canvas'

const colorButtonYellow = 'rgb(255, 198, 0)'
const colorWhite = 'white'
const colorDarkGrey = 'rgba(15, 15, 15, 1)'

/**
 * Shared style for lock icon display
 */
const LOCK_ICON_STYLE: ImageResultProcessedStyle = {
	type: 'button',
	color: {
		color: 0x000000,
	},
	text: {
		text: '🔒',
		color: 0xc8c8c8,
		size: 'auto',
		halign: 'center',
		valign: 'center',
	},
}

const emptySet: ReadonlySet<string> = new Set()

export class GraphicsRenderer {
	static TOPBAR_BOUNDS = new DrawBounds(0, 0, 72, ButtonDecorationRenderer.DEFAULT_HEIGHT)

	static #IMAGE_CACHE = new Map<string, Image[]>()

	private static calculateTransforms(resolution: { width: number; height: number }) {
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
			res
				.finally(() => {
					pool.push(img)
				})
				.catch(() => null)
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
		location: ControlLocation | null
	): ImageResult {
		// let now = performance.now()
		// console.log('starting drawBlank ' + now, 'time elapsed since last start ' + (now - lastDraw))
		// lastDraw = now
		// console.time('drawBlankImage')

		return GraphicsRenderer.#getCachedImage(resolution.width, resolution.height, 2, (img) => {
			// console.timeEnd('drawBlankImage')
			GraphicsRenderer.#drawBlankImage(img, options, location)

			return new ImageResult(img.toDataURLSync(), null, async (width, height, rotation, format) => {
				const dimensions = rotateResolution(width, height, rotation)
				return GraphicsRenderer.#getCachedImage(dimensions[0], dimensions[1], 4, async (img) => {
					GraphicsRenderer.#drawBlankImage(img, options, location)

					return this.#RotateAndConvertImage(img, width, height, rotation, format)
				})
			})
		})
	}

	static #drawBlankImage(img: Image, options: GraphicsOptions, location: ControlLocation | null) {
		// Calculate some constants for drawing without reinventing the numbers
		const { drawScale, transformX } = GraphicsRenderer.calculateTransforms(img)

		img.fillColor('black')

		if (!options.remove_topbar) {
			img.drawTextLine(
				transformX(2),
				3 * drawScale,
				location ? formatLocation(location) : 'x/x',
				'rgb(50, 50, 50)',
				8 * drawScale
			)
			img.horizontalLine(13.5 * drawScale, { color: 'rgb(30, 30, 30)', width: 1 })
		}
	}

	/**
	 * Draw the image for a button
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
		const dimensions = rotateResolution(resolution.width, resolution.height, rotation)

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
	 * Draw the image for a button
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
	 * Create a 200px preview WebP from the original image
	 */
	static async createImagePreview(
		originalDataUrl: string
	): Promise<{ width: number; height: number; previewDataUrl: string }> {
		try {
			// Load the original image data directly from data URL
			const originalImage = await loadImage(originalDataUrl)

			// Get original dimensions
			const originalWidth = originalImage.width
			const originalHeight = originalImage.height

			// Calculate preview dimensions (max 200px on longest side, but don't upsize small images)
			const maxSize = 200
			let previewWidth: number
			let previewHeight: number

			// Check if the image is smaller than the target preview size
			const largestDimension = Math.max(originalWidth, originalHeight)

			if (largestDimension <= maxSize) {
				// Image is smaller than target size - don't upsize, just use original dimensions
				previewWidth = originalWidth
				previewHeight = originalHeight
			} else {
				// Image is larger than target size - downsize to fit within maxSize
				if (originalWidth > originalHeight) {
					previewWidth = maxSize
					previewHeight = Math.round((originalHeight * previewWidth) / originalWidth)
				} else {
					previewHeight = maxSize
					previewWidth = Math.round((originalWidth * previewHeight) / originalHeight)
				}
			}

			// Create preview canvas
			const canvas = new Canvas(previewWidth, previewHeight)
			const ctx = canvas.getContext('2d')

			// Draw resized image
			ctx.drawImage(originalImage, 0, 0, previewWidth, previewHeight)

			// Convert to data URL (WebP format with 75% quality)
			const previewDataUrl = canvas.toDataURL('image/webp', 0.75)

			return {
				width: originalWidth,
				height: originalHeight,
				previewDataUrl,
			}
		} catch (_e) {
			throw new Error('Failed to process image')
		}
	}

	static async #RotateAndConvertImage(
		img: Image,
		width: number,
		height: number,
		rotation: SurfaceRotation | null,
		format: imageRs.PixelFormat
	): Promise<Buffer> {
		// Future: once we support rotation within Image, we can avoid this final transform

		return transformButtonImage(img.buffer(), img.realwidth, img.realheight, rotation, width, height, format)
	}

	/**
	 * Draw a lock icon for a given size
	 * @param width Width of the image
	 * @param height Height of the image
	 */
	static drawLockIcon(): ImageResult {
		return new ImageResult('', LOCK_ICON_STYLE, async (width, height, rotation, format) => {
			const dimensions = rotateResolution(width, height, rotation)
			return GraphicsRenderer.#getCachedImage(dimensions[0], dimensions[1], 4, async (img) => {
				// Fill with black background
				img.fillColor('rgb(0, 0, 0)')

				// Draw a centered padlock unicode character in light grey
				img.drawAlignedText(
					0,
					0,
					width,
					height,
					'🔒',
					'rgb(200, 200, 200)',
					Math.floor(height * 0.6),
					'center',
					'center'
				)

				return this.#RotateAndConvertImage(img, width, height, rotation, format)
			})
		})
	}

	/**
	 * Flatten an array of imagebuffers into a single base64 image
	 */
	static async drawImageBuffers(showTopBar: boolean, imageBuffers: DrawImageBuffer[]): Promise<string> {
		return GraphicsRenderer.#getCachedImage(
			72,
			showTopBar ? 72 - ButtonDecorationRenderer.DEFAULT_HEIGHT : 72,
			4,
			async (img) => {
				for (const imageBuffer of imageBuffers) {
					if (imageBuffer.buffer) {
						const x = imageBuffer.x ?? 0
						const y = imageBuffer.y ?? 0
						const width = imageBuffer.width || 72
						const height = imageBuffer.height || 72

						img.drawPixelBuffer(x, y, width, height, imageBuffer.buffer, imageBuffer.pixelFormat, imageBuffer.drawScale)
					}
				}

				return img.toDataURLSync()
			}
		)
	}
}

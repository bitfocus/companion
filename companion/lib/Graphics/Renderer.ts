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

import { isPromise } from 'node:util/types'
import type * as imageRs from '@julusian/image-rs'
import { Canvas, loadImage } from '@napi-rs/canvas'
import QuickLRU from 'quick-lru'
import { ButtonDecorationRenderer } from '@companion-app/shared/Graphics/ButtonDecorationRenderer.js'
import type { TextLayoutCache } from '@companion-app/shared/Graphics/ImageBase.js'
import { GraphicsLayeredButtonRenderer } from '@companion-app/shared/Graphics/LayeredRenderer.js'
import { DrawBounds } from '@companion-app/shared/Graphics/Util.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { RendererDrawStyle } from '@companion-app/shared/Model/Render.js'
import type { DrawImageBuffer } from '@companion-app/shared/Model/StyleModel.js'
import type { SurfaceRotation } from '@companion-app/shared/Model/Surfaces.js'
import { rotateResolution, transformButtonImage } from '../Resources/Util.js'
import { Image } from './Image.js'
import { ImageResult, type ImageResultProcessedStyle } from './ImageResult.js'

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
	static #IMAGE_CACHE = new Map<string, Image[]>()

	/** Static cache for text layout computations, shared across all Image instances */
	static #textLayoutCache: TextLayoutCache = new QuickLRU({ maxSize: 5000 })

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

		const img = pool.pop() || Image.create(width, height, oversampling, GraphicsRenderer.#textLayoutCache)
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
	static drawBlank(showTopbar: boolean, location: ControlLocation | null): ImageResult {
		return new ImageResult(
			null,
			async (width, height, rotation, format) => {
				const dimensions = rotateResolution(width, height, rotation)
				return GraphicsRenderer.#getCachedImage(dimensions[0], dimensions[1], 4, async (img) => {
					GraphicsRenderer.#drawBlankImage(img, showTopbar, location)

					return this.#RotateAndConvertImage(img, width, height, rotation, format)
				})
			},
			async (width, height, rotation) => {
				const dimensions = rotateResolution(width, height, rotation)
				return GraphicsRenderer.#getCachedImage(dimensions[0], dimensions[1], 2, (img) => {
					GraphicsRenderer.#drawBlankImage(img, showTopbar, location)

					return img.toDataURLSync()
				})
			}
		)
	}

	static #drawBlankImage(img: Image, showTopbar: boolean, location: ControlLocation | null) {
		img.fillColor('black')

		if (showTopbar) {
			const topBarBounds = new DrawBounds(
				0,
				0,
				img.width,
				Math.max(ButtonDecorationRenderer.DEFAULT_HEIGHT, Math.floor(0.2 * img.height))
			)

			ButtonDecorationRenderer.drawStatusBar(
				img,
				{
					pushed: false,
					location: location ?? undefined,
					stepCount: 1,
					stepCurrent: 1,
					button_status: undefined,
					action_running: undefined,
				},
				topBarBounds,
				true
			)
		}
	}

	/**
	 * Draw the image for a button
	 */
	static async drawButtonImageBuffer(
		drawStyle: RendererDrawStyle,
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
				await GraphicsLayeredButtonRenderer.draw(img, drawStyle, emptySet, null, {
					x: 0,
					y: 0,
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
	static async drawButtonImageDataUrl(
		drawStyle: RendererDrawStyle,
		resolution: { width: number; height: number; oversampling: number },
		rotation: SurfaceRotation | null
	): Promise<string> {
		const dimensions = rotateResolution(resolution.width, resolution.height, rotation)

		return GraphicsRenderer.#getCachedImage(dimensions[0], dimensions[1], resolution.oversampling, async (img) => {
			await GraphicsLayeredButtonRenderer.draw(img, drawStyle, emptySet, null, {
				x: 0,
				y: 0,
			})

			return img.toDataURLSync()
		})
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
		return new ImageResult(
			LOCK_ICON_STYLE,
			async (width, height, rotation, format) => {
				const dimensions = rotateResolution(width, height, rotation)
				return GraphicsRenderer.#getCachedImage(dimensions[0], dimensions[1], 4, async (img) => {
					// Fill with black background
					img.fillColor('rgb(0, 0, 0)')

					// Draw a centered padlock unicode character in light grey
					img.drawAlignedText(
						0,
						0,
						dimensions[0],
						dimensions[1],
						'🔒',
						'rgb(200, 200, 200)',
						Math.floor(dimensions[1] * 0.6),
						false,
						'center',
						'center'
					)

					return this.#RotateAndConvertImage(img, width, height, rotation, format)
				})
			},
			async () => {
				// data-url of this image is never used
				return ''
			}
		)
	}

	/**
	 * Flatten an array of imagebuffers into a single base64 image
	 */
	static async drawImageBuffers(showTopBar: boolean, imageBuffers: DrawImageBuffer[]): Promise<string> {
		const imageWidth = 72
		const imageHeight = showTopBar ? 72 - ButtonDecorationRenderer.DEFAULT_HEIGHT : 72

		return GraphicsRenderer.#getCachedImage(imageWidth, imageHeight, 4, async (img) => {
			for (const imageBuffer of imageBuffers) {
				if (imageBuffer.buffer) {
					const x = imageBuffer.x ?? 0
					const y = imageBuffer.y ?? 0
					const width = imageBuffer.width || imageWidth
					const height = imageBuffer.height || imageHeight

					img.drawPixelBuffer(x, y, width, height, imageBuffer.buffer, imageBuffer.pixelFormat, imageBuffer.drawScale)
				}
			}

			return img.toDataURLSync()
		})
	}
}

import * as imageRs from '@julusian/image-rs'
import { Canvas, GlobalFonts } from '@napi-rs/canvas'
import type { LockingGraphicsGenerator, SurfaceRotation, SurfaceSchemaBitmapConfig } from '@companion-surface/host'
import { FONT_SANS } from '../../../Graphics/Fonts.js'

/**
 * A css font for the given pixel size.
 * The family must be named: canvas ignores a font without one, and the system default can't be relied on (it draws nothing on some Windows machines).
 */
function sansFont(px: number): string {
	return `${Math.floor(px)}px ${FONT_SANS.name}`
}

export class LockingGraphicsGeneratorImpl implements LockingGraphicsGenerator {
	constructor() {
		// The surface host is its own process, so doesn't have the fonts the main process loaded
		if (!GlobalFonts.has(FONT_SANS.name) && !GlobalFonts.registerFromPath(FONT_SANS.pathOnDisk, FONT_SANS.name)) {
			console.error(`Failed to load font: ${FONT_SANS.pathOnDisk}`)
		}
	}

	async generatePincodeChar(
		bitmapStyle: SurfaceSchemaBitmapConfig,
		keyCode: number | string,
		rotation: SurfaceRotation
	): Promise<Uint8Array> {
		const canvasWidth = bitmapStyle.w
		const canvasHeight = bitmapStyle.h

		const canvas = new Canvas(canvasWidth, canvasHeight)
		const context2d = canvas.getContext('2d')

		// Ensure background is black
		context2d.fillStyle = '#000000'
		context2d.fillRect(0, 0, bitmapStyle.w, bitmapStyle.h)

		// Draw centered text
		context2d.font = sansFont(bitmapStyle.h * 0.7)
		context2d.textAlign = 'center'
		context2d.textBaseline = 'middle'
		context2d.fillStyle = '#ffffff'
		context2d.fillText(String(keyCode), bitmapStyle.w / 2, bitmapStyle.h / 2)

		const rawData = context2d.getImageData(0, 0, canvasWidth, canvasHeight).data

		return this.#transformForPixelFormat(bitmapStyle, rotation, rawData)
	}

	async generatePincodeValue(
		bitmapStyle: SurfaceSchemaBitmapConfig,
		charCount: number,
		rotation: SurfaceRotation
	): Promise<Uint8Array> {
		const canvasWidth = bitmapStyle.w
		const canvasHeight = bitmapStyle.h

		const canvas = new Canvas(canvasWidth, canvasHeight)
		const context2d = canvas.getContext('2d')

		// Ensure background is black
		context2d.fillStyle = '#000000'
		context2d.fillRect(0, 0, bitmapStyle.w, bitmapStyle.h)

		if (bitmapStyle.w > 2 * bitmapStyle.h) {
			// Note: this is tuned for the SD Neo, which is 248x58px
			// This should be made more generic or configurable as needed

			// Custom render when  bitmapStyle.w is much larger than bitmapStyle.h
			context2d.textAlign = 'center'
			context2d.textBaseline = 'middle'

			// Draw heading
			context2d.font = sansFont(bitmapStyle.h * 0.4)
			context2d.fillStyle = '#ffc600'
			const textWidth = context2d.measureText('Lockout').width
			if (textWidth > bitmapStyle.w * 0.5) {
				context2d.font = sansFont(bitmapStyle.h * 0.25)
			}

			context2d.fillText('Lockout', bitmapStyle.w * 0.25, bitmapStyle.h * 0.5)

			// Draw progress
			context2d.fillStyle = '#ffffff'
			context2d.font = sansFont(bitmapStyle.h * 0.2)
			context2d.fillText('*'.repeat(charCount), bitmapStyle.w * 0.75, bitmapStyle.h * 0.5)
		} else {
			context2d.textAlign = 'center'
			context2d.textBaseline = 'middle'

			// Draw heading
			context2d.font = sansFont(bitmapStyle.h * 0.2)
			context2d.fillStyle = '#ffc600'
			context2d.fillText('Lockout', bitmapStyle.w / 2, bitmapStyle.h * 0.2)

			// Draw progress
			context2d.fillStyle = '#ffffff'
			context2d.font = sansFont(bitmapStyle.h * 0.2)
			context2d.fillText('*'.repeat(charCount), bitmapStyle.w / 2, bitmapStyle.h * 0.65)
		}

		const rawData = context2d.getImageData(0, 0, canvasWidth, canvasHeight).data

		return this.#transformForPixelFormat(bitmapStyle, rotation, rawData)
	}

	async #transformForPixelFormat(
		bitmapStyle: SurfaceSchemaBitmapConfig,
		rotation: SurfaceRotation,
		rawData: Uint8ClampedArray
	): Promise<Uint8Array> {
		if (bitmapStyle.format === 'rgba') return new Uint8Array(rawData)

		let image = imageRs.ImageTransformer.fromBuffer(new Uint8Array(rawData), bitmapStyle.w, bitmapStyle.h, 'rgba')

		const imageRsRotation = this.#translateRotation(rotation)
		if (imageRsRotation !== null) image = image.rotate(imageRsRotation)

		const targetFormat = bitmapStyle.format || 'rgb'
		const computedImage = await image.toBuffer(targetFormat, {
			premultiplyAlpha: targetFormat.length === 3, // eg rgb/bgr
		})
		return computedImage.buffer
	}

	/**
	 * Translate rotation to @julusian/image-rs equivalent
	 */
	#translateRotation(rotation: SurfaceRotation | null): imageRs.RotationMode | null {
		// Note: Rotation is flipped, to match the physical rotation of the device
		if (rotation === 90) return 'CW270'
		if (rotation === -90) return 'CW90'
		if (rotation === 180) return 'CW180'
		return null
	}
}

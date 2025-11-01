import type { SurfaceSchemaBitmapConfig, LockingGraphicsGenerator } from '@companion-surface/host'
import { Canvas } from '@napi-rs/canvas'
import * as imageRs from '@julusian/image-rs'

export class LockingGraphicsGeneratorImpl implements LockingGraphicsGenerator {
	async generatePincodeChar(bitmapStyle: SurfaceSchemaBitmapConfig, keyCode: number | string): Promise<Uint8Array> {
		const canvasWidth = bitmapStyle.w
		const canvasHeight = bitmapStyle.h

		const canvas = new Canvas(canvasWidth, canvasHeight)
		const context2d = canvas.getContext('2d')

		// Ensure background is black
		context2d.fillStyle = '#000000'
		context2d.fillRect(0, 0, bitmapStyle.w, bitmapStyle.h)

		// Draw centered text
		context2d.font = `${Math.floor(bitmapStyle.h * 0.7)}px`
		context2d.textAlign = 'center'
		context2d.textBaseline = 'middle'
		context2d.fillStyle = '#ffffff'
		context2d.fillText(String(keyCode), bitmapStyle.w / 2, bitmapStyle.h / 2)

		const rawData = context2d.getImageData(0, 0, canvasWidth, canvasHeight).data

		return this.#transformForPixelFormat(bitmapStyle, rawData)
	}

	async generatePincodeValue(bitmapStyle: SurfaceSchemaBitmapConfig, charCount: number): Promise<Uint8Array> {
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
			context2d.font = `${Math.floor(bitmapStyle.h * 0.4)}px`
			context2d.fillStyle = '#ffc600'
			const textWidth = context2d.measureText('Lockout').width
			if (textWidth > bitmapStyle.w * 0.5) {
				context2d.font = `${Math.floor(bitmapStyle.h * 0.25)}px`
			}

			context2d.fillText('Lockout', bitmapStyle.w * 0.25, bitmapStyle.h * 0.5)

			// Draw progress
			context2d.fillStyle = '#ffffff'
			context2d.font = `${Math.floor(bitmapStyle.h * 0.2)}px`
			context2d.fillText('*'.repeat(charCount), bitmapStyle.w * 0.75, bitmapStyle.h * 0.5)
		} else {
			context2d.textAlign = 'center'
			context2d.textBaseline = 'middle'

			// Draw heading
			context2d.font = `${Math.floor(bitmapStyle.h * 0.2)}px`
			context2d.fillStyle = '#ffc600'
			context2d.fillText('Lockout', bitmapStyle.w / 2, bitmapStyle.h * 0.2)

			// Draw progress
			context2d.fillStyle = '#ffffff'
			context2d.font = `${Math.floor(bitmapStyle.h * 0.2)}px`
			context2d.fillText('*'.repeat(charCount), bitmapStyle.w / 2, bitmapStyle.h * 0.65)
		}

		const rawData = context2d.getImageData(0, 0, canvasWidth, canvasHeight).data

		return this.#transformForPixelFormat(bitmapStyle, rawData)
	}

	async #transformForPixelFormat(
		bitmapStyle: SurfaceSchemaBitmapConfig,
		rawData: Uint8ClampedArray
	): Promise<Uint8Array> {
		if (bitmapStyle.format === 'rgba') return new Uint8Array(rawData)

		const image = imageRs.ImageTransformer.fromBuffer(new Uint8Array(rawData), bitmapStyle.w, bitmapStyle.h, 'rgba')

		if (bitmapStyle.format === 'bgr' || bitmapStyle.format === 'bgra') {
			throw new Error('BGR(A) format is not supported for pincode rendering yet')
		}

		const computedImage = await image.toBuffer(bitmapStyle.format || 'rgb')
		return computedImage.buffer
	}
}

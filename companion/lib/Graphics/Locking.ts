import { Image } from './Image.js'

/**
 * A simple generator for the lockout graphics.
 * Note: This is derived from satellite https://github.com/bitfocus/companion-satellite/blob/main/satellite/src/graphics/locking.ts
 */
export class GraphicsLockingGenerator {
	static generatePincodeChar(img: Image, keyCode: number | string): void {
		const width = img.width
		const height = img.height

		const canvas = img.canvasImage
		const context2d = canvas.getContext('2d')

		// Ensure background is black
		context2d.fillStyle = '#000000'
		context2d.fillRect(0, 0, width, height)

		// Draw centered text
		context2d.font = `${Math.floor(height * 0.7)}px`
		context2d.textAlign = 'center'
		context2d.textBaseline = 'middle'
		context2d.fillStyle = '#ffffff'
		context2d.fillText(keyCode + '', width / 2, height / 2)

		// return context2d.getImageData(0, 0, img.realwidth, img.realheight).data
	}

	static generatePincodeValue(img: Image, charCount: number): void {
		const width = img.width
		const height = img.height

		const canvas = img.canvasImage
		const context2d = canvas.getContext('2d')

		// Ensure background is black
		context2d.fillStyle = '#000000'
		context2d.fillRect(0, 0, width, height)

		if (width > 2 * height) {
			// Note: this is tuned for the SD Neo, which is 248x58px
			// This should be made more generic or configurable as needed

			// Custom render when width is much larger than height
			context2d.textAlign = 'center'
			context2d.textBaseline = 'middle'

			// Draw heading
			context2d.font = `${Math.floor(height * 0.4)}px`
			context2d.fillStyle = '#ffc600'
			const textWidth = context2d.measureText('Lockout').width
			if (textWidth > width * 0.5) {
				context2d.font = `${Math.floor(height * 0.25)}px`
			}

			context2d.fillText('Lockout', width * 0.25, height * 0.5)

			// Draw progress
			context2d.fillStyle = '#ffffff'
			context2d.font = `${Math.floor(height * 0.2)}px`
			context2d.fillText('*'.repeat(charCount), width * 0.75, height * 0.5)
		} else {
			context2d.textAlign = 'center'
			context2d.textBaseline = 'middle'

			// Draw heading
			context2d.font = `${Math.floor(height * 0.2)}px`
			context2d.fillStyle = '#ffc600'
			context2d.fillText('Lockout', width / 2, height * 0.2)

			// Draw progress
			context2d.fillStyle = '#ffffff'
			context2d.font = `${Math.floor(height * 0.2)}px`
			context2d.fillText('*'.repeat(charCount), width / 2, height * 0.65)
		}

		// return context2d.getImageData(0, 0, canvasWidth, canvasHeight).data
	}
}

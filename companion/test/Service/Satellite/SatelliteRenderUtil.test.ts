import { describe, expect, test, vi } from 'vitest'
import { ImageResult, type ImageResultProcessedStyle } from '../../../lib/Graphics/ImageResult.js'
import { buildSatelliteStyleArgs } from '../../../lib/Service/Satellite/SatelliteRenderUtil.js'
import type { SatelliteControlStylePreset } from '../../../lib/Service/Satellite/SatelliteSurfaceManifestSchema.js'

function makeImage(
	style: ImageResultProcessedStyle | null,
	drawNative = vi.fn().mockResolvedValue(new Uint8Array(0)),
	drawDataUrl = vi.fn().mockResolvedValue('')
): ImageResult {
	return new ImageResult(style, drawNative, drawDataUrl)
}

describe('buildSatelliteStyleArgs', () => {
	describe('PRESSED', () => {
		test('is false when style is null', async () => {
			const image = makeImage(null)
			const result = await buildSatelliteStyleArgs(image, {}, null, 'rgb')
			expect(result['PRESSED']).toBe(false)
		})

		test('is false when state.pushed is false', async () => {
			const image = makeImage({ type: 'button', state: { pushed: false, showTopBar: false } })
			const result = await buildSatelliteStyleArgs(image, {}, null, 'rgb')
			expect(result['PRESSED']).toBe(false)
		})

		test('is true when state.pushed is true', async () => {
			const image = makeImage({ type: 'button', state: { pushed: true, showTopBar: false } })
			const result = await buildSatelliteStyleArgs(image, {}, null, 'rgb')
			expect(result['PRESSED']).toBe(true)
		})
	})

	describe('TYPE', () => {
		test('is BUTTON for regular button type', async () => {
			const image = makeImage({ type: 'button' })
			const result = await buildSatelliteStyleArgs(image, {}, null, 'rgb')
			expect(result['TYPE']).toBe('BUTTON')
		})

		test('is BUTTON when style is null', async () => {
			const image = makeImage(null)
			const result = await buildSatelliteStyleArgs(image, {}, null, 'rgb')
			expect(result['TYPE']).toBe('BUTTON')
		})

		test('is PAGEUP for pageup type', async () => {
			const image = makeImage({ type: 'pageup' })
			const result = await buildSatelliteStyleArgs(image, {}, null, 'rgb')
			expect(result['TYPE']).toBe('PAGEUP')
		})

		test('is PAGEDOWN for pagedown type', async () => {
			const image = makeImage({ type: 'pagedown' })
			const result = await buildSatelliteStyleArgs(image, {}, null, 'rgb')
			expect(result['TYPE']).toBe('PAGEDOWN')
		})

		test('is PAGENUM for pagenum type', async () => {
			const image = makeImage({ type: 'pagenum' })
			const result = await buildSatelliteStyleArgs(image, {}, null, 'rgb')
			expect(result['TYPE']).toBe('PAGENUM')
		})
	})

	describe('BITMAP', () => {
		test('is absent when style.bitmap is not set', async () => {
			const image = makeImage(null)
			const result = await buildSatelliteStyleArgs(image, {}, null, 'rgb')
			expect(result['BITMAP']).toBeUndefined()
		})

		test('is base64-encoded pixel data when drawNative returns bytes', async () => {
			const pixelData = new Uint8Array([255, 0, 0, 0, 255, 0])
			const drawNative = vi.fn().mockResolvedValue(pixelData)
			const image = makeImage(null, drawNative)
			const style: SatelliteControlStylePreset = { bitmap: { w: 72, h: 72 } }

			const result = await buildSatelliteStyleArgs(image, style, null, 'rgb')

			expect(result['BITMAP']).toBe(Buffer.from(pixelData).toString('base64'))
			expect(drawNative).toHaveBeenCalledWith(72, 72, null, 'rgb')
		})

		test('is absent when drawNative returns empty buffer', async () => {
			const drawNative = vi.fn().mockResolvedValue(new Uint8Array(0))
			const image = makeImage(null, drawNative)
			const style: SatelliteControlStylePreset = { bitmap: { w: 72, h: 72 } }

			const result = await buildSatelliteStyleArgs(image, style, null, 'rgb')

			expect(result['BITMAP']).toBeUndefined()
		})

		test('rgb format sends raw base64 pixel data via the drawNative path', async () => {
			const pixelData = new Uint8Array([255, 0, 0, 0, 255, 0])
			const drawNative = vi.fn().mockResolvedValue(pixelData)
			const image = makeImage(null, drawNative)
			const style: SatelliteControlStylePreset = { bitmap: { w: 72, h: 72 } }

			const result = await buildSatelliteStyleArgs(image, style, null, 'rgb')

			expect(result['BITMAP']).toBe(Buffer.from(pixelData).toString('base64'))
			expect(drawNative).toHaveBeenCalledWith(72, 72, null, 'rgb')
		})

		test.each(['png', 'webp'] as const)('%s format sends the data url verbatim', async (format) => {
			const dataUrl = `data:image/${format};base64,AQIDBA==`
			const image = makeImage(null)
			const drawNativeEncoded = vi.spyOn(image, 'drawNativeEncoded').mockResolvedValue(dataUrl)
			const style: SatelliteControlStylePreset = { bitmap: { w: 96, h: 48 } }

			const result = await buildSatelliteStyleArgs(image, style, null, format)

			expect(drawNativeEncoded).toHaveBeenCalledWith(96, 48, null, format)
			// The self-describing data url is sent as-is; no separate FORMAT tag on the wire
			expect(result['BITMAP']).toBe(dataUrl)
			expect(result['FORMAT']).toBeUndefined()
		})

		test('passes through an empty data url when there is nothing to encode', async () => {
			const image = makeImage(null)
			vi.spyOn(image, 'drawNativeEncoded').mockResolvedValue('')
			const style: SatelliteControlStylePreset = { bitmap: { w: 72, h: 72 } }

			const result = await buildSatelliteStyleArgs(image, style, null, 'png')

			expect(result['BITMAP']).toBe('')
		})
	})

	describe('COLOR and TEXTCOLOR', () => {
		test('are absent when style.colors is not set', async () => {
			const image = makeImage({
				type: 'button',
				color: { color: 0xff0000 },
				text: { text: 'Hi', color: 0x00ff00, size: 14, halign: 'center', valign: 'center' },
			})
			const result = await buildSatelliteStyleArgs(image, {}, null, 'rgb')
			expect(result['COLOR']).toBeUndefined()
			expect(result['TEXTCOLOR']).toBeUndefined()
		})

		test('are hex format when style.colors is hex', async () => {
			const image = makeImage({
				type: 'button',
				color: { color: 0xff0000 },
				text: { text: 'Hi', color: 0x00ff00, size: 14, halign: 'center', valign: 'center' },
			})
			const result = await buildSatelliteStyleArgs(image, { colors: 'hex' }, null, 'rgb')
			expect(result['COLOR']).toBe('#ff0000')
			expect(result['TEXTCOLOR']).toBe('#00ff00')
		})

		test('are rgb format when style.colors is rgb', async () => {
			const image = makeImage({
				type: 'button',
				color: { color: 0xff0000 },
				text: { text: 'Hi', color: 0x00ff00, size: 14, halign: 'center', valign: 'center' },
			})
			const result = await buildSatelliteStyleArgs(image, { colors: 'rgb' }, null, 'rgb')
			expect(result['COLOR']).toBe('rgba(255,0,0,1)')
			expect(result['TEXTCOLOR']).toBe('rgba(0,255,0,1)')
		})

		test('default to black when drawStyle has no color or text', async () => {
			const image = makeImage({ type: 'button' })
			const result = await buildSatelliteStyleArgs(image, { colors: 'hex' }, null, 'rgb')
			expect(result['COLOR']).toBe('#000000')
			expect(result['TEXTCOLOR']).toBe('#000000')
		})

		test('default to black when style is null', async () => {
			const image = makeImage(null)
			const result = await buildSatelliteStyleArgs(image, { colors: 'hex' }, null, 'rgb')
			expect(result['COLOR']).toBe('#000000')
			expect(result['TEXTCOLOR']).toBe('#000000')
		})
	})

	describe('TEXT', () => {
		test('is absent when style.text is not set', async () => {
			const image = makeImage({
				type: 'button',
				text: { text: 'Hello', color: 0, size: 14, halign: 'center', valign: 'center' },
			})
			const result = await buildSatelliteStyleArgs(image, {}, null, 'rgb')
			expect(result['TEXT']).toBeUndefined()
		})

		test('is base64-encoded text when style.text is true', async () => {
			const image = makeImage({
				type: 'button',
				text: { text: 'Hello', color: 0, size: 14, halign: 'center', valign: 'center' },
			})
			const result = await buildSatelliteStyleArgs(image, { text: true }, null, 'rgb')
			expect(result['TEXT']).toBe(Buffer.from('Hello').toString('base64'))
		})

		test('is empty base64 string when drawStyle has no text', async () => {
			const image = makeImage({ type: 'button' })
			const result = await buildSatelliteStyleArgs(image, { text: true }, null, 'rgb')
			expect(result['TEXT']).toBe(Buffer.from('').toString('base64'))
		})
	})

	describe('FONT_SIZE', () => {
		test('is absent when style.textStyle is not set', async () => {
			const image = makeImage({
				type: 'button',
				text: { text: 'Hi', color: 0, size: 14, halign: 'center', valign: 'center' },
			})
			const result = await buildSatelliteStyleArgs(image, {}, null, 'rgb')
			expect(result['FONT_SIZE']).toBeUndefined()
		})

		test('is the font size from drawStyle when style.textStyle is true', async () => {
			const image = makeImage({
				type: 'button',
				text: { text: 'Hi', color: 0, size: 14, halign: 'center', valign: 'center' },
			})
			const result = await buildSatelliteStyleArgs(image, { textStyle: true }, null, 'rgb')
			expect(result['FONT_SIZE']).toBe(14)
		})

		test('is auto when drawStyle.text.size is auto', async () => {
			const image = makeImage({
				type: 'button',
				text: { text: 'Hi', color: 0, size: 'auto', halign: 'center', valign: 'center' },
			})
			const result = await buildSatelliteStyleArgs(image, { textStyle: true }, null, 'rgb')
			expect(result['FONT_SIZE']).toBe('auto')
		})

		test('is auto when drawStyle has no text', async () => {
			const image = makeImage({ type: 'button' })
			const result = await buildSatelliteStyleArgs(image, { textStyle: true }, null, 'rgb')
			expect(result['FONT_SIZE']).toBe('auto')
		})
	})
})

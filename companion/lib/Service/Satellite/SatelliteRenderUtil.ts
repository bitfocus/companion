import { parseColor } from '@companion-app/shared/Graphics/Util.js'
import type { SurfaceRotation } from '@companion-app/shared/Model/Surfaces.js'
import type { ImageResult } from '../../Graphics/ImageResult.js'
import { parseColorToNumber } from '../../Resources/Util.js'
import type { SatelliteMessageArgs } from './SatelliteApi.js'
import type { SatelliteControlStylePreset } from './SatelliteSurfaceManifestSchema.js'

/**
 * Bitmap encodings a satellite can negotiate for button images.
 * `rgb` is raw pixel data (the universal fallback), `png`/`webp` are lossless compressed images.
 */
export type SatelliteBitmapFormat = 'rgb' | 'png' | 'webp'

/**
 * The bitmap formats this Companion can encode, advertised to satellites via `BITMAP_FORMATS` in CAPS.
 * `rgb` must always be present as the fallback for surfaces without an image decoder.
 */
export const SATELLITE_BITMAP_FORMATS: readonly SatelliteBitmapFormat[] = ['rgb', 'png', 'webp']

/**
 * Validate a client-reported bitmap format, falling back to `rgb` when absent or unknown.
 * Older satellites won't send a format, and we must never assume a decoder they didn't advertise.
 */
export function parseSatelliteBitmapFormat(value: string | boolean | undefined): SatelliteBitmapFormat {
	if (typeof value === 'string' && SATELLITE_BITMAP_FORMATS.includes(value as SatelliteBitmapFormat)) {
		return value as SatelliteBitmapFormat
	}
	return 'rgb'
}

/**
 * Build the style-related message args (BITMAP, COLOR, TEXTCOLOR, TEXT, FONT_SIZE)
 * for streaming button state to a satellite client.
 *
 * Shared between KEY-STATE (surface mode) and SUB-STATE (subscription mode).
 */
export async function buildSatelliteStyleArgs(
	image: ImageResult,
	style: SatelliteControlStylePreset,
	rotation: SurfaceRotation | null,
	bitmapFormat: SatelliteBitmapFormat
): Promise<SatelliteMessageArgs> {
	const params: SatelliteMessageArgs = {}
	const drawStyle = image.style

	params['PRESSED'] = typeof drawStyle !== 'string' && !!drawStyle?.state?.pushed

	if (drawStyle?.type === 'pageup') params['TYPE'] = 'PAGEUP'
	else if (drawStyle?.type === 'pagedown') params['TYPE'] = 'PAGEDOWN'
	else if (drawStyle?.type === 'pagenum') params['TYPE'] = 'PAGENUM'
	else params['TYPE'] = 'BUTTON'

	if (style.bitmap) {
		if (bitmapFormat === 'rgb') {
			const buffer = await image.drawNative(style.bitmap.w, style.bitmap.h, rotation, 'rgb')
			if (buffer.length > 0) {
				params['BITMAP'] = buffer.toBase64()
			}
		} else {
			// Compressed formats come back as a self-describing data url (`data:image/webp;base64,...`)
			// and are sent verbatim: the client distinguishes them from raw rgb by the `data:` prefix
			params['BITMAP'] = await image.drawNativeEncoded(style.bitmap.w, style.bitmap.h, rotation, bitmapFormat)
		}
	}

	if (style.colors) {
		let bgcolor = drawStyle?.color ? parseColor(drawStyle.color.color).replaceAll(' ', '') : 'rgb(0,0,0)'
		let fgcolor = drawStyle?.text ? parseColor(drawStyle.text.color).replaceAll(' ', '') : 'rgb(0,0,0)'

		if (style.colors !== 'rgb') {
			bgcolor = '#' + parseColorToNumber(bgcolor).toString(16).padStart(6, '0')
			fgcolor = '#' + parseColorToNumber(fgcolor).toString(16).padStart(6, '0')
		}

		params['COLOR'] = bgcolor
		params['TEXTCOLOR'] = fgcolor
	}

	if (style.text) {
		const text = drawStyle?.text?.text || ''
		params['TEXT'] = Buffer.from(text).toString('base64')
	}
	if (style.textStyle) {
		params['FONT_SIZE'] = drawStyle?.text?.size ?? 'auto'
	}

	return params
}

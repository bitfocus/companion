import { parseColor } from '@companion-app/shared/Graphics/Util.js'
import type { SurfaceRotation } from '@companion-app/shared/Model/Surfaces.js'
import type { ImageResult } from '../../Graphics/ImageResult.js'
import { parseColorToNumber, uint8ArrayToBuffer } from '../../Resources/Util.js'
import type { SatelliteMessageArgs } from './SatelliteApi.js'
import type { SatelliteControlStylePreset } from './SatelliteSurfaceManifestSchema.js'

/**
 * Build the style-related message args (BITMAP, COLOR, TEXTCOLOR, TEXT, FONT_SIZE)
 * for streaming button state to a satellite client.
 *
 * Shared between KEY-STATE (surface mode) and SUB-STATE (subscription mode).
 */
export async function buildSatelliteStyleArgs(
	image: ImageResult,
	style: SatelliteControlStylePreset,
	rotation: SurfaceRotation | null
): Promise<SatelliteMessageArgs> {
	const params: SatelliteMessageArgs = {}
	const drawStyle = image.style

	params['PRESSED'] = typeof drawStyle !== 'string' && !!drawStyle?.state?.pushed

	if (drawStyle?.type === 'pageup') params['TYPE'] = 'PAGEUP'
	else if (drawStyle?.type === 'pagedown') params['TYPE'] = 'PAGEDOWN'
	else if (drawStyle?.type === 'pagenum') params['TYPE'] = 'PAGENUM'
	else params['TYPE'] = 'BUTTON'

	if (style.bitmap) {
		const buffer = await image.drawNative(style.bitmap.w, style.bitmap.h, rotation, 'rgb')

		if (buffer !== undefined && buffer.length > 0) {
			params['BITMAP'] = uint8ArrayToBuffer(buffer).toString('base64')
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

import type { SurfaceRotation } from '@companion-app/shared/Model/Surfaces.js'
import type { ImageResult } from '../../Graphics/ImageResult.js'
import { parseColor, parseColorToNumber, transformButtonImage } from '../../Resources/Util.js'
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

	params['PRESSED'] = typeof drawStyle !== 'string' && !!drawStyle?.pushed

	if (drawStyle === 'pageup') params['TYPE'] = 'PAGEUP'
	else if (drawStyle === 'pagedown') params['TYPE'] = 'PAGEDOWN'
	else if (drawStyle === 'pagenum') params['TYPE'] = 'PAGENUM'
	else params['TYPE'] = 'BUTTON'

	if (style.bitmap) {
		const buffer = await transformButtonImage(image, rotation, style.bitmap.w, style.bitmap.h, 'rgb')

		if (buffer !== undefined && buffer.length > 0) {
			params['BITMAP'] = buffer.toString('base64')
		}
	}

	if (style.colors) {
		let bgcolor =
			typeof drawStyle !== 'string' && drawStyle ? parseColor(drawStyle.bgcolor).replaceAll(' ', '') : 'rgb(0,0,0)'
		let fgcolor =
			typeof drawStyle !== 'string' && drawStyle ? parseColor(drawStyle.color).replaceAll(' ', '') : 'rgb(0,0,0)'

		if (style.colors !== 'rgb') {
			bgcolor = '#' + parseColorToNumber(bgcolor).toString(16).padStart(6, '0')
			fgcolor = '#' + parseColorToNumber(fgcolor).toString(16).padStart(6, '0')
		}

		params['COLOR'] = bgcolor
		params['TEXTCOLOR'] = fgcolor
	}

	if (style.text) {
		const text = (typeof drawStyle !== 'string' && drawStyle?.text) || ''
		params['TEXT'] = Buffer.from(text).toString('base64')
	}
	if (style.textStyle) {
		params['FONT_SIZE'] = typeof drawStyle !== 'string' && drawStyle ? drawStyle.size : 'auto'
	}

	return params
}

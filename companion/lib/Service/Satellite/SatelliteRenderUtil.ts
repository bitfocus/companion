import type {
	SatelliteBitmapFormat,
	SatelliteControlStylePreset,
	SatelliteMessageArgs,
} from '@companion-app/satellite-protocol'
import { sampleLedsToBuffer } from '@companion-app/shared/Graphics/GaugeLeds.js'
import { parseColor } from '@companion-app/shared/Graphics/Util.js'
import type { SurfaceRotation } from '@companion-app/shared/Model/Surfaces.js'
import type { ImageResult } from '../../Graphics/ImageResult.js'
import { parseColorToNumber } from '../../Resources/Util.js'
import { computeBitmapId, type SatelliteBitmapCache } from './SatelliteBitmapCache.js'

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
		const bitmap = await drawSatelliteBitmap(image, style.bitmap, rotation, bitmapFormat)
		if (bitmap !== null) params['BITMAP'] = bitmap
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

	if (style.leds && drawStyle?.leds) {
		// Always raw RGB, base64-encoded. Unlike BITMAP, LEDS never follows the negotiated bitmapFormat.
		const buffer = sampleLedsToBuffer(drawStyle.leds, style.leds.segments, style.leds.mode)
		params['LEDS'] = buffer.toBase64()
	}

	return params
}

/**
 * Draw the bitmap of a button, in the encoding sent to a satellite client
 * @returns The bitmap, or null if there is no raw rgb data. An encoded bitmap is passed through as is
 */
async function drawSatelliteBitmap(
	image: ImageResult,
	size: { w: number; h: number },
	rotation: SurfaceRotation | null,
	bitmapFormat: SatelliteBitmapFormat
): Promise<string | null> {
	if (bitmapFormat === 'rgb') {
		const buffer = await image.drawNative(size.w, size.h, rotation, 'rgb')
		return buffer.length > 0 ? buffer.toBase64() : null
	} else {
		// Compressed formats come back as a self-describing data url (`data:image/webp;base64,...`)
		// and are sent verbatim: the client distinguishes them from raw rgb by the `data:` prefix
		return image.drawNativeEncoded(size.w, size.h, rotation, bitmapFormat)
	}
}

/** The part of a satellite socket needed to send button state to it */
export interface SatelliteStyleSocket {
	/** The bitmaps the client is caching for this connection, or null if it is not caching any */
	readonly bitmapCache: SatelliteBitmapCache | null
	sendMessage(messageName: string, status: null, deviceId: string | null, args: SatelliteMessageArgs): void
}

/**
 * The most of a client's cache budget which the frames of one animation may take, for its frames to be cached.
 * Each frame of an animation is seen again only after all of the others, so unless they all fit in the client's
 * cache, each gets evicted just before it is needed again. That would make every frame cost an id and an eviction on
 * top of the bitmap, which is worse than no caching.
 *
 * This is a heuristic: it counts each frame at its size as RGBA rather than what the client reports, and leaves room
 * for the other buttons, but several animations at once can still take more than the whole budget between them
 */
export const SATELLITE_CACHE_MAX_ANIMATION_SHARE = 0.5

/**
 * Whether the renders of an animation could all stay in a client's cache together, so caching them is worthwhile
 */
function shouldCacheRender(cache: SatelliteBitmapCache, image: ImageResult, width: number, height: number): boolean {
	// A static render is cached whenever it fits at all
	if (image.cycleRenderCount <= 1) return true
	return image.cycleRenderCount * width * height * 4 <= cache.budgetBytes * SATELLITE_CACHE_MAX_ANIMATION_SHARE
}

/** Most bitmap ids to list in one BITMAP-EVICT, to keep the line well within the length limit */
const MAX_EVICT_IDS_PER_MESSAGE = 1000

/**
 * Tell a client to evict some bitmaps from its cache
 */
export function sendBitmapEvictions(socket: SatelliteStyleSocket, ids: readonly string[]): void {
	for (let i = 0; i < ids.length; i += MAX_EVICT_IDS_PER_MESSAGE) {
		socket.sendMessage('BITMAP-EVICT', null, null, {
			BITMAP_IDS: ids.slice(i, i + MAX_EVICT_IDS_PER_MESSAGE).join(','),
		})
	}
}

/**
 * Send the state of a button to a satellite client (a KEY-STATE or SUB-STATE), making use of the bitmaps the client
 * is caching when it has opted in to that.
 *
 * The decision of whether the client has a bitmap is made in the same synchronous step as the message is written,
 * so that a change to the cache (eg the client resizing or purging it) can't happen in between and leave the client
 * being told to draw a bitmap it no longer has.
 */
export async function sendSatelliteStyleMessage(
	socket: SatelliteStyleSocket,
	messageName: string,
	deviceId: string | null,
	baseArgs: SatelliteMessageArgs,
	image: ImageResult,
	style: SatelliteControlStylePreset,
	rotation: SurfaceRotation | null,
	bitmapFormat: SatelliteBitmapFormat
): Promise<void> {
	const bitmapSize = style.bitmap
	const bitmapId =
		bitmapSize && socket.bitmapCache && shouldCacheRender(socket.bitmapCache, image, bitmapSize.w, bitmapSize.h)
			? computeBitmapId(image, bitmapSize.w, bitmapSize.h, rotation, bitmapFormat)
			: null
	if (!bitmapSize || !bitmapId) {
		// Nothing to cache, so send it as it always has been
		const styleArgs = await buildSatelliteStyleArgs(image, style, rotation, bitmapFormat)
		socket.sendMessage(messageName, null, deviceId, { ...baseArgs, ...styleArgs })
		return
	}

	const otherArgs = await buildSatelliteStyleArgs(image, { ...style, bitmap: undefined }, rotation, bitmapFormat)

	// Each decision is made in the same synchronous step as writing the message, so the cache can't change between
	if (socket.bitmapCache?.reference(bitmapId)) {
		socket.sendMessage(messageName, null, deviceId, { ...baseArgs, ...otherArgs, BITMAP_ID: bitmapId })
		return
	}

	// The client doesn't have it, so draw it
	const bitmap = await drawSatelliteBitmap(image, bitmapSize, rotation, bitmapFormat)
	if (bitmap === null) {
		socket.sendMessage(messageName, null, deviceId, { ...baseArgs, ...otherArgs })
		return
	}

	// The cache may have changed while drawing, eg the same bitmap was sent by another draw, so decide again
	if (socket.bitmapCache?.reference(bitmapId)) {
		socket.sendMessage(messageName, null, deviceId, { ...baseArgs, ...otherArgs, BITMAP_ID: bitmapId })
		return
	}

	const evicted = socket.bitmapCache?.store(bitmapId, bitmapSize.w, bitmapSize.h) ?? null
	if (evicted === null) {
		// Caching was turned off while drawing, or the bitmap is too large to cache, so it isn't stored
		socket.sendMessage(messageName, null, deviceId, { ...baseArgs, ...otherArgs, BITMAP: bitmap })
	} else {
		sendBitmapEvictions(socket, evicted)
		socket.sendMessage(messageName, null, deviceId, { ...baseArgs, ...otherArgs, BITMAP: bitmap, BITMAP_ID: bitmapId })
	}
}

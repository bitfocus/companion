import type { ControlLocation } from './Common.js'
import type { DrawStyleLayeredButtonModel, ResolvedButtonGraphicsDecoration } from './StyleModel.js'

export type RendererDrawStyle = RendererButtonStyle

export interface RendererButtonStyle extends DrawStyleLayeredButtonModel {
	decoration: ResolvedButtonGraphicsDecoration
	show_status_icons: boolean
	location: ControlLocation | undefined
	/**
	 * Images already decoded by the backend, keyed by the id of the image element that draws them.
	 * An image element with an entry here is drawn from it, instead of decoding its `base64Image`
	 */
	decodedImages: ReadonlyMap<string, DecodedRasterImage> | null
}

/**
 * An image which has already been decoded into pixels by the backend.
 * The buffer is shared between the render threads, so the pixels are never copied or decoded again to draw them
 */
export interface DecodedRasterImage {
	/** Straight alpha RGBA pixels, with each frame stored back to back */
	buffer: SharedArrayBuffer
	width: number
	height: number
	/** The frame of the buffer to draw */
	frameIndex: number
}

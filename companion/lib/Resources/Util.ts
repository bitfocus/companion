import path from 'node:path'
import * as imageRs from '@julusian/image-rs'
import { colord } from 'colord'
import type { SurfaceRotation } from '@companion-app/shared/Model/Surfaces.js'

/**
 * Combine rgba components to a 32bit value
 * @param a 0-255
 * @param r 0-255
 * @param g 0-255
 * @param b 0-255
 * @param base
 */
export function argb(
	a: number | string,
	r: number | string,
	g: number | string,
	b: number | string,
	base = 10
): number | false {
	// @ts-expect-error TypeScript doesn't like parseInt with a number
	a = parseInt(a, base)
	// @ts-expect-error TypeScript doesn't like parseInt with a number
	r = parseInt(r, base)
	// @ts-expect-error TypeScript doesn't like parseInt with a number
	g = parseInt(g, base)
	// @ts-expect-error TypeScript doesn't like parseInt with a number
	b = parseInt(b, base)

	const rgbVal = rgb(r, g, b)
	if (isNaN(a) || rgbVal === false) return false

	return (
		(255 - a) * 0x1000000 + rgbVal // bitwise doesn't work because JS bitwise is working with 32bit signed int
	)
}

/**
 * Convert a 24bit number itno rgb components
 */
export const decimalToRgb = (decimal: number): { red: number; green: number; blue: number } => {
	return {
		red: (decimal >> 16) & 0xff,
		green: (decimal >> 8) & 0xff,
		blue: decimal & 0xff,
	}
}

/**
 * Combine rgb components to a 24bit value
 * @param r 0-255
 * @param g 0-255
 * @param b 0-255
 * @param base
 */
export const rgb = (r: number | string, g: number | string, b: number | string, base = 10): number | false => {
	// @ts-expect-error TypeScript doesn't like parseInt with a number
	r = parseInt(r, base)
	// @ts-expect-error TypeScript doesn't like parseInt with a number
	g = parseInt(g, base)
	// @ts-expect-error TypeScript doesn't like parseInt with a number
	b = parseInt(b, base)

	if (isNaN(r) || isNaN(g) || isNaN(b)) return false
	return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff)
}

/**
 * Parse a css color string to a number
 * Note: alpha is not preserved, and will be ignored
 */
export const parseColorToNumber = (color: string | number | Uint8Array): number | false => {
	if (typeof color === 'string') {
		const newColor = colord(color)
		if (newColor.isValid()) {
			return rgb(newColor.rgba.r, newColor.rgba.g, newColor.rgba.b)
		} else {
			return false
		}
	}
	if (typeof color === 'number') {
		return color
	}
	return false
}

/**
 * @param milliseconds
 */
export const delay = async (milliseconds: number): Promise<void> => {
	return new Promise((resolve) => setTimeout(resolve, milliseconds || 0))
}

/**
 * Yield control back to the event loop, allowing queued I/O (IPC responses, websocket keepalive, ...)
 * to be processed. Use this to break up long synchronous bursts of work so they don't block the loop.
 */
export const yieldToEventLoop = async (): Promise<void> => {
	return new Promise((resolve) => setImmediate(resolve))
}

export const getTimestamp = (): string => {
	const d = new Date()
	const year = d.getFullYear().toString()
	const month = convert2Digit(d.getMonth() + 1)
	const day = convert2Digit(d.getDate())
	const hrs = convert2Digit(d.getHours())
	const mins = convert2Digit(d.getMinutes())
	const out = year + month + day + '-' + hrs + mins
	return out
}

/**
 * Convert a number to a 2 digit string
 */
export const convert2Digit = (num: number): string => {
	if (num < 10) {
		return '0' + num
	} else {
		return num + ''
	}
}

/**
 * Clamp a value to be within a range
 */
export function clamp(val: number, min: number, max: number): number {
	return Math.min(Math.max(val, min), max)
}

/**
 * Translate rotation to @julusian/image-rs equivalent
 */
export function translateRotation(rotation: SurfaceRotation | null): imageRs.RotationMode | null {
	if (rotation === 90 || rotation === 'surface90') return 'CW270'
	if (rotation === -90 || rotation === 'surface-90') return 'CW90'
	if (rotation === 180 || rotation === 'surface180') return 'CW180'
	return null
}

/**
 * Rotate a resolution based on a SurfaceRotation
 */
export function rotateResolution(width: number, height: number, rotation: SurfaceRotation | null): [number, number] {
	if (rotation === 90 || rotation === 'surface90' || rotation === -90 || rotation === 'surface-90') {
		return [height, width]
	} else {
		return [width, height]
	}
}

/**
 * Transform a button image render to the format needed for a surface integration
 * Note: input is assumed to be straight alpha RGBA
 * @param oversampling The factor the buffer was rendered larger than its real size by, which is resolved by averaging
 *   each block of pixels in linear light. Use 1 for a buffer at its real size.
 */
export async function transformButtonImage(
	buffer: Buffer,
	bufferWidth: number,
	bufferHeight: number,
	oversampling: number,
	rotation: SurfaceRotation | null,
	targetWidth: number,
	targetHeight: number,
	targetFormat: imageRs.PixelFormat
): Promise<Buffer> {
	let image = imageRs.ImageTransformer.fromBuffer(buffer, bufferWidth, bufferHeight, 'rgba')

	if (oversampling > 0) image = image.downsample(oversampling)

	const imageRsRotation = translateRotation(rotation)
	if (imageRsRotation !== null) image = image.rotate(imageRsRotation)

	image = image.scale(targetWidth, targetHeight, 'Fit')

	// pad, in case a button is non-square
	const dimensions = image.getCurrentDimensions()
	const xOffset = (targetWidth - dimensions.width) / 2
	const yOffset = (targetHeight - dimensions.height) / 2
	image = image.pad(Math.floor(xOffset), Math.ceil(xOffset), Math.floor(yOffset), Math.ceil(yOffset), {
		red: 0,
		green: 0,
		blue: 0,
		alpha: 255,
	})

	const computedImage = await image.toBuffer(targetFormat, {
		premultiplyAlpha: targetFormat.length === 3, // eg rgb/bgr
	})
	return computedImage.buffer
}

export function uint8ArrayToBuffer(arr: Uint8Array | Uint8ClampedArray): Buffer {
	return Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength)
}

/**
 * Show an fatal error message to the user, and exit
 */
export function showFatalError(title: string, message: string): void {
	sendOverIpc({
		messageType: 'fatal-error',
		title,
		body: message,
	})

	console.error(message)
	// eslint-disable-next-line n/no-process-exit
	process.exit(1)
}

/**
 * Show an error message to the user
 */
export function showErrorMessage(title: string, message: string): void {
	sendOverIpc({
		messageType: 'show-error',
		title,
		body: message,
	})

	console.error(message)
}

/**
 * Send message over IPC to parent
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function sendOverIpc(data: any): void {
	if (process.env.COMPANION_IPC_PARENT && process.send) {
		process.send(data)
	}
}

/**
 * Whether the application is running as a bundled package
 */
export function isPackaged(): boolean {
	// process.env.COMPANION_BUNDLED is replaced with '"1"' at compile time via esbuild define
	return process.env.COMPANION_BUNDLED === '1'
}

/**
 * Resolve the path to a worker-thread / module-subprocess entrypoint bundle.
 *
 * When packaged, these bundles sit alongside the calling module (`packagedDir`). In development the
 * backend itself runs from TypeScript source via tsx, but these entrypoints are esbuild-bundled into
 * a separate directory (they run in threads/subprocesses that cannot use the tsx loader - see
 * tools/dev.mts and tools/build_dev_threads.mts); COMPANION_DEV_THREAD_DIR points at it.
 */
export function resolveThreadEntrypoint(packagedDir: string, bundleName: string): string {
	const dir = isPackaged() ? packagedDir : (process.env.COMPANION_DEV_THREAD_DIR ?? packagedDir)
	return path.join(dir, bundleName)
}

/**
 * Whether Companion is running under the desktop Electron launcher (which has a settings UI).
 * The launcher sets the COMPANION_IPC_PARENT env var when spawning the Companion process.
 */
export function isRunningUnderLauncher(): boolean {
	return !!process.env.COMPANION_IPC_PARENT
}

/**
 * Build a message describing how to enable one of the "dangerous features", tailored to how
 * Companion is being run - either via the desktop launcher (which has a settings UI), or headless
 * (where the cli flag / env var must be used).
 */
export function describeHowToEnableDangerousFeature(cliFlag: string, envVar: string): string {
	if (isRunningUnderLauncher()) {
		return `You can enable it in the Companion launcher settings, under "Dangerous Features".`
	}
	return `You can enable it by starting Companion with ${cliFlag}, or by setting the ${envVar} environment variable.`
}

/**
 * Lazy compute a value
 * @param fn Function to compute the value
 * @returns Function that returns the computed value, only computed once
 */
export function lazy<T>(fn: () => T): () => T {
	let value: T | undefined
	let valueSet = false

	return () => {
		if (!valueSet) {
			value = fn()
			valueSet = true
		}
		return value as T
	}
}

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { decodeAnimatedImage } from '../AnimatedImageDecoder.js'

interface FakeBitmap {
	frameIndex: number
	width: number
	height: number
	close: ReturnType<typeof vi.fn>
}

/** A stand-in for the browser's ImageDecoder, decoding an animation with these frame delays (in ms) */
function stubImageDecoder(
	delaysMs: number[],
	options: { animated?: boolean; supported?: boolean; width?: number; height?: number } = {}
) {
	const closedFrames: number[] = []
	const decoders: { closed: boolean }[] = []

	class FakeImageDecoder {
		static isTypeSupported = vi.fn(async () => options.supported ?? true)

		readonly tracks = {
			ready: Promise.resolve(),
			selectedTrack: { animated: options.animated ?? delaysMs.length > 1, frameCount: delaysMs.length },
		}
		readonly completed = Promise.resolve()
		readonly state = { closed: false }

		constructor() {
			decoders.push(this.state)
		}

		async decode({ frameIndex }: { frameIndex: number }) {
			return {
				image: {
					frameIndex,
					displayWidth: options.width ?? 72,
					displayHeight: options.height ?? 72,
					duration: delaysMs[frameIndex] * 1000,
					close: () => closedFrames.push(frameIndex),
				},
			}
		}

		close() {
			this.state.closed = true
		}
	}

	vi.stubGlobal('ImageDecoder', FakeImageDecoder)
	vi.stubGlobal(
		'createImageBitmap',
		vi.fn(async (frame: { frameIndex: number }, resize: ImageBitmapOptions): Promise<FakeBitmap> => ({
			frameIndex: frame.frameIndex,
			width: resize.resizeWidth ?? 0,
			height: resize.resizeHeight ?? 0,
			close: vi.fn(),
		}))
	)

	return { closedFrames, decoders, FakeImageDecoder }
}

const GIF_DATA_URL = 'data:image/gif;base64,' + btoa('GIF89a not really a gif')

describe('decodeAnimatedImage', () => {
	beforeEach(() => {
		vi.unstubAllGlobals()
	})
	afterEach(() => {
		vi.unstubAllGlobals()
	})

	test('decodes the frames, resampled onto the render clock', async () => {
		const { closedFrames, decoders } = stubImageDecoder([50, 30, 120, 200])

		const result = await decodeAnimatedImage(GIF_DATA_URL)

		// The second frame is never on screen at a tick
		expect(result?.frames.map((frame) => (frame as unknown as FakeBitmap).frameIndex)).toEqual([0, 2, 3])
		expect(result?.frameStartMs).toEqual([0, 100, 200])
		expect(result?.durationMs).toBe(400)

		// Every decoded frame and the decoder are released
		expect(closedFrames).toEqual([0, 1, 2, 3])
		expect(decoders.every((decoder) => decoder.closed)).toBe(true)
	})

	test('scales the frames down to fit the memory limit, as the backend does', async () => {
		// 2000x2000 is 16MB a frame, so the third frame goes over the 32MB limit
		stubImageDecoder([100, 100, 100, 100], { width: 2000, height: 2000 })

		const result = await decodeAnimatedImage(GIF_DATA_URL)
		const frames = result?.frames as unknown as FakeBitmap[]

		// Every frame is the same size, including those decoded before the limit was reached
		expect(frames.map((frame) => [frame.frameIndex, frame.width, frame.height])).toEqual([
			[0, 1182, 1182],
			[1, 1182, 1182],
			[2, 1182, 1182],
			[3, 1182, 1182],
		])
		expect(4 * 1182 * 1182 * 4).toBeLessThanOrEqual(32 * 1024 * 1024)

		// The full size frames which were replaced are released
		const created: FakeBitmap[] = await Promise.all(
			vi.mocked(createImageBitmap).mock.results.map(async (result) => result.value as Promise<FakeBitmap>)
		)
		const replaced = created.filter((bitmap) => !frames.includes(bitmap))
		expect(replaced.map((bitmap) => [bitmap.frameIndex, bitmap.width])).toEqual([
			[0, 2000],
			[1, 2000],
		])
		expect(replaced.every((bitmap) => bitmap.close.mock.calls.length === 1)).toBe(true)
		expect(frames.every((bitmap) => bitmap.close.mock.calls.length === 0)).toBe(true)
	})

	test('keeps a small animation at its own size', async () => {
		stubImageDecoder([100, 100], { width: 100, height: 50 })

		const result = await decodeAnimatedImage(GIF_DATA_URL)

		expect((result?.frames as unknown as FakeBitmap[]).map((frame) => [frame.width, frame.height])).toEqual([
			[100, 50],
			[100, 50],
		])
	})

	test('returns null for an image which is not animated', async () => {
		stubImageDecoder([100], { animated: false })
		expect(await decodeAnimatedImage(GIF_DATA_URL)).toBeNull()
	})

	test('returns null for a format which can not be animated', async () => {
		const { FakeImageDecoder } = stubImageDecoder([100, 100])
		expect(await decodeAnimatedImage('data:image/jpeg;base64,' + btoa('not really a jpeg'))).toBeNull()
		expect(FakeImageDecoder.isTypeSupported).not.toHaveBeenCalled()
	})

	test('returns null when the browser can not decode the format', async () => {
		stubImageDecoder([100, 100], { supported: false })
		expect(await decodeAnimatedImage(GIF_DATA_URL)).toBeNull()
	})

	test('returns null when the browser has no ImageDecoder', async () => {
		vi.stubGlobal('ImageDecoder', undefined)
		expect(await decodeAnimatedImage(GIF_DATA_URL)).toBeNull()
	})
})

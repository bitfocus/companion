import { describe, expect, test, vi } from 'vitest'
import type { RendererDrawStyle } from '@companion-app/shared/Model/Render.js'
import type {
	ButtonGraphicsImageDrawElement,
	SomeButtonGraphicsDrawElement,
} from '@companion-app/shared/Model/StyleLayersModel.js'
import { ButtonGraphicsDecorationType, ButtonGraphicsElementUsage } from '@companion-app/shared/Model/StyleModel.js'
import type { DecodeImageResult } from '../../../lib/Graphics/ImageCache/DecodeImage.js'
import { ImageCacheStore, type DecodeImageFn } from '../../../lib/Graphics/ImageCache/ImageCacheStore.js'
import type { Logger } from '../../../lib/Log/Controller.js'

const logger = { warn: vi.fn(), debug: vi.fn(), error: vi.fn() } as unknown as Logger

function makeImageElement(id: string, base64Image: string | null): ButtonGraphicsImageDrawElement {
	return {
		type: 'image',
		id,
		usage: ButtonGraphicsElementUsage.Image,
		enabled: true,
		opacity: 1,
		contentHash: `hash-${id}`,
		x: 0,
		y: 0,
		width: 1,
		height: 1,
		rotation: 0,
		base64Image,
		halign: 'center',
		valign: 'center',
		fillMode: 'fit',
	}
}

function makeStyle(elements: SomeButtonGraphicsDrawElement[]): RendererDrawStyle {
	return {
		style: 'button-layered',
		drawType: 'button',
		elements,
		decoration: ButtonGraphicsDecorationType.Border,
		show_status_icons: false,
		location: undefined,
		pushed: false,
		stepCurrent: 1,
		stepCount: 1,
		button_status: undefined,
		action_running: undefined,
		decodedImages: null,
	}
}

function makeRaster(byteLength: number): DecodeImageResult {
	return { type: 'raster', buffer: new SharedArrayBuffer(byteLength), width: 1, height: byteLength / 4, frameCount: 1 }
}

/** A decoder which decodes any source to a raster of the given size */
function makeDecoder(byteLength = 16): ReturnType<typeof vi.fn<DecodeImageFn>> {
	return vi.fn<DecodeImageFn>(async () => makeRaster(byteLength))
}

describe('ImageCacheStore', () => {
	test('a style without images is returned unchanged', async () => {
		const decode = makeDecoder()
		const store = new ImageCacheStore(logger, decode, 1024)

		const style = makeStyle([makeImageElement('empty', null)])
		expect(await store.resolveDrawStyle(style)).toBe(style)
		expect(decode).not.toHaveBeenCalled()
	})

	test('decodes images, removing their source from the elements', async () => {
		const decode = makeDecoder()
		const store = new ImageCacheStore(logger, decode, 1024)

		const style = makeStyle([makeImageElement('a', 'source-a')])
		const resolved = await store.resolveDrawStyle(style)

		expect(decode).toHaveBeenCalledWith('source-a')
		expect(resolved.elements).toEqual([makeImageElement('a', null)])
		expect(resolved.decodedImages?.get('a')).toEqual({
			buffer: expect.any(SharedArrayBuffer),
			width: 1,
			height: 4,
			frameIndex: 0,
		})

		// The original is not modified
		expect(style.elements).toEqual([makeImageElement('a', 'source-a')])
		expect(style.decodedImages).toBeNull()
	})

	test('decodes images nested in groups and references', async () => {
		const store = new ImageCacheStore(logger, makeDecoder(), 1024)

		const text: SomeButtonGraphicsDrawElement = {
			...makeImageElement('text', null),
			type: 'box',
			color: 0,
			cornerRadius: 0,
			borderWidth: 0,
			borderColor: 0,
			borderPosition: 'inside',
		}
		const style = makeStyle([
			{
				...makeImageElement('group', null),
				type: 'group',
				squareCoords: false,
				children: [
					makeImageElement('inner', 'source-inner'),
					{
						...makeImageElement('reference', null),
						type: 'reference',
						children: [makeImageElement('deep', 'source-deep')],
					},
				],
			},
			text,
		])

		const resolved = await store.resolveDrawStyle(style)
		expect([...(resolved.decodedImages?.keys() ?? [])].sort()).toEqual(['deep', 'inner'])

		const group = resolved.elements[0]
		if (group.type !== 'group') throw new Error('Expected a group')
		expect(group.children[0]).toEqual(makeImageElement('inner', null))
		// Unchanged elements are kept as they were
		expect(resolved.elements[1]).toBe(text)
	})

	test('reuses the decoded image for the same source', async () => {
		const decode = makeDecoder()
		const store = new ImageCacheStore(logger, decode, 1024)

		const first = await store.resolveDrawStyle(makeStyle([makeImageElement('a', 'source')]))
		const second = await store.resolveDrawStyle(makeStyle([makeImageElement('b', 'source')]))

		expect(decode).toHaveBeenCalledTimes(1)
		expect(second.decodedImages?.get('b')?.buffer).toBe(first.decodedImages?.get('a')?.buffer)
	})

	test('decodes a source only once while a decode is in progress', async () => {
		const decode = makeDecoder()
		const store = new ImageCacheStore(logger, decode, 1024)

		const [first, second] = await Promise.all([
			store.resolveDrawStyle(makeStyle([makeImageElement('a', 'source')])),
			store.resolveDrawStyle(makeStyle([makeImageElement('a', 'source'), makeImageElement('b', 'source')])),
		])

		expect(decode).toHaveBeenCalledTimes(1)
		expect(first.decodedImages?.size).toBe(1)
		expect(second.decodedImages?.size).toBe(2)
	})

	test('leaves a passthrough image to be drawn from its source, without decoding it again', async () => {
		const decode = vi.fn<DecodeImageFn>(async () => ({ type: 'passthrough' }))
		const store = new ImageCacheStore(logger, decode, 1024)

		const style = makeStyle([makeImageElement('svg', 'source-svg')])
		expect(await store.resolveDrawStyle(style)).toBe(style)
		expect(await store.resolveDrawStyle(style)).toBe(style)
		expect(decode).toHaveBeenCalledTimes(1)
	})

	test('retries a decode which failed', async () => {
		const decode = vi
			.fn<DecodeImageFn>()
			.mockRejectedValueOnce(new Error('Worker crashed'))
			.mockResolvedValue(makeRaster(16))
		const store = new ImageCacheStore(logger, decode, 1024)

		const style = makeStyle([makeImageElement('a', 'source')])
		expect(await store.resolveDrawStyle(style)).toBe(style)
		expect(logger.warn).toHaveBeenCalled()

		const resolved = await store.resolveDrawStyle(style)
		expect(resolved.decodedImages?.size).toBe(1)
		expect(decode).toHaveBeenCalledTimes(2)
	})

	test('tracks the bytes retained by the cache', async () => {
		const store = new ImageCacheStore(logger, makeDecoder(100), 10_000)

		await store.resolveDrawStyle(makeStyle([makeImageElement('a', 'aa')]))
		// Two bytes for each character of the key, plus the pixels
		expect(store.usedBytes).toBe(2 * 2 + 100)
		expect(store.entryCount).toBe(1)
	})

	test('evicts the least recently used images once over budget', async () => {
		const decode = makeDecoder(100)
		// Room for two entries of 100 bytes plus their 2 byte keys
		const store = new ImageCacheStore(logger, decode, 250)

		await store.resolveDrawStyle(makeStyle([makeImageElement('a', 'a')]))
		await store.resolveDrawStyle(makeStyle([makeImageElement('b', 'b')]))
		// Use `a` again, so that `b` is the least recently used
		await store.resolveDrawStyle(makeStyle([makeImageElement('a', 'a')]))
		await store.resolveDrawStyle(makeStyle([makeImageElement('c', 'c')]))

		expect(store.entryCount).toBe(2)
		expect(store.usedBytes).toBe(2 * 102)
		expect(decode).toHaveBeenCalledTimes(3)

		// `a` is still cached, but `b` has to be decoded again
		await store.resolveDrawStyle(makeStyle([makeImageElement('a', 'a')]))
		expect(decode).toHaveBeenCalledTimes(3)
		await store.resolveDrawStyle(makeStyle([makeImageElement('b', 'b')]))
		expect(decode).toHaveBeenCalledTimes(4)
	})

	test('keeps an image larger than the whole budget, until the next one is cached', async () => {
		const store = new ImageCacheStore(logger, makeDecoder(400), 100)

		const resolved = await store.resolveDrawStyle(makeStyle([makeImageElement('a', 'a')]))
		expect(resolved.decodedImages?.size).toBe(1)
		expect(store.entryCount).toBe(1)

		await store.resolveDrawStyle(makeStyle([makeImageElement('b', 'b')]))
		expect(store.entryCount).toBe(1)
		expect(store.usedBytes).toBe(402)
	})
})

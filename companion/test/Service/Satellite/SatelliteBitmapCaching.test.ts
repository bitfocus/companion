import { describe, expect, test, vi } from 'vitest'
import { mock, mockDeep } from 'vitest-mock-extended'
import { parseLineParameters, splitSatelliteCommand } from '@companion-app/satellite-protocol'
import type { DataUserConfig } from '../../../lib/Data/UserConfig.js'
import { ImageResult } from '../../../lib/Graphics/ImageResult.js'
import type { Logger } from '../../../lib/Log/Controller.js'
import { SatelliteSocketWrapper, ServiceSatelliteApi } from '../../../lib/Service/Satellite/SatelliteApi.js'
import { SatelliteBitmapCache } from '../../../lib/Service/Satellite/SatelliteBitmapCache.js'
import {
	buildSatelliteStyleArgs,
	SATELLITE_CACHE_MAX_ANIMATION_LOOP_MS,
	sendSatelliteStyleMessage,
} from '../../../lib/Service/Satellite/SatelliteRenderUtil.js'
import type { ServiceApi } from '../../../lib/Service/ServiceApi.js'
import type { SurfaceController } from '../../../lib/Surface/Controller.js'

class TestSocketWrapper extends SatelliteSocketWrapper {
	readonly remoteAddress = '127.0.0.1'
	readonly writtenData: string[] = []

	protected write(data: string): void {
		this.writtenData.push(data)
	}

	destroy(): void {}
}

function parseMessage(line: string) {
	const { command, body } = splitSatelliteCommand(line.trim())
	return { command, params: parseLineParameters(body) }
}

function makeImage(cacheKey: string | undefined, size = 8) {
	const drawNative = vi.fn(async () => new Uint8Array(size * size * 3).fill(cacheKey ? cacheKey.length : 1))
	return { image: new ImageResult(cacheKey, { type: 'button' }, 0, drawNative), drawNative }
}

const SMALL_STYLE = { bitmap: { w: 8, h: 8 } }
const SMALL_COST = 8 * 8 * 4

describe('sendSatelliteStyleMessage', () => {
	test('without caching, sends the same as before', async () => {
		const socket = new TestSocketWrapper()
		const { image } = makeImage('frame-a')

		await sendSatelliteStyleMessage(socket, 'KEY-STATE', 'dev', { KEY: 1 }, image, SMALL_STYLE, null, 'rgb')

		const expected = await buildSatelliteStyleArgs(image, SMALL_STYLE, null, 'rgb')
		const { command, params } = parseMessage(socket.writtenData[0])
		expect(command).toBe('KEY-STATE')
		expect(params.BITMAP).toBe(expected.BITMAP)
		expect(params.BITMAP_ID).toBeUndefined()
	})

	test('sends a bitmap with its id the first time, then only the id', async () => {
		const socket = new TestSocketWrapper()
		socket.bitmapCache = new SatelliteBitmapCache(10 * SMALL_COST)
		const { image, drawNative } = makeImage('frame-a')

		await sendSatelliteStyleMessage(socket, 'KEY-STATE', 'dev', { KEY: 1 }, image, SMALL_STYLE, null, 'rgb')
		await sendSatelliteStyleMessage(socket, 'KEY-STATE', 'dev', { KEY: 2 }, image, SMALL_STYLE, null, 'rgb')

		const first = parseMessage(socket.writtenData[0]).params
		const second = parseMessage(socket.writtenData[1]).params
		expect(first.BITMAP).toBeTruthy()
		expect(first.BITMAP_ID).toBeTruthy()
		expect(second.BITMAP).toBeUndefined()
		expect(second.BITMAP_ID).toBe(first.BITMAP_ID)
		expect(second.KEY).toBe('2')

		// The second send didn't need to draw anything
		expect(drawNative).toHaveBeenCalledTimes(1)
	})

	test('evicts the least recently used bitmap before storing one which needs the room', async () => {
		const socket = new TestSocketWrapper()
		socket.bitmapCache = new SatelliteBitmapCache(SMALL_COST)
		const a = makeImage('frame-a').image
		const b = makeImage('frame-b').image

		await sendSatelliteStyleMessage(socket, 'KEY-STATE', 'dev', {}, a, SMALL_STYLE, null, 'rgb')
		await sendSatelliteStyleMessage(socket, 'KEY-STATE', 'dev', {}, b, SMALL_STYLE, null, 'rgb')

		const idA = parseMessage(socket.writtenData[0]).params.BITMAP_ID
		expect(parseMessage(socket.writtenData[1])).toEqual({ command: 'BITMAP-EVICT', params: { BITMAP_IDS: idA } })
		expect(parseMessage(socket.writtenData[2]).params.BITMAP).toBeTruthy()
	})

	test('sends a render with no content key in full, without storing it', async () => {
		const socket = new TestSocketWrapper()
		socket.bitmapCache = new SatelliteBitmapCache(10 * SMALL_COST)
		const { image } = makeImage(undefined)

		await sendSatelliteStyleMessage(socket, 'KEY-STATE', 'dev', {}, image, SMALL_STYLE, null, 'rgb')

		const { params } = parseMessage(socket.writtenData[0])
		expect(params.BITMAP).toBeTruthy()
		expect(params.BITMAP_ID).toBeUndefined()
		expect(socket.bitmapCache.entryCount).toBe(0)
	})

	test('sends frames of a long animation without caching them', async () => {
		const socket = new TestSocketWrapper()
		socket.bitmapCache = new SatelliteBitmapCache(10 * SMALL_COST)
		const drawNative = async () => new Uint8Array(8 * 8 * 3)
		const longLoop = new ImageResult(
			'frame-a',
			{ type: 'button' },
			SATELLITE_CACHE_MAX_ANIMATION_LOOP_MS + 100,
			drawNative
		)
		const shortLoop = new ImageResult('frame-b', { type: 'button' }, SATELLITE_CACHE_MAX_ANIMATION_LOOP_MS, drawNative)

		await sendSatelliteStyleMessage(socket, 'KEY-STATE', 'dev', {}, longLoop, SMALL_STYLE, null, 'rgb')
		await sendSatelliteStyleMessage(socket, 'KEY-STATE', 'dev', {}, shortLoop, SMALL_STYLE, null, 'rgb')

		const [long, short] = socket.writtenData.map((line) => parseMessage(line).params)
		expect(long.BITMAP).toBeTruthy()
		expect(long.BITMAP_ID).toBeUndefined()
		expect(short.BITMAP_ID).toBeTruthy()
		expect(socket.bitmapCache.entryCount).toBe(1)
	})

	test('sends a bitmap larger than the whole budget without storing it', async () => {
		const socket = new TestSocketWrapper()
		socket.bitmapCache = new SatelliteBitmapCache(SMALL_COST - 1)
		const { image } = makeImage('frame-a')

		await sendSatelliteStyleMessage(socket, 'KEY-STATE', 'dev', {}, image, SMALL_STYLE, null, 'rgb')

		expect(parseMessage(socket.writtenData[0]).params.BITMAP_ID).toBeUndefined()
		expect(socket.bitmapCache.entryCount).toBe(0)
	})

	test('sends the bitmap without an id if caching is turned off while drawing', async () => {
		const socket = new TestSocketWrapper()
		socket.bitmapCache = new SatelliteBitmapCache(10 * SMALL_COST)
		const image = new ImageResult('frame-a', { type: 'button' }, 0, async () => {
			socket.bitmapCache = null
			return new Uint8Array(8 * 8 * 3)
		})

		await sendSatelliteStyleMessage(socket, 'KEY-STATE', 'dev', {}, image, SMALL_STYLE, null, 'rgb')

		const { params } = parseMessage(socket.writtenData[0])
		expect(params.BITMAP).toBeTruthy()
		expect(params.BITMAP_ID).toBeUndefined()
	})

	test('sends only the id if another send stored the bitmap while drawing', async () => {
		const socket = new TestSocketWrapper()
		socket.bitmapCache = new SatelliteBitmapCache(10 * SMALL_COST)
		const { image } = makeImage('frame-a')

		await Promise.all([
			sendSatelliteStyleMessage(socket, 'KEY-STATE', 'dev', { KEY: 1 }, image, SMALL_STYLE, null, 'rgb'),
			sendSatelliteStyleMessage(socket, 'KEY-STATE', 'dev', { KEY: 2 }, image, SMALL_STYLE, null, 'rgb'),
		])

		const messages = socket.writtenData.map((line) => parseMessage(line).params)
		expect(messages.filter((params) => params.BITMAP !== undefined)).toHaveLength(1)
		expect(messages.every((params) => params.BITMAP_ID === messages[0].BITMAP_ID)).toBe(true)
	})
})

/**
 * A satellite client which follows the bitmap caching rules to the letter, failing on anything which could only
 * happen if Companion's record of its cache was wrong
 */
class StrictCachingClient {
	readonly #stored = new Map<string, number>()
	#budget = 0

	get totalCost(): number {
		let total = 0
		for (const cost of this.#stored.values()) total += cost
		return total
	}

	get storedIds(): string[] {
		return [...this.#stored.keys()]
	}

	apply(line: string): void {
		const { command, params } = parseMessage(line)
		switch (command) {
			case 'BITMAP-EVICT':
				if (params.ALL) {
					this.#stored.clear()
				} else {
					for (const id of String(params.BITMAP_IDS).split(',')) {
						if (!this.#stored.delete(id)) throw new Error(`Evicted ${id}, which the client does not have`)
					}
				}
				break
			case 'BITMAP-CACHE':
				this.#budget = Number(params.BYTES)
				if (this.#budget === 0 && this.#stored.size > 0) throw new Error('Purged, but bitmaps are left')
				break
			case 'KEY-STATE': {
				const id = params.BITMAP_ID === undefined ? undefined : String(params.BITMAP_ID)
				if (id && params.BITMAP !== undefined) {
					if (this.#stored.has(id)) throw new Error(`Told to store ${id}, which the client already has`)
					this.#stored.set(id, SMALL_COST)
				} else if (id) {
					if (!this.#stored.has(id)) throw new Error(`Told to draw ${id}, which the client does not have`)
				} else if (params.BITMAP === undefined) {
					throw new Error('KEY-STATE with no bitmap')
				}
				break
			}
		}

		if (this.totalCost > this.#budget && this.#budget > 0) {
			throw new Error(`Over budget: ${this.totalCost} > ${this.#budget}`)
		}
	}

	/** The client finding that a bitmap really costs this much to store, as it is about to report */
	setReportedCost(id: string, bytes: number): void {
		if (this.#stored.has(id)) this.#stored.set(id, bytes)
	}
}

describe('bitmap caching consistency', () => {
	test.each([1, 2, 3, 4, 5])('a strict client never misses or goes over budget (seed %i)', async (seed) => {
		// A small deterministic random source, so failures can be reproduced
		let state = seed * 7919
		const random = () => {
			state = (state * 1103515245 + 12345) % 2147483648
			return state / 2147483648
		}

		const serviceApi = mockDeep<ServiceApi>()
		const userconfig = mockDeep<DataUserConfig>()
		userconfig.getKey.mockReturnValue(false)
		const api = new ServiceSatelliteApi(serviceApi, mockDeep<SurfaceController>(), userconfig)
		const logger = mock<Logger>()
		const socket = new TestSocketWrapper()
		const { processMessage } = api.initSocket(logger, socket)
		socket.writtenData.length = 0

		const client = new StrictCachingClient()
		let applied = 0
		const applyWritten = () => {
			for (; applied < socket.writtenData.length; applied++) client.apply(socket.writtenData[applied])
		}

		// Frames of an animation, each drawn after a random delay so that sends overlap with each other
		const frames = Array.from({ length: 12 }, (_, i) => {
			return new ImageResult(`frame-${i}`, { type: 'button' }, 0, async () => {
				for (let n = Math.floor(random() * 4); n > 0; n--) await new Promise((resolve) => setImmediate(resolve))
				return new Uint8Array(8 * 8 * 3).fill(i)
			})
		})

		processMessage(`BITMAP-CACHE BYTES=${5 * SMALL_COST}\n`)
		applyWritten()

		for (let round = 0; round < 200; round++) {
			const pending: Promise<void>[] = []
			for (let key = 0; key < 4; key++) {
				const frame = frames[Math.floor(random() * frames.length)]
				pending.push(
					sendSatelliteStyleMessage(socket, 'KEY-STATE', 'dev', { KEY: key }, frame, SMALL_STYLE, null, 'rgb')
				)
			}

			// Change the cache while those sends are in flight
			const action = random()
			if (action < 0.1) {
				processMessage(`BITMAP-CACHE BYTES=${Math.floor(1 + random() * 8) * SMALL_COST}\n`)
			} else if (action < 0.15) {
				processMessage('BITMAP-CACHE BYTES=0\n')
				processMessage(`BITMAP-CACHE BYTES=${5 * SMALL_COST}\n`)
			} else if (action < 0.35) {
				applyWritten()
				const stored = client.storedIds
				const id = stored[Math.floor(random() * stored.length)] ?? 'evicted-long-ago'
				const bytes = Math.floor(random() * 2 * SMALL_COST) + 1
				client.setReportedCost(id, bytes)
				processMessage(`BITMAP-COST BITMAP_ID=${id} BYTES=${bytes}\n`)
			}

			await Promise.all(pending)
			applyWritten()
		}

		// Companion's record matches what the client holds
		expect(socket.bitmapCache?.entryCount ?? 0).toBe(client.storedIds.length)
		expect(socket.bitmapCache?.usedBytes ?? 0).toBe(client.totalCost)
	})
})
